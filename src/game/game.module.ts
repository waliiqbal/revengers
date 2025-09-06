/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';

import { gameController } from './game.controller';
import { GameService } from './game.service';

@Module({
 
  controllers: [gameController],
  providers: [GameService],
  exports: [GameService], 
})
export class gameModule {}
