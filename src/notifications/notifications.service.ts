/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { DatabaseService } from '../database/databaseservice';
import { FirebaseAdminService } from '../firebaseAdmin/firebase-admin.service';
import { NotificationAudienceDto, SendNotificationDto } from './dto/send-notification.dto';

const EMAIL_PARALLEL = 5;   // ek waqt me itne emails (SMTP limits ke liye)

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(
    private databaseService: DatabaseService,
    private firebase: FirebaseAdminService,
  ) {}

  private get userModel() {
    return this.databaseService.repositories.userModel;
  }

  private get logModel() {
    return this.databaseService.repositories.notificationModel;
  }

  // 📧 SMTP settings server ki .env se: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE
  private smtp() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    return {
      configured: !!(host && process.env.SMTP_USER && process.env.SMTP_PASS),
      host,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
    };
  }

  // banned, removed aur admin accounts ko kabhi nahi bhejna
  private recipientFilter(dto: NotificationAudienceDto) {
    const filter: any = { role: { $ne: 'admin' }, isDeleted: { $ne: true }, isBanned: { $ne: true } };
    if (dto.audience === 'players') {
      if (!dto.userIds?.length) throw new BadRequestException('Pick at least one player');
      filter._id = { $in: dto.userIds.map((id) => new Types.ObjectId(id)) };
    }
    return filter;
  }

  private reachableFilter(channel: string) {
    return channel === 'push'
      ? { fcmToken: { $exists: true, $nin: [null, ''] } }
      : { email: { $exists: true, $nin: [null, ''] } };
  }

  async status() {
    const players = { role: { $ne: 'admin' }, isDeleted: { $ne: true }, isBanned: { $ne: true } };
    const smtp = this.smtp();
    const [total, withPush, withEmail] = await Promise.all([
      this.userModel.countDocuments(players),
      this.userModel.countDocuments({ ...players, ...this.reachableFilter('push') }),
      this.userModel.countDocuments({ ...players, ...this.reachableFilter('email') }),
    ]);
    return {
      message: 'Notification status',
      data: {
        push: { configured: true, players: withPush },
        email: { configured: smtp.configured, from: smtp.configured ? smtp.from : null, players: withEmail },
        totalPlayers: total,
      },
    };
  }

  async preview(dto: NotificationAudienceDto) {
    const filter = this.recipientFilter(dto);
    const [targeted, reachable] = await Promise.all([
      this.userModel.countDocuments(filter),
      this.userModel.countDocuments({ ...filter, ...this.reachableFilter(dto.channel) }),
    ]);
    return { message: 'Recipients', data: { targeted, reachable } };
  }

  // Log turant ban jata hai (status "sending"); bhejna background me hota hai, dashboard history refresh karta hai
  async send(adminId: string, dto: SendNotificationDto) {
    if (dto.channel === 'email' && !this.smtp().configured) {
      throw new BadRequestException('Email is not set up yet. Add the SMTP settings to the server .env first.');
    }

    const filter = this.recipientFilter(dto);
    const reachableQuery = { ...filter, ...this.reachableFilter(dto.channel) };
    const [targeted, reachable] = await Promise.all([
      this.userModel.countDocuments(filter),
      this.userModel.countDocuments(reachableQuery),
    ]);
    if (!reachable) {
      throw new BadRequestException(
        dto.channel === 'push'
          ? 'None of these players can receive push notifications yet (no device token).'
          : 'None of these players have an email address.',
      );
    }

    const log = await this.logModel.create({
      channel: dto.channel,
      audience: dto.audience,
      userIds: dto.audience === 'players' ? dto.userIds.map((id) => new Types.ObjectId(id)) : [],
      title: dto.title.trim(),
      body: dto.body.trim(),
      status: 'sending',
      targeted,
      reachable,
      sentBy: new Types.ObjectId(adminId),
    });

    const deliver = dto.channel === 'push' ? this.deliverPush(log._id, reachableQuery, dto) : this.deliverEmail(log._id, reachableQuery, dto);
    deliver.catch(async (error) => {
      this.logger.error(`Notification ${log._id} failed: ${error.message}`);
      await this.logModel.updateOne({ _id: log._id }, { $set: { status: 'failed', error: String(error.message).slice(0, 500) } });
    });

    return { message: 'Sending started', data: await this.logModel.findById(log._id).lean() };
  }

  private async deliverPush(logId: unknown, query: any, dto: SendNotificationDto) {
    const users = await this.userModel.find(query).select('fcmToken').lean();
    const tokens = [...new Set(users.map((u) => u.fcmToken).filter(Boolean))];

    const result = await this.firebase.sendToMany(tokens, { title: dto.title.trim(), body: dto.body.trim() }, { type: 'admin_message' });

    // uninstall / expired tokens hata do taa ke agli baar fail na hon
    if (result.invalidTokens.length) {
      await this.userModel.updateMany({ fcmToken: { $in: result.invalidTokens } }, { $set: { fcmToken: null } });
    }
    await this.logModel.updateOne({ _id: logId }, { $set: { status: 'done', sent: result.sent, failed: result.failed } });
  }

  private async deliverEmail(logId: unknown, query: any, dto: SendNotificationDto) {
    const smtp = this.smtp();
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });

    const users = await this.userModel.find(query).select('email name').lean();
    const title = dto.title.trim();
    const body = dto.body.trim();
    let sent = 0;
    let failed = 0;

    // har player ko alag email — kisi ko dusre players ke address nazar na aayein
    for (let i = 0; i < users.length; i += EMAIL_PARALLEL) {
      const batch = users.slice(i, i + EMAIL_PARALLEL);
      const results = await Promise.allSettled(
        batch.map((u) =>
          transporter.sendMail({
            from: smtp.from,
            to: u.email,
            subject: title,
            text: `${u.name ? `Hi ${u.name},\n\n` : ''}${body}\n\n— Tokyo Revengers`,
            html: this.emailHtml(u.name, title, body),
          }),
        ),
      );
      sent += results.filter((r) => r.status === 'fulfilled').length;
      failed += results.filter((r) => r.status === 'rejected').length;
      await this.logModel.updateOne({ _id: logId }, { $set: { sent, failed } });
    }

    transporter.close();
    await this.logModel.updateOne({ _id: logId }, { $set: { status: 'done', sent, failed } });
  }

  private emailHtml(name: string | undefined, title: string, body: string) {
    const paragraphs = escapeHtml(body).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`).join('');
    return `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#16181d">
<div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #e4e6ea;border-radius:12px;padding:28px">
<div style="font-weight:700;font-size:18px;margin-bottom:18px">Tokyo Revengers</div>
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
${name ? `<p style="margin:0 0 14px">Hi ${escapeHtml(name)},</p>` : ''}${paragraphs}
</div></body></html>`;
  }

  async history(page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      this.logModel.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('sentBy', 'email').lean(),
      this.logModel.countDocuments(),
    ]);
    return {
      message: 'Notification history',
      data: {
        items: items.map((n: any) => ({ ...n, userIds: undefined, players: n.userIds?.length ?? 0, sentBy: n.sentBy?.email ?? null })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    };
  }
}
