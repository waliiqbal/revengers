/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ShopItemDocument = ShopItem & Document;

// Store ke tabs — har tab ke cards game ke Store_Screen me fixed hain (slot = card number)
export const SHOP_SECTIONS = ['coins', 'gems', 'diamonds', 'weapons'];

// Har tab ki price kis cheez me hai (game ke icons aur buy logic isi hisaab se bane hain)
export const SECTION_PRICE_CURRENCY: Record<string, string> = {
  coins: 'usd',        // asli paise — in-app purchase
  gems: 'coin',        // coins de kar gems
  diamonds: 'gem',     // gems de kar diamonds
  weapons: 'diamond',  // abhi sirf dikhte hain, game me weapon system nahi
};

@Schema({ timestamps: true, collection: 'shopitems' })
export class ShopItem {
  @Prop({ type: String, enum: SHOP_SECTIONS, required: true })
  section: string;

  @Prop({ required: true })
  slot: number;              // game ka card number (1 = pehla card)

  @Prop({ default: '' })
  title: string;             // "Bundle 1", "PACK NO 1", "Weapon 1"

  @Prop({ default: 0 })
  amount: number;            // kitne coins / gems / diamonds milte hain (weapons: 0)

  @Prop({ default: '' })
  description?: string;      // weapons card ka text; baaki me khali = game "100 Coins" khud banata hai

  @Prop({ default: 0 })
  price: number;             // usd me (4.99) ya coins / gems / diamonds me

  @Prop({ default: '' })
  iosProductId?: string;     // App Store Connect product ID

  @Prop({ default: '' })
  androidProductId?: string; // Google Play Console product ID

  @Prop({ default: true })
  active: boolean;           // false = game me card chhup jata hai

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy?: Types.ObjectId;

  updatedAt?: Date;
}

export const ShopItemSchema = SchemaFactory.createForClass(ShopItem);
ShopItemSchema.index({ section: 1, slot: 1 }, { unique: true });
