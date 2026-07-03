import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateIndividualDto {
  @ApiProperty({ description: 'The parent user ID this dependent belongs to' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Name of the individual' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'The company ID this individual belongs to' })
  @IsUUID()
  @IsOptional()
  companyId?: string;
}
