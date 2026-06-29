import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({
    example: 'Acme Corporation',
    description: 'The name of the company',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
