import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentSection } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class ExportZipDto {
  @ApiPropertyOptional({
    description: 'Array of document IDs to include in the ZIP archive',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  documentIds?: string[];

  @ApiPropertyOptional({ enum: DocumentSection, description: 'Optional document section filter' })
  @IsEnum(DocumentSection)
  @IsOptional()
  section?: DocumentSection;

  @ApiPropertyOptional({ description: 'Optional category ID filter' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Optional custom folder label for the ZIP archive file name' })
  @IsString()
  @IsOptional()
  folderName?: string;
}
