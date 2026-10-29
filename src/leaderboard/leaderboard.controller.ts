/* eslint-disable prettier/prettier */
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LeaderboardService, PUBLIC_LEADERBOARD_FIELDS } from './leaderboard.service';

export class PublicLeaderboardQueryDto {
  @ApiPropertyOptional({ enum: PUBLIC_LEADERBOARD_FIELDS, default: 'trophies' })
  @IsOptional()
  @IsIn(PUBLIC_LEADERBOARD_FIELDS)
  sortBy?: string = 'trophies';

  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 50;
}

// 🏆 Game ke andar ki leaderboard (admin wali /admin/leaderboard alag hai aur usme emails bhi hain)
@ApiTags('Leaderboard')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Unauthorized' })
@UseGuards(AuthGuard('jwt'))
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: 'Top players by trophies, level, wins or kills, plus the logged-in player\'s own rank ("me")' })
  async get(@Req() req, @Query() query: PublicLeaderboardQueryDto) {
    return this.leaderboardService.getLeaderboard(req.user.userId, query.sortBy, query.page, query.limit);
  }
}
