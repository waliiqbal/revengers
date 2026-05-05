/* eslint-disable prettier/prettier */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SocialLoginDto {
  @ApiProperty({ example: 'google' })
  @IsNotEmpty()
  @IsString()
  authProvider: string;

  @ApiProperty({ example: 'google-user-id-123' })
  @IsNotEmpty()
  @IsString()
  socialId: string;

  @ApiPropertyOptional({ example: 'Huzaifa' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'test@gmail.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'https://image-url.com/profile.png' })
  @IsOptional()
  @IsString()
  displayPic?: string;

  @ApiPropertyOptional({ example: 'firebase-fcm-token' })
  @IsOptional()
  @IsString()
  fcmToken?: string;
}