import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { QueueService } from './queue.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
