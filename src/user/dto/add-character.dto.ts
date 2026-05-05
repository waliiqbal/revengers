/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AddCharacterDto {
  @ApiProperty({ example: '662f7f8b3a4f123456789abc' })
  @IsString()
  storeItemId: string;
}