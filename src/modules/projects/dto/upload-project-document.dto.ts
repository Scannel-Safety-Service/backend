import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentSection } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UploadProjectDocumentDto {
  @ApiPropertyOptional({
    description: 'Optional display title of the document',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Optional description of the document' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    enum: DocumentSection,
    description: 'The document section (defaults to COMPANY_DOCUMENTS)',
  })
  @IsEnum(DocumentSection)
  @IsOptional()
  section?: DocumentSection;

  /**
   * Interrogation Search metadata — document classification type.
   * Examples: INSPECTION_REPORT, SIGN_OFF, PERMIT, CERTIFICATE, METHOD_STATEMENT, OTHER
   */
  @ApiPropertyOptional({
    description:
      'Document classification type for interrogation search filtering (e.g. INSPECTION_REPORT, PERMIT, CERTIFICATE, SIGN_OFF, METHOD_STATEMENT, OTHER)',
    example: 'INSPECTION_REPORT',
  })
  @IsString()
  @IsOptional()
  documentType?: string;

  /**
   * Interrogation Search metadata — inspection frequency classification.
   * Examples: DAILY, WEEKLY, MONTHLY, ANNUAL, ADHOC
   */
  @ApiPropertyOptional({
    description:
      'Inspection frequency type for interrogation search filtering (e.g. DAILY, WEEKLY, MONTHLY, ANNUAL, ADHOC)',
    example: 'MONTHLY',
  })
  @IsString()
  @IsOptional()
  inspectionType?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'The document file to upload',
  })
  @IsOptional()
  file?: any;
}
