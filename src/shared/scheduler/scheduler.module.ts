import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { ReminderSchedulerService } from './reminder-scheduler.service';

/**
 * SchedulerModule
 *
 * Registers the @nestjs/schedule cron infrastructure and the
 * ReminderSchedulerService that uses it.
 *
 * This module is NOT global — it is imported directly in AppModule
 * alongside ScheduleModule.forRoot().
 */
@Module({
  imports: [
    ScheduleModule.forRoot(), // Bootstraps the cron engine (in-process, no Redis)
    PrismaModule,
    QueueModule,
  ],
  providers: [ReminderSchedulerService],
})
export class SchedulerModule {}
