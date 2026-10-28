/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SupportTicketDocument = SupportTicket & Document;

export const TICKET_CATEGORIES = ['bug', 'feedback', 'account', 'payment', 'report_player', 'other'];
export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

@Schema({ _id: false, timestamps: false })
export class TicketMessage {
  @Prop({ type: String, enum: ['player', 'admin'], required: true })
  from: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  adminId?: Types.ObjectId;   // kis admin ne jawab diya (player ko sirf "Support Team" dikhta hai)

  @Prop({ required: true })
  text: string;

  @Prop({ default: Date.now })
  createdAt?: Date;
}
const TicketMessageSchema = SchemaFactory.createForClass(TicketMessage);

// Player ki feedback / shikayat / support request — game se aati hai, admin dashboard se jawab jata hai
@Schema({ timestamps: true, collection: 'supporttickets' })
export class SupportTicket {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ default: '' }) playerName?: string;    // ticket banate waqt ka naam / email (record ke liye)
  @Prop({ default: '' }) playerEmail?: string;

  @Prop({ type: String, enum: TICKET_CATEGORIES, required: true })
  category: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ type: String, enum: TICKET_STATUSES, default: 'open' })
  status?: string;

  @Prop({ type: [TicketMessageSchema], default: [] })
  messages?: TicketMessage[];

  // device info: bug reports ke liye kaam aata hai
  @Prop({ default: '' }) appVersion?: string;
  @Prop({ default: '' }) platform?: string;
  @Prop({ default: '' }) deviceModel?: string;

  @Prop({ default: false }) unreadForPlayer?: boolean;  // admin ne jawab diya, player ne abhi nahi dekha
  @Prop({ default: true }) unreadForAdmin?: boolean;    // player ne likha, admin ne abhi nahi dekha

  @Prop({ default: Date.now })
  lastMessageAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);
SupportTicketSchema.index({ user: 1, lastMessageAt: -1 });
SupportTicketSchema.index({ status: 1, lastMessageAt: -1 });
