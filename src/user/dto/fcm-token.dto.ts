/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class FcmTokenDto {
  @ApiProperty({ description: 'Firebase Cloud Messaging registration token from the device' })
  @IsString()
  @Length(10, 4096)
  fcmToken: string;
}
