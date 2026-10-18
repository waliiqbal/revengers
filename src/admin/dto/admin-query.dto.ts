/* eslint-disable prettier/prettier */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const LEADERBOARD_FIELDS = ['totalXp', 'level', 'won', 'kills', 'totalMatch', 'hours'];
export const PLAYER_SORT_FIELDS = [...LEADERBOARD_FIELDS, 'createdAt', 'name', 'email'];

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ListPlayersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by name or email', example: 'huzaifa' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['all', 'active', 'banned', 'removed'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'active', 'banned', 'removed'])
  status?: string = 'all';

  @ApiPropertyOptional({ enum: PLAYER_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(PLAYER_SORT_FIELDS)
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: string = 'desc';
}

export class LeaderboardQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: LEADERBOARD_FIELDS, default: 'totalXp' })
  @IsOptional()
  @IsIn(LEADERBOARD_FIELDS)
  sortBy?: string = 'totalXp';
}
