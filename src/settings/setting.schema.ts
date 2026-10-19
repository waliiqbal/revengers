/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type SettingDocument = Setting & Document;

// Admin dashboard se badalne wali game settings — har setting ek document (key = _id)
@Schema({ timestamps: true })
export class Setting {
  @Prop({ type: String })
  _id: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  value: any;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy?: Types.ObjectId;

  updatedAt?: Date;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);
