/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';


import { Types,  } from 'mongoose';





import { DatabaseService } from "src/database/databaseservice";

 @Injectable()
 export class GameService {
   constructor(

    private databaseService: DatabaseService,
   ) {}

   async startGameService(playersId: string[]) {
    // players array create karna with defaults
    const players = playersId.map((id) => ({
      user: new Types.ObjectId(id),
      score: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      result: false,
    }));

      const newGame = new this.databaseService.repositories.gameModel({
    players,
  });

  // save karo
  const savedGame = await newGame.save();

  // proper response return karo
  return {
    message: 'Game successfully started',
    data: {
      gameId: savedGame._id,
    },
  };
}


async gameWon(
    gameId: string,
    players: {
      playerId: string;
      score: number;
      kills: number;
      deaths: number;
      assists: number;
      result: boolean;
    }[],
  ) {
    const game = await this.databaseService.repositories.gameModel.findById(gameId);
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // players array update karna
    for (const playerUpdate of players) {
      const player = game.players.find(
        (p) => p.user.toString() === playerUpdate.playerId,
      );
      if (player) {
        player.score = playerUpdate.score;
        player.kills = playerUpdate.kills;
        player.deaths = playerUpdate.deaths;
        player.assists = playerUpdate.assists;
        player.result = playerUpdate.result;
      }
    }

    return await game.save();
  }
}
  