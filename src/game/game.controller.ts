/* eslint-disable prettier/prettier */
import { Controller, Get, Param, Put, Delete, Body, Req, Patch , Post} from '@nestjs/common';
import { GameService } from './game.service'

@Controller('Game')
export class gameController {
  constructor(private readonly GameService: GameService) {}

  // 🔍 GET /users → Get all users

 @Post('startGame')
  async startGame(@Body('playersId') playersId: string[]) {
    return this.GameService.startGameService(playersId);
  }

  @Post('GameWon')
  async gameWon(
    @Body('gameId') gameId: string,
    @Body('players') players: { 
      playerId: string; 
      score: number; 
      kills: number; 
      deaths: number; 
      assists: number; 
      result: boolean; 
    }[],
  ) {
    return this.GameService.gameWon(gameId, players);
  }
}
