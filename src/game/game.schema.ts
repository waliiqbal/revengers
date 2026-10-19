/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type GameDocument = Game & Document;

export type Team = 'TeamA' | 'TeamB';
export type Outcome = 'won' | 'lost' | 'draw' | 'left';

export interface MatchRewards {
  trophies: number;
  xp: number;
  coins: number;
}

export interface GamePlayer {
  user: Types.ObjectId;
  team: Team;
  isHost: boolean;
  joinedAt: Date;
  // 👇 match khatam hone ke baad server bharta hai
  outcome?: Outcome | null;
  result?: boolean;          // won = true (purane admin panel ke liye)
  score?: number;            // MVP score = kills × 2 + assists
  kills?: number;
  deaths?: number;
  assists?: number;
  mvpRank?: number;          // 1, 2, 3 ya 0
  rewards?: MatchRewards | null;
}

export interface GameReport {
  user: Types.ObjectId;
  hash: string;              // same scoreboard → same hash
  payload: any;
  at: Date;
}

@Schema({ timestamps: true })
export class Game {
  // Nakama match id — har device pe same hota hai, isi se sab players ek hi match join karte hain
  @Prop({ type: String, unique: true, sparse: true })
  matchKey?: string;

  @Prop({ type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' })
  status?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  hostUser?: Types.ObjectId;

  @Prop({
    type: [
      {
        _id: false,
        user: { type: Types.ObjectId, ref: 'User' },
        team: { type: String, enum: ['TeamA', 'TeamB'] },
        isHost: { type: Boolean, default: false },
        joinedAt: { type: Date, default: Date.now },
        outcome: { type: String, enum: ['won', 'lost', 'draw', 'left', null], default: null },
        result: { type: Boolean, default: false },
        score: { type: Number, default: 0 },
        kills: { type: Number, default: 0 },
        deaths: { type: Number, default: 0 },
        assists: { type: Number, default: 0 },
        mvpRank: { type: Number, default: 0 },
        rewards: { type: MongooseSchema.Types.Mixed, default: null },
      },
    ],
    default: [],
  })
  players: GamePlayer[];

  @Prop({
    type: [{ _id: false, user: { type: Types.ObjectId, ref: 'User' }, hash: String, payload: MongooseSchema.Types.Mixed, at: Date }],
    default: [],
  })
  reports?: GameReport[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  hostLeftReports?: Types.ObjectId[];

  @Prop({ type: String, enum: ['TeamA', 'TeamB', 'draw', null], default: null })
  winnerTeam?: string;

  @Prop({ default: 0 })
  teamAScore?: number;

  @Prop({ default: 0 })
  teamBScore?: number;

  @Prop({ default: 0 })
  durationSeconds?: number;

  @Prop({ type: String, enum: ['reported', 'timeout', 'host_left', 'expired', 'too_short', null], default: null })
  endReason?: string;

  @Prop({ default: null })
  endedAt?: Date;

  // rewards users pe lag gaye ya nahi (crash ke baad dobara try karne ke liye)
  @Prop({ default: false })
  rewardsApplied?: boolean;

  createdAt?: Date;
}

export const GameSchema = SchemaFactory.createForClass(Game);
GameSchema.index({ 'players.user': 1, createdAt: -1 });
GameSchema.index({ status: 1, createdAt: 1 });
GameSchema.index({ createdAt: -1 });
