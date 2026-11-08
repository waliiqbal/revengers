/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 📧 Ek jagah SMTP: notifications (dashboard) aur OTP emails dono yahi use karte hain.
// Settings server ki .env se: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE
@Injectable()
export class MailService {
  config() {
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

  // bahut saare emails ke liye ek hi connection (notifications); kaam ke baad close() karna
  transporter() {
    const smtp = this.config();
    return nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
  }

  async send(to: string, subject: string, text: string, html: string) {
    const transporter = this.transporter();
    try {
      await transporter.sendMail({ from: this.config().from, to, subject, text, html });
    } finally {
      transporter.close();
    }
  }

  // Tokyo Revengers wala email layout; innerHtml pehle se escape kiya hua ho
  layout(title: string, innerHtml: string) {
    return `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#16181d">
<div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #e4e6ea;border-radius:12px;padding:28px">
<div style="font-weight:700;font-size:18px;margin-bottom:18px">Tokyo Revengers</div>
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
${innerHtml}
</div></body></html>`;
  }
}
