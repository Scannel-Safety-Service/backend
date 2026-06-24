import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John', description: 'The first name of the user' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'The last name of the user' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: 'user@example.com', description: 'The email of the user' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'password123', description: 'The password of the user' })
  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ example: 'USR-002', description: 'The unique user code within the company' })
  @IsString()
  @IsOptional()
  userCode?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the user account is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
