/* eslint-disable prettier/prettier */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class ResendOtpDto {
  @ApiProperty({ example: 'test@gmail.com' })
  @IsEmail()
  email: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'test@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit code from the email' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code' })
  code: string;

  @ApiPropertyOptional({ example: 'firebase-fcm-token' })
  @IsOptional()
  @IsString()
  fcmToken?: string;
}
