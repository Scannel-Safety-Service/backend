import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Reminder } from '@prisma/client';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { ReminderQueryDto } from './dto/reminder-query.dto';
import { RemindersRepository } from './reminders.repository';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

@Injectable()
export class RemindersService {
  constructor(
    private readonly repository: RemindersRepository,
    private readonly prismaService: TenantPrismaService,
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
      description: dto.description,
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

    return this.repository.create(data);
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
    if (dto.description !== undefined) updateData.description = dto.description;
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

    return this.repository.update(id, updateData);
  }

  async complete(id: string): Promise<Reminder> {
    const reminder = await this.findOne(id);
    if (reminder.completedAt !== null) {
      throw new BadRequestException('Reminder is already completed');
    }

    return this.repository.update(id, {
      completedAt: new Date(),
    });
  }

  async archive(id: string): Promise<Reminder> {
    const reminder = await this.findOne(id);
    if (reminder.archivedAt !== null) {
      throw new BadRequestException('Reminder is already archived');
    }

    return this.repository.update(id, {
      archivedAt: new Date(),
    });
  }

  async restore(id: string): Promise<Reminder> {
    const reminder = await this.findOne(id);
    if (reminder.archivedAt === null) {
      throw new BadRequestException('Reminder is not archived');
    }

    return this.repository.update(id, {
      archivedAt: null,
    });
  }

  async permanentDelete(id: string): Promise<void> {
    const reminder = await this.findOne(id);
    if (reminder.archivedAt === null) {
      throw new BadRequestException(
        'Reminder must be archived first before permanent deletion',
      );
    }

    await this.repository.delete(id);
  }

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
