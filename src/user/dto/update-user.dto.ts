/* eslint-disable prettier/prettier */
import { IsOptional, IsString, IsMongoId, IsObject } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsMongoId()
  characterId?: string;

  @IsOptional()
  @IsObject()
  updateCharacterFields?: {
    name?: string;
    maxHealth?: number;
    attack?: number;
    defense?: number;
    speed?: number;
    specialPower?: string;
    level?: number;
    experience?: number;
  };
}
