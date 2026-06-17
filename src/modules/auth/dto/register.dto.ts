import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../../common/enums/role.enum';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'password123', description: 'User password (min length 8)', minLength: 8 })
  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;

  @ApiProperty({ example: 'John', description: 'User first name' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Doe', description: 'User last name' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ enum: Role, example: Role.COMPANY_USER, description: 'Role of the new user' })
  @IsEnum(Role)
  role!: Role;

  @ApiPropertyOptional({ example: 'USR-001', description: 'Human-readable unique user code within company' })
  @IsString()
  @IsOptional()
  userCode?: string;

  @ApiPropertyOptional({ example: 'a87b1c3d-...', description: 'Company ID to associate user with (Super Admin only)' })
  @IsString()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({ example: 'Acme Corp', description: 'New company name to create (Super Admin only)' })
  @IsString()
  @IsOptional()
  companyName?: string;
}
