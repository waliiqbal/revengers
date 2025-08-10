/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop()
  name?: string;

  @Prop({ unique: true, required: true })
  email: string;

  @Prop()
  password?: string;

  @Prop()
  authProvider?: string;

  @Prop()
  coins?: number;

  @Prop()
  diamonds?: number;

  @Prop()
  gems?: number;

  @Prop()
  trophies?: number;

  @Prop()
  providerId?: string;

  @Prop({
    type: [
      {
        characterId: { type: Types.ObjectId, ref: 'Store' },
        name: String,
        maxHealth: Number,
        attack: Number,
        defense: Number,
        speed: Number,
        specialPower: String,
        level: { type: Number, default: 1 },
        experience: { type: Number, default: 0 },
      }
    ],
    default: []
  })
  ownedCharacters: {
    characterId: Types.ObjectId;
    name: string;
    maxHealth: number;
    attack: number;
    defense: number;
    speed: number;
    specialPower: string;
    level: number;
    experience: number;
  }[];
}




export const UserSchema = SchemaFactory.createForClass(User);
