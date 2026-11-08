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

  // 🎮 Tokyo Revengers email layout (dark + red + gold, like the game). Tables + inline styles so it looks
  // the same in Gmail, Outlook and phone mail apps. innerHtml pehle se escape kiya hua ho — use p() / codeBox().
  // preheader = the grey preview line next to the subject in the inbox.
  layout(title: string, innerHtml: string, preheader = '') {
    const font = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
    const display = "Impact,'Arial Black','Segoe UI',Arial,sans-serif";
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#0b0b0e;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0b0b0e;">${escapeHtml(preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0b0b0e" style="background:#0b0b0e;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

  <!-- logo -->
  <tr><td align="center" bgcolor="#7a0000" style="background:#7a0000;background-image:linear-gradient(135deg,#d10a0a 0%,#7a0000 55%,#2a0000 100%);border-radius:14px 14px 0 0;padding:30px 24px 26px;">
    <div style="font-family:${display};font-size:40px;line-height:40px;letter-spacing:6px;color:#ffffff;font-weight:900;text-shadow:3px 3px 0 #000000;">TOKYO</div>
    <div style="font-family:${display};font-size:24px;line-height:30px;letter-spacing:9px;color:#ffc21a;font-weight:900;text-shadow:2px 2px 0 #000000;">REVENGERS</div>
  </td></tr>
  <tr><td height="4" bgcolor="#ffc21a" style="background:#ffc21a;background-image:linear-gradient(90deg,#ff8a00,#ffd23f,#ff8a00);font-size:0;line-height:0;">&nbsp;</td></tr>

  <!-- message -->
  <tr><td bgcolor="#16161c" style="background:#16161c;border-left:1px solid #2a2a33;border-right:1px solid #2a2a33;padding:34px 36px 30px;font-family:${font};font-size:16px;line-height:25px;color:#d9d9e0;">
    <h1 style="margin:0 0 20px;font-family:${display};font-size:26px;line-height:32px;letter-spacing:1px;text-transform:uppercase;color:#ffffff;font-weight:900;">${escapeHtml(title)}</h1>
    ${innerHtml}
  </td></tr>

  <!-- footer -->
  <tr><td bgcolor="#101015" style="background:#101015;border:1px solid #2a2a33;border-top:0;border-radius:0 0 14px 14px;padding:22px 36px;font-family:${font};font-size:12px;line-height:19px;color:#7c7c88;" align="center">
    <div style="font-family:${display};letter-spacing:3px;color:#c9a227;font-size:13px;margin-bottom:6px;">SEE YOU ON THE STREETS</div>
    You're getting this email because you have a Tokyo Revengers account.<br>
    &copy; ${new Date().getFullYear()} Tokyo Revengers. All rights reserved.
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
  }

  // one paragraph of escaped text (blank lines = new paragraph, single line breaks kept)
  p(text: string, color = '#d9d9e0') {
    return escapeHtml(text).split(/\n{2,}/)
      .map((part) => `<p style="margin:0 0 16px;color:${color};">${part.replace(/\n/g, '<br>')}</p>`).join('');
  }

  // "Hi Takemichi," in white
  greeting(name?: string) {
    return name ? `<p style="margin:0 0 16px;color:#ffffff;font-weight:600;">Hi ${escapeHtml(name)},</p>` : '';
  }

  // big code in a gold-edged box (OTP)
  codeBox(code: string) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px;">
<tr><td align="center" bgcolor="#0b0b0e" style="background:#0b0b0e;border:2px solid #ffc21a;border-radius:12px;padding:20px 10px;">
  <div style="font-family:'Courier New',Consolas,monospace;font-size:40px;line-height:44px;letter-spacing:14px;color:#ffc21a;font-weight:700;padding-left:14px;">${escapeHtml(code)}</div>
</td></tr></table>`;
  }
}
