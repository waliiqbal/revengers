/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
// import { ItemType } from "./constants/item.type.enum";

export type FriendDocument = Friend & Document;



@Schema({ timestamps: true })
export class Friend {
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  senderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  receiverId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['open', 'close', 'pending'],
    default: "pending",
  })
  status?: string;

  @Prop({ type: Boolean, default: false })
  isDeleted?: boolean;

  @Prop({ type: String, required: false })
  senderName?: string;

  @Prop({ type: String, required: false })
  receiverName?: string;
}

export const FriendSchema = SchemaFactory.createForClass(Friend);
