/* eslint-disable prettier/prettier */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';

export class AscensionStarDto {
  @ApiProperty({ example: 50 }) @Type(() => Number) @IsInt() @Min(0) @Max(10000000)
  diamonds: number;

  @ApiProperty({ example: 25 }) @Type(() => Number) @IsInt() @Min(0) @Max(10000000)
  minWins: number;

  @ApiProperty({ example: 20 }) @Type(() => Number) @IsInt() @Min(0) @Max(1000)
  minLevel: number;

  @ApiProperty({ example: 0, description: '0 = no chapter needed' }) @Type(() => Number) @IsInt() @Min(0) @Max(100)
  chapter: number;

  @ApiProperty({ example: 5 }) @Type(() => Number) @IsInt() @Min(0) @Max(1000)
  attackBonus: number;
}

export class AscensionSettingsDto {
  @ApiProperty({ type: [AscensionStarDto], description: 'Exactly 5 entries: 1 star .. 5 stars' })
  @IsArray() @ArrayMinSize(5) @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => AscensionStarDto)
  stars: AscensionStarDto[];

  @ApiPropertyOptional({ example: 12, description: 'How many characters the game has' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  maxCharacters?: number;
}

export class CharacterUnlockDto {
  @ApiProperty({ example: 1, description: 'Game character index (0 = first character)' })
  @Type(() => Number) @IsInt() @Min(0) @Max(99)
  index: number;

  @ApiProperty({ example: 200, description: '0 = free for everyone' })
  @Type(() => Number) @IsInt() @Min(0) @Max(10000000)
  price: number;

  @ApiProperty({ enum: ['gem', 'coin'], example: 'gem' })
  @IsIn(['gem', 'coin'])
  currency: string;
}

export class UnlockSettingsDto {
  @ApiProperty({ type: [CharacterUnlockDto] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => CharacterUnlockDto)
  characters: CharacterUnlockDto[];
}
