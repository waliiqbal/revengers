/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationLogDocument = NotificationLog & Document;

// Admin ne jo bhi push / email bheja uska record (dashboard me history)
@Schema({ timestamps: true, collection: 'notifications' })
export class NotificationLog {
  @Prop({ type: String, enum: ['push', 'email'], required: true })
  channel: string;

  @Prop({ type: String, enum: ['all', 'players'], required: true })
  audience: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  userIds?: Types.ObjectId[];   // audience = players

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ type: String, enum: ['sending', 'done', 'failed'], default: 'sending' })
  status?: string;

  @Prop({ default: 0 }) targeted?: number;    // kitne players chune gaye
  @Prop({ default: 0 }) reachable?: number;   // jin ke paas token / email hai
  @Prop({ default: 0 }) sent?: number;
  @Prop({ default: 0 }) failed?: number;
  @Prop({ default: null }) error?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  sentBy?: Types.ObjectId;

  createdAt?: Date;
}

export const NotificationLogSchema = SchemaFactory.createForClass(NotificationLog);
NotificationLogSchema.index({ createdAt: -1 });
