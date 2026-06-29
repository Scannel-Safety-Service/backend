import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ description: 'The name of the project' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The calendar year of the project (e.g. 2026, 2056)',
    minimum: 2000,
    maximum: 2100,
  })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiPropertyOptional({
    description: 'Optional company ID (required for Super Admin)',
  })
  @IsUUID()
  @IsOptional()
  companyId?: string;
}
