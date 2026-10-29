/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
@Prop({ required: true, unique: true })
  email: string;

  @Prop({ default: '' })
  name?: string;

  @Prop({ default: null })
  fcmToken?: string;

  @Prop({ default: '' })
  displayPic?: string;

  @Prop({ default: 1 })  // naya user hamesha level 1 pe hoga
  level?: number;

  @Prop({ default: 0 })  // naya user ka xp 0
  currentXp?: number;

  @Prop({ default: 0 })
  totalXp?: number;

  @Prop({ default: 0 })
  gem?: number;

  @Prop({ default: 0 })
  diamond?: number;

  @Prop({ default: 0 })
  coin?: number;

  @Prop({ default: 0 })  // ranked matches se milte hain; level inhi se badhta hai (src/game/rewards.ts)
  trophies?: number;

  // 📖 story mode (src/story/story-rewards.ts)
  @Prop({ default: 0 })  // story stages se milte hain
  skillPoints?: number;

  @Prop({ default: 0 })  // sab se aakhri clear kiya hua stage (0 = abhi koi nahi)
  storyStage?: number;

  @Prop({ type: [Number], default: [] })  // poore kiye hue chapters — ascension (2 Stars = chapter 1) ke liye
  chaptersCompleted?: number[];

  // ⭐ har character ke stars (key = game ka character index "0", "1", ...) — src/characters
  @Prop({ type: Map, of: Number, default: {} })
  characterStars?: Map<string, number>;

  // abhi chal raha story stage (start → complete) — ek waqt me ek
  @Prop({ type: Object, default: null })
  storyRun?: { id: string; stage: number; startedAt: Date } | null;

  @Prop({ default: 0 })
  totalMatch?: number;

  @Prop({ default: 0 })
  won?: number;

  @Prop({ default: 0 })
  lost?: number;

  @Prop({ default: 0 })
  kills?: number;

  @Prop({ default: 0 })
  death?: number;

  @Prop({ default: 0 })
  assists?: number;

  @Prop({ default: 0 })
  hours?: number;

  @Prop({ default: '' })
  availableSkill?: string;

@Prop({ required: false, unique: true, sparse: true })  // sparse: email/password users ke paas providerId nahi hota
  providerId?: string;
  
  @Prop({ required: false  })
  authProvider?: string;


  @Prop()
  password?: string;   // optional, no default

  // 👇 admin panel fields
  @Prop({ type: String, enum: ['player', 'admin'], default: 'player' })
  role?: string;

  @Prop({ default: false })
  isBanned?: boolean;

  @Prop({ default: null })
  banReason?: string;

  @Prop({ default: null })
  bannedAt?: Date;

  @Prop({ default: false })  // admin ne remove kiya (soft delete)
  isDeleted?: boolean;

  @Prop({ default: null })
  deletedAt?: Date;
}
  // @Prop({
  //   type: [
  //     {
  //       characterId: { type: Types.ObjectId, ref: 'Store' },
  //       name: String,
  //       maxHealth: Number,
  //       attack: Number,
  //       defense: Number,
  //       speed: Number,
  //       specialPower: String,
  //       level: { type: Number, default: 1 },
  //       experience: { type: Number, default: 0 },
  //     }
  //   ],
  //   default: []
  // })
  // ownedCharacters: {
  //   characterId: Types.ObjectId;
  //   name: string;
  //   maxHealth: number;
  //   attack: number;
  //   defense: number;
  //   speed: number;
  //   specialPower: string;
  //   level: number;
  //   experience: number;
  // }[];





export const UserSchema = SchemaFactory.createForClass(User);
