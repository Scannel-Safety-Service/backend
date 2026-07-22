import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateReminderDto {
  @ApiPropertyOptional({
    description: 'Optional user ID if reminder belongs to a user',
  })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Optional company ID if reminder belongs to a company/tenant',
  })
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiProperty({ description: 'The title/name of the reminder' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'The due date for the reminder alert' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ description: 'The reminder date for the alert' })
  @IsDateString()
  @IsOptional()
  reminderDate?: string;
}
