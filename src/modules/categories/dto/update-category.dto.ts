import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentSection } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'The name of the category' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    enum: DocumentSection,
    description: 'The document section this category belongs to',
  })
  @IsEnum(DocumentSection)
  @IsOptional()
  section?: DocumentSection;

  @ApiPropertyOptional({ description: 'Assign category to all users' })
  @IsBoolean()
  @IsOptional()
  assignToAll?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Optional array of specific user IDs assigned to this category',
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  userIds?: string[];
}
