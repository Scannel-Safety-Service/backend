import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentSection } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStandardDocumentDto {
  @ApiProperty({ description: 'The title of the global template' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    enum: DocumentSection,
    description: 'The document section this template belongs to',
  })
  @IsEnum(DocumentSection)
  section: DocumentSection;

  @ApiPropertyOptional({ description: 'Optional description of the template' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'The template file to upload',
  })
  @IsOptional()
  file?: any;
}
