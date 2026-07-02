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
    description:
      'Optional specific user ID assigned to this category',
  })
  @IsUUID()
  @IsOptional()
  userId?: string;
}
