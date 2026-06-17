import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class UpdateDocumentDto {
  @ApiPropertyOptional({ description: 'Optional category ID' })
  @IsUUID()
  @IsOptional()
  categoryId?: string | null;

  @ApiPropertyOptional({ description: 'Optional user ID if this document is scoped to a user' })
  @IsUUID()
  @IsOptional()
  userId?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Optional new file to replace the existing file' })
  @IsOptional()
  file?: any;
}
