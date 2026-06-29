import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentSection } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class StandardDocumentQueryDto {
  @ApiPropertyOptional({
    enum: DocumentSection,
    description: 'Filter templates by section',
  })
  @IsEnum(DocumentSection)
  @IsOptional()
  section?: DocumentSection;

  @ApiPropertyOptional({
    description:
      'Filter to show only archived, only active, or all. Defaults to active only.',
  })
  @IsOptional()
  @IsString()
  archived?: 'true' | 'false' | 'all';

  @ApiPropertyOptional({
    example: 1,
    description: 'Page number for pagination',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of records per page',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}
