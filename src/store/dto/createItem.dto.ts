/* eslint-disable prettier/prettier */
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  itemType: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  image: string;

  @IsString()
  @IsNotEmpty()
  shortCode: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  googleId?: string;

  @IsString()
  @IsOptional()
  appleId?: string;

  @IsString()
  @IsOptional()
  addedBy?: string;

  @IsNumber()
  @IsNotEmpty()
  maxHealth: number;

  @IsNumber()
  @IsNotEmpty()
  attack: number;

  @IsNumber()
  @IsNotEmpty()
  defense: number;

  @IsNumber()
  @IsNotEmpty()
  speed: number;

  @IsString()
  @IsNotEmpty()
  specialPower: string;
}


