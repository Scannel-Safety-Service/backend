import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'John',
    description: 'The first name of the user',
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({
    example: 'Doe',
    description: 'The last name of the user',
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({
    example: 'USR-002',
    description: 'The unique user code within the company',
  })
  @IsString()
  @IsOptional()
  userCode?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the user account is active',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
