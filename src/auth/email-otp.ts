/* eslint-disable prettier/prettier */
import { createHmac, randomInt, timingSafeEqual } from 'crypto';

// ✉️ Email verification (OTP) ke rules — ek jagah
export const OTP_DIGITS = 6;
export const OTP_TTL_MINUTES = 10;       // code kitni der chalta hai
export const OTP_RESEND_SECONDS = 60;    // naya code kitni der baad mangwa sakte hain
export const OTP_MAX_ATTEMPTS = 5;       // itne galat codes ke baad naya code mangwana padta hai

// email/password ka player jo abhi verify nahi hua. Google accounts (providerId) Google ne verify kiye hain;
// admin dashboard wala account bhi is se bahar hai.
export const needsEmailVerification = (user: { providerId?: string; role?: string; emailVerified?: boolean }) =>
  !user.providerId && user.role !== 'admin' && !user.emailVerified;

export const newOtpCode = () => String(randomInt(0, 10 ** OTP_DIGITS)).padStart(OTP_DIGITS, '0');

// code + user id ka HMAC (JWT_SECRET se) — DB leak ho bhi jaye to codes nazar nahi aate
export const hashOtp = (userId: string, code: string) =>
  createHmac('sha256', process.env.JWT_SECRET || 'otp').update(`${userId}:${code}`).digest('hex');

export const otpMatches = (userId: string, code: string, hash: string | null | undefined) => {
  if (!hash) return false;
  const a = Buffer.from(hashOtp(userId, code));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
};
