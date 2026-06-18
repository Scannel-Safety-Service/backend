import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentSection } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ description: 'The name of the category' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: DocumentSection, description: 'The document section this category belongs to' })
  @IsEnum(DocumentSection)
  section: DocumentSection;

  @ApiProperty({ description: 'Assign category to all users' })
  @IsBoolean()
  assignToAll: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Optional array of specific user IDs assigned to this category' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  userIds?: string[];
}
