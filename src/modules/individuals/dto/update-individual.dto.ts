import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateIndividualDto {
  @ApiPropertyOptional({ description: 'Name of the individual' })
  @IsString()
  @IsOptional()
  name?: string;
}
