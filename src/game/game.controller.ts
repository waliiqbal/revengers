/* eslint-disable prettier/prettier */
import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GameService } from './game.service';
import { GameWonDto, MatchKeyDto, StartGameDto } from './dto/match.dto';

// 🎮 Match results — har player ka game khud call karta hai, rewards server decide karta hai
@ApiTags('Game')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Unauthorized' })
@UseGuards(AuthGuard('jwt'))
@Controller('Game')
export class gameController {
  constructor(private readonly GameService: GameService) {}

  @Post('startGame')
  @ApiOperation({ summary: 'Join (or create) a match when the local player spawns' })
  @ApiBody({ type: StartGameDto })
  async startGame(@Req() req, @Body() body: StartGameDto) {
    return this.GameService.startGame(req.user.userId, body);
  }

  @Post('GameWon')
  @ApiOperation({ summary: 'Report the final scoreboard. Rewards are applied once 2 reports agree (or after 2 minutes).' })
  @ApiBody({ type: GameWonDto })
  async gameWon(@Req() req, @Body() body: GameWonDto) {
    return this.GameService.reportResult(req.user.userId, body);
  }

  @Post('hostLeft')
  @ApiOperation({ summary: 'Report that the host disconnected before the match ended' })
  @ApiBody({ type: MatchKeyDto })
  async hostLeft(@Req() req, @Body() body: MatchKeyDto) {
    return this.GameService.reportHostLeft(req.user.userId, body.matchKey);
  }

  @Get('result')
  @ApiOperation({ summary: "Get the caller's result and rewards for a match" })
  @ApiQuery({ name: 'matchKey', required: true })
  async result(@Req() req, @Query() query: MatchKeyDto) {
    return this.GameService.getResult(req.user.userId, query.matchKey);
  }
}
