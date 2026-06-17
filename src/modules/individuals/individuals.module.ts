import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { IndividualsController } from './individuals.controller';
import { IndividualsService } from './individuals.service';
import { IndividualsRepository } from './individuals.repository';

@Module({
  imports: [PrismaModule],
  controllers: [IndividualsController],
  providers: [IndividualsService, IndividualsRepository],
  exports: [IndividualsService],
})
export class IndividualsModule {}
