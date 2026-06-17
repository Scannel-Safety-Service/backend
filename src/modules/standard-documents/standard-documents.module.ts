import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { StandardDocumentsController } from './standard-documents.controller';
import { StandardDocumentsService } from './standard-documents.service';
import { StandardDocumentsRepository } from './standard-documents.repository';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [StandardDocumentsController],
  providers: [StandardDocumentsService, StandardDocumentsRepository],
  exports: [StandardDocumentsService],
})
export class StandardDocumentsModule {}
