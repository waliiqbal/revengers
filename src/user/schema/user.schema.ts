/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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
}

export const UserSchema = SchemaFactory.createForClass(User);
