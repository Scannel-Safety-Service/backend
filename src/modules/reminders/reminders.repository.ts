import { Injectable } from '@nestjs/common';
import { Prisma, Reminder } from '@prisma/client';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

@Injectable()
export class RemindersRepository {
  constructor(private readonly prismaService: TenantPrismaService) {}

  private get client() {
    return this.prismaService.client;
  }

  async findAndCount(
    where: Prisma.ReminderWhereInput,
    page: number = 1,
    limit: number = 10,
  ): Promise<[Reminder[], number]> {
    const skip = (page - 1) * limit;
    const take = limit;

    const [items, total] = await (this.client.$transaction([
      this.client.reminder.findMany({
        where,
        skip,
        take,
        orderBy: { dueDate: 'asc' },
      }),
      this.client.reminder.count({ where }),
    ]) as any);

    return [items as Reminder[], total as number];
  }

  async findById(id: string): Promise<Reminder | null> {
    return this.client.reminder.findUnique({
      where: { id },
    });
  }

  async create(data: Prisma.ReminderCreateInput): Promise<Reminder> {
    return this.client.reminder.create({
      data,
    });
  }

  async update(id: string, data: Prisma.ReminderUpdateInput): Promise<Reminder> {
    return this.client.reminder.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Reminder> {
    return this.client.reminder.delete({
      where: { id },
    });
  }
}
