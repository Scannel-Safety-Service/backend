import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterDeviceTokenDto {
  @ApiProperty({
    description: 'OneSignal push subscription ID (returned by OneSignal SDK)',
    example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  })
  @IsString()
  @IsNotEmpty()
  subscriptionId: string;

  @ApiPropertyOptional({
    description: 'Device platform type',
    enum: ['ios', 'android'],
    example: 'android',
  })
  @IsString()
  @IsIn(['ios', 'android'])
  @IsOptional()
  deviceType?: 'ios' | 'android';
}
