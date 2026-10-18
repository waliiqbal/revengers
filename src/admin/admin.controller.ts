/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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

// 🔐 is controller ke saare routes sirf admin ke liye hain
@ApiTags('Admin')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Admin role required' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
