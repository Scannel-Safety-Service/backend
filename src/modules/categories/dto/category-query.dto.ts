import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentSection } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CategoryQueryDto {
  @ApiPropertyOptional({
    enum: DocumentSection,
    description: 'Filter categories by document section',
  })
  @IsEnum(DocumentSection)
  @IsOptional()
  section?: DocumentSection;

  @ApiPropertyOptional({ description: 'Filter categories by scoped user ID' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description:
      'Filter to show only archived, only active, or all. If not specified, returns active only.',
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
