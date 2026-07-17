import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OneSignalModule } from '../onesignal/onesignal.module';
import { QueueService } from './queue.service';

/**
 * QueueModule — Global in-process job queue.
 *
 * Imports OneSignalModule to make OneSignalService available to the
 * QueueService worker that dispatches push notifications.
 */
@Global()
@Module({
  imports: [PrismaModule, OneSignalModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
