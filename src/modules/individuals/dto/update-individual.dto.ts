import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateIndividualDto {
  @ApiPropertyOptional({ description: 'First name of the individual' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name of the individual' })
  @IsString()
  @IsOptional()
  lastName?: string;
}
