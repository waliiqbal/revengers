/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { AdminService } from './admin.service';
import { LeaderboardQueryDto, ListPlayersQueryDto } from './dto/admin-query.dto';
import { BanPlayerDto } from './dto/ban-player.dto';
import { RewardSettingsDto } from './dto/reward-settings.dto';
import { SettingsService } from '../settings/settings.service';

// 🔐 is controller ke saare routes sirf admin ke liye hain
@ApiTags('Admin')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Admin role required' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly settingsService: SettingsService,
  ) {}

  // 🎁 Reward numbers (multiplayer + story) — agle match / stage se lagu hote hain
  @Get('settings/rewards')
  @ApiOperation({ summary: 'Current reward settings, the defaults, and who changed them last' })
  async getRewardSettings() {
    return { message: 'Reward settings', data: await this.settingsService.getRewardsWithMeta() };
  }

  @Put('settings/rewards')
  @ApiOperation({ summary: 'Save reward settings (applies to the next match / story stage; past results are not changed)' })
  @ApiBody({ type: RewardSettingsDto })
  async saveRewardSettings(@Req() req, @Body() body: RewardSettingsDto) {
    return { message: 'Reward settings saved', data: await this.settingsService.saveRewards(req.user.userId, body as any) };
  }

  @Post('settings/rewards/reset')
  @ApiOperation({ summary: 'Put every reward back to its default value' })
  async resetRewardSettings(@Req() req) {
    return { message: 'Reward settings reset to defaults', data: await this.settingsService.resetRewards(req.user.userId) };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard numbers: players, bans, new signups, games' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('players')
  @ApiOperation({ summary: 'List players with search, status filter, sorting and pagination' })
  async listPlayers(@Query() query: ListPlayersQueryDto) {
    return this.adminService.listPlayers(query);
  }

  @Get('players/:id')
  @ApiOperation({ summary: 'Get one player with their last 10 games' })
  async getPlayer(@Param('id') id: string) {
    return this.adminService.getPlayer(id);
  }

  @Patch('players/:id/ban')
  @ApiOperation({ summary: 'Ban a player (blocks login and all API access immediately)' })
  @ApiBody({ type: BanPlayerDto })
  async banPlayer(@Req() req, @Param('id') id: string, @Body() body: BanPlayerDto) {
    return this.adminService.banPlayer(req.user.userId, id, body.reason);
  }

  @Patch('players/:id/unban')
  @ApiOperation({ summary: 'Unban a player' })
  async unbanPlayer(@Req() req, @Param('id') id: string) {
    return this.adminService.unbanPlayer(req.user.userId, id);
  }

  @Delete('players/:id')
  @ApiOperation({ summary: 'Remove a player (soft delete, can be restored)' })
  async removePlayer(@Req() req, @Param('id') id: string) {
    return this.adminService.removePlayer(req.user.userId, id);
  }

  @Patch('players/:id/restore')
  @ApiOperation({ summary: 'Restore a removed player' })
  async restorePlayer(@Req() req, @Param('id') id: string) {
    return this.adminService.restorePlayer(req.user.userId, id);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Leaderboard (excludes banned, removed and admin accounts)' })
  async getLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.adminService.getLeaderboard(query);
  }
}
