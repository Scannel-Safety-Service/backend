import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: 'Acme Corporation Ltd.', description: 'The updated name of the company' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the company is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
