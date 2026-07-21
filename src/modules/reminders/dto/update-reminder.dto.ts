import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateReminderDto {
  @ApiPropertyOptional({
    description: 'Optional user ID if reminder belongs to a user',
  })
  @IsUUID()
  @IsOptional()
  userId?: string | null;

  @ApiPropertyOptional({
    description:
      'Optional individual ID if reminder belongs to a dependent/sub-record',
  })
  @IsUUID()
  @IsOptional()
  individualId?: string | null;

  @ApiPropertyOptional({ description: 'The title/name of the reminder' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'The due date for the reminder alert' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'The reminder date for the alert' })
  @IsDateString()
  @IsOptional()
  reminderDate?: string;
}
