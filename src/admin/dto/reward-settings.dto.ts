/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Max, Min, ValidateNested } from 'class-validator';

// Sab whole numbers, 0 ya zyada — galti se negative / bohot bara number save na ho
const MAX_AMOUNT = 100000;

class TrophyRewardsDto {
  @ApiProperty() @IsInt() @Min(0) @Max(1000) won: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1000) draw: number;
  @ApiProperty({ description: 'Trophies taken away on a loss' }) @IsInt() @Min(0) @Max(1000) lost: number;
  @ApiProperty({ description: 'Trophies taken away for leaving early / host quitting' }) @IsInt() @Min(0) @Max(1000) left: number;
}

class XpRewardsDto {
  @ApiProperty() @IsInt() @Min(0) @Max(MAX_AMOUNT) won: number;
  @ApiProperty() @IsInt() @Min(0) @Max(MAX_AMOUNT) draw: number;
  @ApiProperty() @IsInt() @Min(0) @Max(MAX_AMOUNT) lost: number;
  @ApiProperty() @IsInt() @Min(0) @Max(MAX_AMOUNT) perKill: number;
  @ApiProperty() @IsInt() @Min(0) @Max(MAX_AMOUNT) perAssist: number;
  @ApiProperty() @IsInt() @Min(0) @Max(MAX_AMOUNT) maxPerMatch: number;
}

class CoinRewardsDto {
  @ApiProperty() @IsInt() @Min(0) @Max(MAX_AMOUNT) won: number;
  @ApiProperty() @IsInt() @Min(0) @Max(MAX_AMOUNT) draw: number;
  @ApiProperty() @IsInt() @Min(0) @Max(MAX_AMOUNT) lost: number;
  @ApiProperty() @IsInt() @Min(0) @Max(MAX_AMOUNT) mvp1: number;
  @ApiProperty() @IsInt() @Min(0) @Max(MAX_AMOUNT) mvp2: number;
  @ApiProperty() @IsInt() @Min(0) @Max(MAX_AMOUNT) mvp3: number;
}

class MatchRewardsDto {
  @ApiProperty({ type: TrophyRewardsDto }) @ValidateNested() @Type(() => TrophyRewardsDto) trophies: TrophyRewardsDto;
  @ApiProperty({ type: XpRewardsDto }) @ValidateNested() @Type(() => XpRewardsDto) xp: XpRewardsDto;
  @ApiProperty({ type: CoinRewardsDto }) @ValidateNested() @Type(() => CoinRewardsDto) coins: CoinRewardsDto;
  @ApiProperty({ example: 75 }) @IsInt() @Min(1) @Max(10000) trophiesPerLevel: number;
  @ApiProperty({ example: 60 }) @IsInt() @Min(0) @Max(600) minMatchSeconds: number;
}

class StoryStageRewardDto {
  @ApiProperty() @IsInt() @Min(1) stage: number;
  @ApiProperty() @IsInt() @Min(0) @Max(MAX_AMOUNT) coins: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1000) skillPoints: number;
}

class StoryRewardsDto {
  @ApiProperty({ example: 15 }) @IsInt() @Min(0) @Max(600) minStageSeconds: number;

  @ApiProperty({ type: [StoryStageRewardDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => StoryStageRewardDto)
  stages: StoryStageRewardDto[];
}

export class RewardSettingsDto {
  @ApiProperty({ type: MatchRewardsDto }) @ValidateNested() @Type(() => MatchRewardsDto) match: MatchRewardsDto;
  @ApiProperty({ type: StoryRewardsDto }) @ValidateNested() @Type(() => StoryRewardsDto) story: StoryRewardsDto;
}
