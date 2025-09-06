/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type clanRequestDocument = clanRequest & Document;

@Schema({ timestamps: true })
export class clanRequest {
@Prop({ type: Types.ObjectId, ref: "Clan", required: true })
  clanId: Types.ObjectId;  // kis clan ke liye request hai

  @Prop({ type: Types.ObjectId, ref: "User" })
  senderId?: Types.ObjectId; 

  

  @Prop({
    type: String,
    enum: ["pending", "open", "close"],
    default: "pending"
  })
  status?: string; 

  
  @Prop({ type: Boolean, default: false })
  isDeleted?: boolean;

  @Prop({ type: String, required: false })
  senderName?: string;

  @Prop({ type: String, required: false })
  clanName?: string;

}

export const clanRequestSchema = SchemaFactory.createForClass(clanRequest);