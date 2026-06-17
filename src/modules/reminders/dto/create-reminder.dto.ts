import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReminderDto {
  @ApiPropertyOptional({ description: 'Optional user ID if reminder belongs to a user' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Optional individual ID if reminder belongs to a dependent/sub-record' })
  @IsUUID()
  @IsOptional()
  individualId?: string;

  @ApiProperty({ description: 'The title/name of the reminder' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Optional detailed description of the reminder' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'The due date for the reminder alert' })
  @IsDateString()
  dueDate: string;
}
