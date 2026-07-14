import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin@scannel.com',
    description: 'The email address of the user',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'password123',
    description: 'The password of the user',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({
    example: 'web',
    description: 'The client channel making the login request ("web" or "mobile"). Defaults to "web".',
    enum: ['web', 'mobile'],
  })
  @IsOptional()
  @IsIn(['web', 'mobile'])
  clientType?: 'web' | 'mobile' = 'web';
}

