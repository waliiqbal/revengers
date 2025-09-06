/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
// import { ItemType } from "./constants/item.type.enum";

export type StoreDocument = Store & Document;



@Schema({ timestamps: true })
export class Store {
@Prop()
characterName?: string;   // optional

@Prop({ unique: true })   // sirf unique rakha, required hata diya
shortcode?: string;       

@Prop({ type: Boolean, default: false })
unlock?: boolean;         

@Prop({ type: Number })
range?: number;          

@Prop({ type: Number })
damage?: number;         

@Prop({ type: Number })
durability?: number;      

@Prop()
desc?: string;   

}




export const StoreSchema = SchemaFactory.createForClass(Store);
