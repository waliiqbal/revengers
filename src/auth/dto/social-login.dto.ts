/* eslint-disable prettier/prettier */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SocialLoginDto {
  @ApiProperty({ example: 'google', description: 'Only google is supported for now (apple / facebook coming later)' })
  @IsNotEmpty()
  @IsString()
  @IsIn(['google', 'apple', 'facebook'])
  authProvider: string;

  // 🔐 Google ka signed ID token (Unity: PlayGamesPlatform.Instance.GetIdToken()).
  // Server isko Google se verify karta hai — email / user id isi token se liye jate hain, body se nahi.
  @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIs...' })
  @IsNotEmpty()
  @IsString()
  idToken: string;

  @ApiPropertyOptional({ example: 'Huzaifa' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'firebase-fcm-token' })
  @IsOptional()
  @IsString()
  fcmToken?: string;
}
