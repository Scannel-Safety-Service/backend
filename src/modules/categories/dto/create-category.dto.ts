import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentSection } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ description: 'The name of the category' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: DocumentSection, description: 'The document section this category belongs to' })
  @IsEnum(DocumentSection)
  section: DocumentSection;

  @ApiPropertyOptional({ description: 'Optional user ID if this category is scoped to a single user' })
  @IsUUID()
  @IsOptional()
  userId?: string;
}
