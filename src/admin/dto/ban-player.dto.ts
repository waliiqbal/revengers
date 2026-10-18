/* eslint-disable prettier/prettier */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BanPlayerDto {
  @ApiPropertyOptional({ example: 'Cheating in ranked matches' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
