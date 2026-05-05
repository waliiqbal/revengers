/* eslint-disable prettier/prettier */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'Huzaifa' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'test@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '12345678' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: 'firebase-fcm-token' })
  @IsOptional()
  @IsString()
  fcmToken?: string;
}