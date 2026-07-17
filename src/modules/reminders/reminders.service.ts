import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Reminder, ReminderNotificationStatus } from '@prisma/client';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { ReminderQueryDto } from './dto/reminder-query.dto';
import { RemindersRepository } from './reminders.repository';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RemindersService {
  constructor(
    private readonly repository: RemindersRepository,
    private readonly prismaService: TenantPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateReminderDto): Promise<Reminder> {
    if (dto.userId) {
      await this.verifyUserBelongsToTenant(dto.userId);
    }
    if (dto.individualId) {
      await this.verifyIndividualBelongsToTenant(dto.individualId);
    }

    const data: Prisma.ReminderCreateInput = {
      title: dto.title,
      dueDate: new Date(dto.dueDate),
      reminderDate: dto.reminderDate ? new Date(dto.reminderDate) : null,
      company: { connect: { id: dto.companyId || '' } }, // Injected by TenantPrismaService or explicitly passed
    };

    if (dto.userId) {
      data.user = { connect: { id: dto.userId } };
    }
    if (dto.individualId) {
      data.individual = { connect: { id: dto.individualId } };
    }

    const reminder = await this.repository.create(data);

    // Auto-create the ReminderNotification dispatch record.
    // scheduledAt = reminderDate if set, otherwise fall back to dueDate.
    await this.scheduleNotification(reminder);

    return reminder;
  }

  async findAll(queryDto: ReminderQueryDto) {
    const where: Prisma.ReminderWhereInput = {};

    if (queryDto.userId) {
      where.userId = queryDto.userId;
    }

    if (queryDto.individualId) {
      where.individualId = queryDto.individualId;
    }

    if (queryDto.completed === 'true') {
      where.completedAt = { not: null };
    } else if (queryDto.completed === 'false') {
      where.completedAt = null;
    }

    if (queryDto.archived === 'true') {
      where.archivedAt = { not: null };
    } else if (queryDto.archived === 'false' || !queryDto.archived) {
      where.archivedAt = null;
    }
    // Permanently soft-deleted records are NEVER visible via API
    where.isDeleted = false;

    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;

    const [items, total] = await this.repository.findAndCount(
      where,
      page,
      limit,
    );

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Reminder> {
    const reminder = await this.repository.findById(id);
    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }
    // Permanently soft-deleted records are invisible via API
    if (reminder.isDeleted) {
      throw new NotFoundException('Reminder not found');
    }
    return reminder;
  }

  async update(id: string, dto: UpdateReminderDto): Promise<Reminder> {
    await this.findOne(id);

    if (dto.userId) {
      await this.verifyUserBelongsToTenant(dto.userId);
    }
    if (dto.individualId) {
      await this.verifyIndividualBelongsToTenant(dto.individualId);
    }

    const updateData: Prisma.ReminderUpdateInput = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.dueDate !== undefined) updateData.dueDate = new Date(dto.dueDate);
    if (dto.reminderDate !== undefined) {
      updateData.reminderDate = dto.reminderDate ? new Date(dto.reminderDate) : null;
    }

    if (dto.userId !== undefined) {
      if (dto.userId === null) {
        updateData.user = { disconnect: true };
      } else {
        updateData.user = { connect: { id: dto.userId } };
      }
    }

    if (dto.individualId !== undefined) {
      if (dto.individualId === null) {
        updateData.individual = { disconnect: true };
      } else {
        updateData.individual = { connect: { id: dto.individualId } };
      }
    }

    const updated = await this.repository.update(id, updateData);

    // If the schedule dates changed, re-schedule the notification.
    const datesChanged =
      dto.dueDate !== undefined || dto.reminderDate !== undefined;
    if (datesChanged) {
      await this.rescheduleNotification(updated);
    }

    return updated;
  }

  async complete(id: string): Promise<Reminder> {
    const reminder = await this.findOne(id);
    if (reminder.completedAt !== null) {
      throw new BadRequestException('Reminder is already completed');
    }

    const completed = await this.repository.update(id, {
      completedAt: new Date(),
    });

    // Cancel any pending notifications — reminder is done
    await this.cancelPendingNotifications(id, 'Reminder marked as completed');

    return completed;
  }

  async archive(id: string): Promise<Reminder> {
    const reminder = await this.findOne(id);
    if (reminder.archivedAt !== null) {
      throw new BadRequestException('Reminder is already archived');
    }

    const archived = await this.repository.update(id, {
      archivedAt: new Date(),
    });

    // Cancel any pending notifications — reminder is archived
    await this.cancelPendingNotifications(id, 'Reminder archived');

    return archived;
  }

  async restore(id: string): Promise<Reminder> {
    const reminder = await this.findOne(id);
    if (reminder.archivedAt === null) {
      throw new BadRequestException('Reminder is not archived');
    }
    const restored = await this.repository.update(id, { archivedAt: null });

    // Re-schedule notification if the reminderDate/dueDate is still in the future
    await this.rescheduleNotification(restored);

    return restored;
  }

  /**
   * Soft permanent delete — sets isDeleted to true.
   * Record is permanently hidden from the UI but remains in the database forever.
   * Cancels any pending notifications.
   */
  async permanentDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repository.update(id, { isDeleted: true });
    await this.cancelPendingNotifications(id, 'Reminder permanently deleted');
  }

  // ---------------------------------------------------------------------------
  // Notification lifecycle helpers
  // ---------------------------------------------------------------------------

  /**
   * Creates a PENDING ReminderNotification for a newly created reminder.
   * Uses raw PrismaService (not tenant-scoped) since this runs outside the
   * request context during background operations.
   */
  private async scheduleNotification(reminder: Reminder): Promise<void> {
    const scheduledAt = reminder.reminderDate ?? reminder.dueDate;

    await this.prisma.reminderNotification.create({
      data: {
        reminderId: reminder.id,
        scheduledAt,
        status: ReminderNotificationStatus.PENDING,
        retryCount: 0,
        maxRetries: 6,
      },
    });
  }

  /**
   * Re-schedules the notification after a date change or restore.
   * Cancels all existing PENDING/PROCESSING notifications and creates
   * a fresh one with the updated schedule.
   */
  private async rescheduleNotification(reminder: Reminder): Promise<void> {
    const scheduledAt = reminder.reminderDate ?? reminder.dueDate;

    // Cancel existing pending notifications for this reminder
    await this.prisma.reminderNotification.updateMany({
      where: {
        reminderId: reminder.id,
        status: {
          in: [
            ReminderNotificationStatus.PENDING,
            ReminderNotificationStatus.PROCESSING,
          ],
        },
      },
      data: {
        status: ReminderNotificationStatus.CANCELLED,
        errorMessage: 'Reminder dates updated — notification rescheduled',
      },
    });

    await this.prisma.reminderNotification.create({
      data: {
        reminderId: reminder.id,
        scheduledAt,
        status: ReminderNotificationStatus.PENDING,
        retryCount: 0,
        maxRetries: 6,
      },
    });
  }

  /**
   * Cancels all PENDING/PROCESSING notifications for a reminder.
   * Called when a reminder is completed or archived.
   */
  private async cancelPendingNotifications(
    reminderId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.reminderNotification.updateMany({
      where: {
        reminderId,
        status: {
          in: [
            ReminderNotificationStatus.PENDING,
            ReminderNotificationStatus.PROCESSING,
          ],
        },
      },
      data: {
        status: ReminderNotificationStatus.CANCELLED,
        errorMessage: reason,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Tenant verification helpers
  // ---------------------------------------------------------------------------

  private async verifyUserBelongsToTenant(userId: string): Promise<void> {
    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Scoped user not found');
    }
  }

  private async verifyIndividualBelongsToTenant(
    individualId: string,
  ): Promise<void> {
    const individual = await this.prismaService.client.individual.findUnique({
      where: { id: individualId },
    });
    if (!individual) {
      throw new NotFoundException('Scoped individual not found');
    }
  }
}
