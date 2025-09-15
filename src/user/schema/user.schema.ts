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

@Prop({ required: false, unique: true })
  providerId?: string;
  
  @Prop({ required: false  })
  authProvider?: string;


  @Prop()
  password?: string;   // optional, no default
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
