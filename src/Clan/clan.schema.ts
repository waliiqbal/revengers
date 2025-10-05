/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ClanDocument = Clan & Document;

@Schema({ timestamps: true })
export class Clan {
  @Prop({ required: true })   clanName: string;   

  @Prop({ default: "" })
  clanDisplayPic?: string; // clan ka profile pic

  @Prop({ default: 1 })
  clanLevel?: number; // clan ka level (game progression k hisaab se)

  @Prop({ default: "active" })
  clanStatus?: string; // "active", "inactive", "banned" etc

  @Prop({ default: 0 })
  clanTotalWin?: number; // total matches won by clan

  @Prop({ default: 0 })
  clanTotalLose?: number; // total matches lost by clan

  @Prop({ default: 1 })
  clanCurrentMembers?: number; // abhi kitne members hain

  @Prop({ default: 50 })
  clanMembersMaxLimit?: number; // maximum allowed members

  // 👇 optional but recommended
  @Prop({ type: Types.ObjectId, ref: "User" })
  leader: Types.ObjectId; 

  @Prop({ type: [{ type: Types.ObjectId, ref: "User" }], default: [] })
  members: Types.ObjectId[]; 
}

export const ClanSchema = SchemaFactory.createForClass(Clan);
