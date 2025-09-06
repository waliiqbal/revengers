/* eslint-disable prettier/prettier */
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateStoreDto {
@IsOptional()
  @IsString()
  characterName?: string;

  @IsOptional()
  @IsString()
  shortcode?: string;

  @IsOptional()
  @IsBoolean()
  unlock?: boolean;

  @IsOptional()
  @IsNumber()
  range?: number;

  @IsOptional()
  @IsNumber()
  damage?: number;

  @IsOptional()
  @IsNumber()
  durability?: number;

  @IsOptional()
  @IsString()
  desc?: string;
}

