import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateReminderDto {
  @ApiPropertyOptional({
    description: 'Optional user ID if reminder belongs to a user',
  })
  @IsUUID()
  @IsOptional()
  userId?: string | null;

  @ApiPropertyOptional({ description: 'The title/name of the reminder' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'The training date for the reminder alert' })
  @IsDateString()
  @IsOptional()
  trainingDate?: string;

  @ApiPropertyOptional({ description: 'The reminder date for the alert' })
  @IsDateString()
  @IsOptional()
  reminderDate?: string;
}
