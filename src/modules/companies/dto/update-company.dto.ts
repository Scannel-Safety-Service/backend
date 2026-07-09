import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCompanyDto {
  @ApiPropertyOptional({
    example: 'Acme Corporation Ltd.',
    description: 'The updated name of the company',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'admin@acme.com',
    description: 'The updated email of the company admin',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: 'newpassword123',
    description: 'The updated password of the company admin',
  })
  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;
}
