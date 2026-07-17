import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OneSignalService } from '../onesignal/onesignal.service';
import { ReminderNotificationStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Job type registry
// ---------------------------------------------------------------------------

export type JobType = 'seed-project-folders' | 'send-reminder-notification';

export interface SeedProjectFoldersData {
  projectId: string;
  companyId: string;
}

export interface SendReminderNotificationData {
  /** ID of the ReminderNotification record to dispatch */
  notificationId: string;
}

export type JobData = SeedProjectFoldersData | SendReminderNotificationData;

// ---------------------------------------------------------------------------
// Exponential backoff schedule (max 6 retries)
// ---------------------------------------------------------------------------
// Index = current retryCount (0-based). Value = delay in milliseconds before next retry.
const BACKOFF_DELAYS_MS: Record<number, number> = {
  0: 1 * 60 * 1000,      // 1st failure  → wait 1 minute
  1: 5 * 60 * 1000,      // 2nd failure  → wait 5 minutes
  2: 15 * 60 * 1000,     // 3rd failure  → wait 15 minutes
  3: 30 * 60 * 1000,     // 4th failure  → wait 30 minutes
  4: 60 * 60 * 1000,     // 5th failure  → wait 1 hour
  5: 2 * 60 * 60 * 1000, // 6th failure  → wait 2 hours (final attempt)
};

const MAX_RETRIES = 6;

/**
 * QueueService
 *
 * In-process background job worker using setImmediate for non-blocking
 * execution. Uses the database (PostgreSQL via Prisma) for crash recovery
 * and retry tracking — no Redis required.
 *
 * Job types:
 * - seed-project-folders: seeds default folder structure for new projects
 * - send-reminder-notification: dispatches a push notification via OneSignal
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oneSignal: OneSignalService,
  ) {}

  /**
   * Enqueues a background job for non-blocking execution.
   * Returns immediately; the job runs off-thread via setImmediate.
   */
  async addJob(jobType: JobType, data: JobData): Promise<void> {
    const jobId =
      jobType === 'send-reminder-notification'
        ? (data as SendReminderNotificationData).notificationId
        : (data as SeedProjectFoldersData).projectId;

    this.logger.log(`Enqueuing background job [${jobType}] id=${jobId}`);

    setImmediate(() => {
      this.processJob(jobType, data)
        .then(() => {
          this.logger.log(
            `Successfully completed job [${jobType}] id=${jobId}`,
          );
        })
        .catch((error) => {
          this.logger.error(
            `Unhandled failure in job [${jobType}] id=${jobId}`,
            error instanceof Error ? error.stack : error,
          );
        });
    });
  }

  // ---------------------------------------------------------------------------
  // Private worker logic
  // ---------------------------------------------------------------------------

  private async processJob(jobType: JobType, data: JobData): Promise<void> {
    if (jobType === 'seed-project-folders') {
      await this.processSeedProjectFolders(data as SeedProjectFoldersData);
    } else if (jobType === 'send-reminder-notification') {
      await this.processReminderNotification(
        data as SendReminderNotificationData,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // seed-project-folders worker
  // ---------------------------------------------------------------------------

  private async processSeedProjectFolders(
    data: SeedProjectFoldersData,
  ): Promise<void> {
    const { projectId, companyId } = data;

    const foldersToSeed = [
      'Preliminary Plan',
      'AF1/AF2',
      'Appointments',
      'Plans',
      'Drawings',
      'Method Statements',
      'Inductions',
      'Toolbox Talks',
      'Site Audits',
      'SSWP',
      'Permits',
      'Accident Reports',
      'MSDS',
    ];

    await this.prisma.$transaction(
      foldersToSeed.map((folderName) =>
        this.prisma.folder.create({
          data: {
            name: folderName,
            projectId,
            companyId,
          },
        }),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // send-reminder-notification worker
  // ---------------------------------------------------------------------------

  private async processReminderNotification(
    data: SendReminderNotificationData,
  ): Promise<void> {
    const { notificationId } = data;
    const now = new Date();

    // 1. Load the notification record with its related reminder and user
    const notification = await this.prisma.reminderNotification.findUnique({
      where: { id: notificationId },
      include: {
        reminder: {
          include: {
            user: {
              include: {
                deviceTokens: true,
              },
            },
          },
        },
      },
    });

    if (!notification) {
      this.logger.warn(
        `ReminderNotification [${notificationId}] not found — skipping`,
      );
      return;
    }

    // Guard: skip if already sent or cancelled
    if (
      notification.status === ReminderNotificationStatus.SENT ||
      notification.status === ReminderNotificationStatus.CANCELLED
    ) {
      this.logger.debug(
        `Notification [${notificationId}] already ${notification.status} — skipping`,
      );
      return;
    }

    const { reminder } = notification;

    // Guard: skip if reminder was deleted, archived, or completed
    if (reminder.isDeleted || reminder.archivedAt || reminder.completedAt) {
      await this.prisma.reminderNotification.update({
        where: { id: notificationId },
        data: {
          status: ReminderNotificationStatus.CANCELLED,
          errorMessage: 'Reminder was completed/archived before dispatch',
          lastAttemptAt: now,
        },
      });
      this.logger.log(
        `Notification [${notificationId}] cancelled — reminder no longer active`,
      );
      return;
    }

    // 2. Collect all device tokens for the user
    const deviceTokens = reminder.user?.deviceTokens ?? [];
    const subscriptionIds = deviceTokens.map((t) => t.subscriptionId);

    if (subscriptionIds.length === 0) {
      this.logger.warn(
        `No device tokens for user [${reminder.userId}] — reminder [${reminder.id}]`,
      );
      await this.handleNotificationFailure(
        notificationId,
        notification.retryCount,
        'No device tokens registered for this user',
        now,
      );
      return;
    }

    // 3. Build notification content using the training reminder template
    const { title: notificationTitle, body: notificationBody } =
      this.buildNotificationPayload(reminder);

    // 4. Send via OneSignal
    const result = await this.oneSignal.sendToSubscriptionIds({
      subscriptionIds,
      title: notificationTitle,
      body: notificationBody,
      data: {
        reminderId: reminder.id,
        type: 'reminder',
      },
    });

    // 5. Update DB based on result
    if (result.success) {
      await this.prisma.reminderNotification.update({
        where: { id: notificationId },
        data: {
          status: ReminderNotificationStatus.SENT,
          sentAt: now,
          lastAttemptAt: now,
          nextRetryAt: null,
          errorMessage: null,
        },
      });
      this.logger.log(
        `Notification [${notificationId}] SENT to ${subscriptionIds.length} device(s) — OneSignal id=${result.notificationId}`,
      );
    } else {
      await this.handleNotificationFailure(
        notificationId,
        notification.retryCount,
        result.error ?? 'Unknown OneSignal error',
        now,
      );
    }
  }

  /**
   * Handles a failed dispatch attempt.
   * Increments the retry counter and schedules the next retry using
   * exponential backoff. Marks as FAILED if max retries are exceeded.
   */
  private async handleNotificationFailure(
    notificationId: string,
    currentRetryCount: number,
    errorMessage: string,
    now: Date,
  ): Promise<void> {
    const newRetryCount = currentRetryCount + 1;

    if (newRetryCount >= MAX_RETRIES) {
      // Permanently failed — no more retries
      await this.prisma.reminderNotification.update({
        where: { id: notificationId },
        data: {
          status: ReminderNotificationStatus.FAILED,
          retryCount: newRetryCount,
          lastAttemptAt: now,
          nextRetryAt: null,
          errorMessage: `[Attempt ${newRetryCount}/${MAX_RETRIES}] ${errorMessage}`,
        },
      });
      this.logger.error(
        `Notification [${notificationId}] PERMANENTLY FAILED after ${newRetryCount} attempts: ${errorMessage}`,
      );
    } else {
      // Schedule next retry using exponential backoff
      const delayMs = BACKOFF_DELAYS_MS[currentRetryCount] ?? BACKOFF_DELAYS_MS[5];
      const nextRetryAt = new Date(now.getTime() + delayMs);

      await this.prisma.reminderNotification.update({
        where: { id: notificationId },
        data: {
          status: ReminderNotificationStatus.PENDING, // Reset to PENDING for next pick-up
          retryCount: newRetryCount,
          lastAttemptAt: now,
          nextRetryAt,
          errorMessage: `[Attempt ${newRetryCount}/${MAX_RETRIES}] ${errorMessage}`,
        },
      });
      this.logger.warn(
        `Notification [${notificationId}] failed (attempt ${newRetryCount}/${MAX_RETRIES}). Next retry at ${nextRetryAt.toISOString()}. Error: ${errorMessage}`,
      );
    }
  }

  /**
   * Builds the notification title and body using the training reminder template.
   *
   * Template:
   *   Title: "[Reminder] {reminderTitle}"
   *   Body:  "Hi {firstName},\nThis is just a reminder that you have {title} training on {trainingDate}.\n\nThanks,\nSafety Tracker Pro"
   */
  private buildNotificationPayload(reminder: {
    title: string;
    dueDate: Date;
    reminderDate?: Date | null;
    user?: { firstName: string; lastName: string } | null;
  }): { title: string; body: string } {
    const firstName = reminder.user?.firstName ?? 'Team Member';
    const trainingDate = (reminder.reminderDate ?? reminder.dueDate).toLocaleDateString('en-IE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return {
      title: `Reminder: ${reminder.title}`,
      body: `Hi ${firstName},\n\nThis is just a reminder that you have ${reminder.title} training on ${trainingDate}.\n\nThanks,\nSafety Tracker Pro`,
    };
  }
}
