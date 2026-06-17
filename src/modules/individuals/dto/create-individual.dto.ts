import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateIndividualDto {
  @ApiProperty({ description: 'The parent user ID this dependent belongs to' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'First name of the individual' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Last name of the individual' })
  @IsString()
  @IsNotEmpty()
  lastName: string;
}
