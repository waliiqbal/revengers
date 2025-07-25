/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
// import { ItemType } from "./constants/item.type.enum";

export type StoreDocument = Store & Document;



@Schema({ timestamps: true })
export class Store {
  @Prop({required: true})
  itemType: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  image: string;

  @Prop({ required: true })
  shortCode: string;

  @Prop()
  price: number;

  @Prop({default: true})
  isActive: boolean;

  @Prop()
  googleId: string;

  @Prop()
  appleId: string;

  @Prop({default: "admin"})
  addedBy: string;

  // 🔥 Character Attributes (important part)
  @Prop({ required: true })
  maxHealth: number;

  @Prop({ required: true })
  attack: number;

  @Prop({ required: true })
  defense: number;

  @Prop({ required: true })
  speed: number;

  @Prop({ required: true })
  specialPower: string; // e.g., "Flame Burst"
}




export const StoreSchema = SchemaFactory.createForClass(Store);
