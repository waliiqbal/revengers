/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { isValidObjectId, Types } from 'mongoose';
import { DatabaseService } from '../database/databaseservice';
import { FirebaseAdminService } from '../firebaseAdmin/firebase-admin.service';
import { AdminTicketQueryDto, CreateTicketDto, TicketPageQueryDto } from './dto/support.dto';

const MAX_ACTIVE_TICKETS = 5;      // ek player ke ek waqt me itne khule tickets
const MAX_TICKETS_PER_DAY = 10;    // spam rokne ke liye
const ACTIVE = ['open', 'in_progress'];

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ticketCode = (id: unknown) => 'TR-' + String(id).slice(-6).toUpperCase();
const preview = (text = '') => (text.length > 80 ? text.slice(0, 77) + '...' : text);

@Injectable()
export class SupportService {
  private readonly logger = new Logger('Support');

  constructor(
    private databaseService: DatabaseService,
    private firebase: FirebaseAdminService,
  ) {}

  private get ticketModel() {
    return this.databaseService.repositories.supportTicketModel;
  }

  // ================= player (game) =================

  async createTicket(userId: string, dto: CreateTicketDto) {
    const user = await this.databaseService.repositories.userModel.findById(userId).select('name email').lean();
    if (!user) throw new NotFoundException('User not found');

    const owner = new Types.ObjectId(userId);
    const [active, today] = await Promise.all([
      this.ticketModel.countDocuments({ user: owner, status: { $in: ACTIVE } }),
      this.ticketModel.countDocuments({ user: owner, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    ]);
    if (active >= MAX_ACTIVE_TICKETS) {
      throw new BadRequestException(`You already have ${MAX_ACTIVE_TICKETS} open requests. Please wait for a reply or add to an existing one.`);
    }
    if (today >= MAX_TICKETS_PER_DAY) {
      throw new HttpException('Too many requests today. Please try again tomorrow.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const now = new Date();
    const ticket = await this.ticketModel.create({
      user: owner,
      playerName: user.name || '',
      playerEmail: user.email || '',
      category: dto.category,
      subject: dto.subject.trim(),
      messages: [{ from: 'player', text: dto.message.trim(), createdAt: now }],
      appVersion: dto.appVersion || '',
      platform: dto.platform || '',
      deviceModel: dto.deviceModel || '',
      unreadForAdmin: true,
      unreadForPlayer: false,
      lastMessageAt: now,
    });

    return { message: 'Thanks! Your message was sent to our support team.', data: this.playerView(ticket.toObject()) };
  }

  async listMyTickets(userId: string, { page, limit }: TicketPageQueryDto) {
    const filter = { user: new Types.ObjectId(userId) };
    const [tickets, total, unreadCount] = await Promise.all([
      this.ticketModel.find(filter).sort({ lastMessageAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.ticketModel.countDocuments(filter),
      this.ticketModel.countDocuments({ ...filter, unreadForPlayer: true }),
    ]);

    return {
      message: 'Support requests fetched',
      data: {
        tickets: tickets.map((t) => this.playerSummary(t)),
        unreadCount,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMyTicket(userId: string, ticketId: string) {
    const ticket = await this.findOwnTicket(userId, ticketId);
    if (ticket.unreadForPlayer) {
      await this.ticketModel.updateOne({ _id: ticket._id }, { $set: { unreadForPlayer: false } });
      ticket.unreadForPlayer = false;
    }
    return { message: 'Support request fetched', data: this.playerView(ticket) };
  }

  async playerReply(userId: string, ticketId: string, text: string) {
    const ticket = await this.findOwnTicket(userId, ticketId);
    if (ticket.status === 'closed') {
      throw new BadRequestException('This request is closed. Please open a new one.');
    }

    const now = new Date();
    const updated = await this.ticketModel
      .findByIdAndUpdate(
        ticket._id,
        {
          $push: { messages: { from: 'player', text: text.trim(), createdAt: now } },
          // resolved ticket pe player dobara likhe to wapas khul jata hai
          $set: { unreadForAdmin: true, lastMessageAt: now, ...(ticket.status === 'resolved' ? { status: 'open' } : {}) },
        },
        { new: true },
      )
      .lean();

    return { message: 'Message sent', data: this.playerView(updated) };
  }

  private async findOwnTicket(userId: string, ticketId: string) {
    if (!isValidObjectId(ticketId)) throw new BadRequestException('Invalid request id');
    const ticket = await this.ticketModel.findById(ticketId).lean();
    // dusre player ka ticket ho to bhi "not found" — kisi aur ke tickets ka pata na chale
    if (!ticket || String(ticket.user) !== String(userId)) throw new NotFoundException('Support request not found');
    return ticket;
  }

  // player ko admin ki id / internal fields nahi dikhte
  private playerSummary(t: any) {
    const last = t.messages?.[t.messages.length - 1];
    return {
      _id: String(t._id),
      code: ticketCode(t._id),
      category: t.category,
      subject: t.subject,
      status: t.status,
      unread: !!t.unreadForPlayer,
      lastMessage: preview(last?.text),
      lastMessageFrom: last?.from === 'admin' ? 'Support Team' : 'You',
      lastMessageAt: t.lastMessageAt,
      createdAt: t.createdAt,
    };
  }

  private playerView(t: any) {
    return {
      ...this.playerSummary(t),
      messages: (t.messages || []).map((m) => ({
        from: m.from,
        author: m.from === 'admin' ? 'Support Team' : 'You',
        text: m.text,
        createdAt: m.createdAt,
      })),
    };
  }

  // ================= admin (dashboard) =================

  async adminStats() {
    const [open, inProgress, resolved, closed, unread] = await Promise.all([
      this.ticketModel.countDocuments({ status: 'open' }),
      this.ticketModel.countDocuments({ status: 'in_progress' }),
      this.ticketModel.countDocuments({ status: 'resolved' }),
      this.ticketModel.countDocuments({ status: 'closed' }),
      this.ticketModel.countDocuments({ unreadForAdmin: true, status: { $ne: 'closed' } }),
    ]);
    return { message: 'Support stats', data: { open, inProgress, resolved, closed, unread, active: open + inProgress } };
  }

  async adminList(query: AdminTicketQueryDto) {
    const { page, limit, status, category, search } = query;
    const filter: any = {};
    if (status === 'active') filter.status = { $in: ACTIVE };
    else if (status !== 'all') filter.status = status;
    if (category !== 'all') filter.category = category;
    if (search?.trim()) {
      const text = search.trim();
      const regex = new RegExp(escapeRegex(text), 'i');
      filter.$or = [{ subject: regex }, { playerName: regex }, { playerEmail: regex }];
      // "TR-1A2B3C" ya uska hissa bhi dhoondh sake
      const code = text.replace(/^TR-/i, '');
      if (/^[0-9a-f]{3,6}$/i.test(code)) {
        filter.$or.push({ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: `${escapeRegex(code)}$`, options: 'i' } } });
      }
    }

    const [tickets, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .sort({ unreadForAdmin: -1, lastMessageAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.ticketModel.countDocuments(filter),
    ]);

    return {
      message: 'Support requests fetched',
      data: {
        tickets: tickets.map((t) => {
          const last = t.messages?.[t.messages.length - 1];
          return {
            _id: t._id,
            code: ticketCode(t._id),
            user: t.user,
            playerName: t.playerName,
            playerEmail: t.playerEmail,
            category: t.category,
            subject: t.subject,
            status: t.status,
            unread: !!t.unreadForAdmin,
            messageCount: t.messages?.length || 0,
            lastMessage: preview(last?.text),
            lastMessageFrom: last?.from,
            lastMessageAt: t.lastMessageAt,
            createdAt: t.createdAt,
          };
        }),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    };
  }

  async adminGet(ticketId: string) {
    const ticket = await this.findTicket(ticketId);
    if (ticket.unreadForAdmin) {
      await this.ticketModel.updateOne({ _id: ticket._id }, { $set: { unreadForAdmin: false } });
      ticket.unreadForAdmin = false;
    }
    const player = await this.databaseService.repositories.userModel
      .findById(ticket.user)
      .select('name email level trophies isBanned isDeleted createdAt')
      .lean();
    return { message: 'Support request fetched', data: { ...ticket, code: ticketCode(ticket._id), player } };
  }

  async adminReply(adminId: string, ticketId: string, text: string, status?: string) {
    const ticket = await this.findTicket(ticketId);
    const now = new Date();
    const nextStatus = status || (ticket.status === 'open' ? 'in_progress' : ticket.status);

    const updated = await this.ticketModel
      .findByIdAndUpdate(
        ticket._id,
        {
          $push: { messages: { from: 'admin', adminId: new Types.ObjectId(adminId), text: text.trim(), createdAt: now } },
          $set: { status: nextStatus, unreadForPlayer: true, unreadForAdmin: false, lastMessageAt: now },
        },
        { new: true },
      )
      .lean();

    this.notifyPlayer(updated).catch((err) => this.logger.warn(`Push for ticket ${ticket._id} failed: ${err?.message}`));
    return { message: 'Reply sent', data: { ...updated, code: ticketCode(updated._id) } };
  }

  async adminSetStatus(ticketId: string, status: string) {
    const ticket = await this.findTicket(ticketId);
    const updated = await this.ticketModel
      .findByIdAndUpdate(ticket._id, { $set: { status } }, { new: true })
      .lean();
    return { message: 'Status updated', data: { ...updated, code: ticketCode(updated._id) } };
  }

  private async findTicket(ticketId: string) {
    if (!isValidObjectId(ticketId)) throw new BadRequestException('Invalid ticket id');
    const ticket = await this.ticketModel.findById(ticketId).lean();
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  // jawab aate hi player ko push notification (agar uske paas fcmToken hai)
  private async notifyPlayer(ticket: any) {
    const user = await this.databaseService.repositories.userModel.findById(ticket.user).select('fcmToken isBanned isDeleted').lean();
    if (!user?.fcmToken || user.isBanned || user.isDeleted) return;
    await this.firebase.sendToMany(
      [user.fcmToken],
      { title: 'Support replied', body: `Re: ${preview(ticket.subject)}` },
      { type: 'support_reply', ticketId: String(ticket._id) },
    );
  }
}
