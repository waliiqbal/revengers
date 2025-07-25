/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Store', required: true })
  itemId: Types.ObjectId;

  @Prop({ required: true })
  amount: number;
  
  @Prop()
  paymentMethod?: string; // e.g. 'coins', 'stripe', 'apple', etc.
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);