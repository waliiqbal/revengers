/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
// eslint-disable-next-line prettier/prettier

export type GameDocument = Game & Document;

@Schema({ timestamps: true })
export class Game {

      @Prop({
    type: [
      {
        user: { type: Types.ObjectId, ref: 'User' },
        score: { type: Number, default: 0 },
        kills: { type: Number, default: 0 },
        deaths: { type: Number, default: 0 },
        assists: { type: Number, default: 0 },
        result: { type: Boolean, default: false },
      },
    ],
    default: [],
  })
  players: {
    user: Types.ObjectId;
    score: number;
    kills: number;
    deaths: number;
    assists: number;
    result?: boolean;
  }[];

  @Prop({ default: Date.now })
  createdAt: Date;
}

    

    export const GameSchema = SchemaFactory.createForClass(Game);