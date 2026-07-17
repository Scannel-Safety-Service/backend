import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReminderNotificationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

/**
 * ReminderSchedulerService
 *
 * Runs a cron job every minute to check for pending push notifications
 * and enqueue them for dispatch via the QueueService worker.
 *
 * Crash Recovery:
 *   Implements OnModuleInit — runs the scan immediately on server startup.
 *   This ensures that any notifications missed during a server crash or
 *   restart are dispatched as soon as the server comes back online.
 *
 * At-Least-Once Delivery:
 *   Uses PROCESSING status as a distributed lock. If the server crashes
 *   mid-dispatch (while status=PROCESSING), the startup scan re-queues
 *   those notifications with an incremented retry counter.
 *
 * Retry Logic:
 *   The QueueService worker updates `nextRetryAt` using exponential backoff.
 *   This scheduler only picks up records where `nextRetryAt <= NOW()` (or NULL).
 */
@Injectable()
export class ReminderSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Crash recovery hook — runs immediately on module initialization.
   * Dispatches all pending notifications that were due before the server restarted.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log(
      '🚀 Server started — running crash-recovery scan for pending reminder notifications...',
    );
    // Backfill any active reminders that don't have notifications first (e.g. legacy data)
    await this.backfillMissingNotifications();
    await this.checkAndDispatchPendingNotifications();
  }

  /**
   * Automatically backfills missing notification records for any active, uncompleted
   * reminders that do not have a PENDING, PROCESSING, or SENT notification.
   */
  private async backfillMissingNotifications(): Promise<void> {
    try {
      const activeRemindersWithoutNotifications = await this.prisma.reminder.findMany({
        where: {
          isDeleted: false,
          archivedAt: null,
          completedAt: null,
          notifications: {
            none: {
              status: {
                in: [
                  ReminderNotificationStatus.PENDING,
                  ReminderNotificationStatus.PROCESSING,
                  ReminderNotificationStatus.SENT,
                ],
              },
            },
          },
        },
        select: {
          id: true,
          dueDate: true,
          reminderDate: true,
        },
      });

      if (activeRemindersWithoutNotifications.length === 0) {
        return;
      }

      this.logger.log(
        `Backfilling missing notifications for ${activeRemindersWithoutNotifications.length} active reminder(s)...`,
      );

      // Create PENDING notification records for all these reminders
      await this.prisma.reminderNotification.createMany({
        data: activeRemindersWithoutNotifications.map((reminder) => {
          const scheduledAt = reminder.reminderDate ?? reminder.dueDate;
          return {
            reminderId: reminder.id,
            scheduledAt,
            status: ReminderNotificationStatus.PENDING,
            retryCount: 0,
            maxRetries: 6,
          };
        }),
      });

      this.logger.log('Successfully backfilled missing reminder notifications.');
    } catch (error) {
      this.logger.error(
        'Failed to backfill missing reminder notifications',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Scheduled cron — runs every minute.
   * Picks up any PENDING notifications whose scheduled time has arrived
   * and any PROCESSING notifications that were interrupted (crash recovery).
   */
  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'reminder-notification-dispatch',
    timeZone: 'UTC',
  })
  async handleReminderCron(): Promise<void> {
    this.logger.debug('⏰ Cron tick — checking for pending reminder notifications');
    await this.checkAndDispatchPendingNotifications();
  }

  // ---------------------------------------------------------------------------
  // Core scanner
  // ---------------------------------------------------------------------------

  /**
   * Finds all pending/overdue reminder notifications and enqueues them.
   *
   * Query strategy:
   *   - status = PENDING or PROCESSING (PROCESSING = interrupted crash recovery)
   *   - scheduledAt <= NOW() (due time has passed)
   *   - retryCount < maxRetries (not permanently failed)
   *   - nextRetryAt IS NULL OR nextRetryAt <= NOW() (backoff delay has elapsed)
   *   - Reminder itself is not deleted, archived, or completed
   */
  private async checkAndDispatchPendingNotifications(): Promise<void> {
    const now = new Date();

    try {
      // Find all eligible notifications due for dispatch.
      // Note: We query for retryCount < 6 (the hardcoded max) since Prisma does
      // not support column-to-column comparisons in where clauses.
      const eligibleNotifications = await this.prisma.reminderNotification.findMany({
        where: {
          status: {
            in: [
              ReminderNotificationStatus.PENDING,
              ReminderNotificationStatus.PROCESSING, // Recover interrupted jobs
            ],
          },
          scheduledAt: { lte: now },
          retryCount: { lt: 6 }, // Hard limit matches maxRetries default
          AND: [
            {
              OR: [
                { nextRetryAt: null },         // First attempt — no backoff applied
                { nextRetryAt: { lte: now } }, // Backoff delay has fully elapsed
              ],
            },
            {
              reminder: {
                isDeleted: false,
                archivedAt: null,
                completedAt: null,
              },
            },
          ],
        },
        select: {
          id: true,
          reminderId: true,
          retryCount: true,
          maxRetries: true,
        },
      });

      // Secondary in-memory filter: honour per-record maxRetries in case it ever
      // differs from the default (e.g., a future admin override per reminder)
      const dispatchable = eligibleNotifications.filter(
        (n) => n.retryCount < n.maxRetries,
      );

      if (dispatchable.length === 0) {
        this.logger.debug('No pending reminder notifications to dispatch');
        return;
      }

      this.logger.log(
        `Found ${dispatchable.length} reminder notification(s) to dispatch`,
      );

      // Mark all as PROCESSING atomically before enqueuing
      await this.prisma.reminderNotification.updateMany({
        where: { id: { in: dispatchable.map((n) => n.id) } },
        data: { status: ReminderNotificationStatus.PROCESSING },
      });

      // Enqueue each notification as a separate background job
      for (const notification of dispatchable) {
        await this.queueService.addJob('send-reminder-notification', {
          notificationId: notification.id,
        });
      }

      this.logger.log(
        `✅ Enqueued ${dispatchable.length} reminder notification job(s)`,
      );
    } catch (error) {
      this.logger.error(
        'Reminder scheduler scan failed',
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
