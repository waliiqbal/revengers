/* eslint-disable prettier/prettier */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MATCH_RULES } from '../rewards';

export class MatchKeyDto {
  @ApiProperty({ description: 'Nakama match id (same on every device in the match)', example: '7d1e0c3a-match-id' })
  @IsString()
  @Length(1, 128)
  matchKey: string;
}

export class StartGameDto extends MatchKeyDto {
  @ApiProperty({ enum: ['TeamA', 'TeamB'] })
  @IsIn(['TeamA', 'TeamB'])
  team: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isHost?: boolean;
}

export class ScoreboardEntryDto {
  @ApiProperty({ example: '6ad4bf8d8a237d46f30f712a' })
  @IsMongoId()
  userId: string;

  @ApiProperty({ enum: ['TeamA', 'TeamB'] })
  @IsIn(['TeamA', 'TeamB'])
  team: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(0)
  @Max(MATCH_RULES.maxKills)
  kills: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  @Max(MATCH_RULES.maxKills)
  deaths: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(0)
  @Max(MATCH_RULES.maxKills)
  assists: number;
}

export class GameWonDto extends MatchKeyDto {
  @ApiProperty({ enum: ['TeamA', 'TeamB', 'draw'] })
  @IsIn(['TeamA', 'TeamB', 'draw'])
  winnerTeam: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(0)
  @Max(1000)
  teamAScore: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  @Max(1000)
  teamBScore: number;

  @ApiProperty({ example: 300 })
  @IsNumber()
  @Min(0)
  @Max(3600)
  durationSeconds: number;

  @ApiProperty({ type: [ScoreboardEntryDto], description: 'Every player still in the match at the end' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MATCH_RULES.maxPlayers)
  @ValidateNested({ each: true })
  @Type(() => ScoreboardEntryDto)
  scoreboard: ScoreboardEntryDto[];
}
