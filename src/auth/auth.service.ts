/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../user/schema/user.schema';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { SignupDto } from './dto/signup.dto';
import { SocialLoginDto  } from './dto/social-login.dto';
import { LoginDto } from './dto/login.dto';
import { DatabaseService } from "src/database/databaseservice";
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import { MailService, escapeHtml } from '../mail/mail.service';
import { VerifyOtpDto } from './dto/email-otp.dto';
import {
  OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS, OTP_TTL_MINUTES,
  hashOtp, needsEmailVerification, newOtpCode, otpMatches,
} from './email-otp';

@Injectable()
export class AuthService {
   private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); // 👈 Google Client
   private readonly logger = new Logger('Auth');
  constructor(

    private databaseService: DatabaseService,

    private readonly jwtService: JwtService,

    private readonly mail: MailService,
  ) {}

  // ✅ Signup
 async signup(signupDto: SignupDto) {
  try {
    const { name, email, password, fcmToken } = signupDto;

    const existingUser = await this.databaseService.repositories.userModel.findOne({ email });
    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new this.databaseService.repositories.userModel({
      name,
      fcmToken,
      email,
      password: hashedPassword, 
    });

    await user.save();

    // ✉️ token tab milega jab player email pe aaya code daalega (POST auth/verify-otp)
    return this.verificationRequired(user, await this.sendOtp(user));
  } catch (error) {
    throw new UnauthorizedException(error.message || 'Signup failed');
  }
}

  // ✅ Login
  async login(loginDto: LoginDto) {
  try {
    const { email, password, fcmToken } = loginDto;

    const user = await this.databaseService.repositories.userModel.findOne({ email });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    this.assertCanLogin(user);

    if (user.providerId) {
      throw new UnauthorizedException(
        `This account is registered using ${user.providerId} login. Use social login.`
      );
    }

    // 🔐 Local user → check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid password');
    }

    // ✉️ email abhi verify nahi (naya ya purana account) → code bhejo, token nahi
    if (needsEmailVerification(user)) {
      if (fcmToken) {
        user.fcmToken = fcmToken;
        await user.save();
      }
      return this.verificationRequired(user, await this.sendOtp(user));
    }

    // ✅ Generate token
    const payload = { sub: user._id, email: user.email };
    const token = this.jwtService.sign(payload);
    if(fcmToken){
      user.fcmToken = fcmToken;
      user.save();
    }

    return { 
  message: 'User registered successfully',
  data: {
    _id: user._id,
    name: user.name,
    email: user.email,
    displayPic: user.displayPic,
    level: user.level,
    currentXp: user.currentXp,
    totalXp: user.totalXp,
    gem: user.gem,
    diamond: user.diamond,
    coin: user.coin,
    totalMatch: user.totalMatch,
    won: user.won,
    lost: user.lost,
    kills: user.kills,
    death: user.death,
    assists: user.assists,
    hours: user.hours,
    availableSkill: user.availableSkill,
    role: user.role,
    token
  }
};
  } catch (error) {
    throw new UnauthorizedException(error.message || 'Login failed');
  }
}
// 🔐 Social login: email aur user id sirf Google ke VERIFIED token se aate hain, app ki body se kabhi nahi.
// Pehle yahan sirf email bhej kar kisi ka bhi account (admin bhi) khul jata tha.
async socialLogin(authProvider: string, idToken: string, name?: string, fcmToken?: string) {
  if (authProvider !== 'google') {
    // apple / facebook: jab tak unke token ka verification nahi banta, band hai
    throw new BadRequestException(`${authProvider} login is not available yet`);
  }

  const google = await this.verifyGoogleIdToken(idToken);
  const users = this.databaseService.repositories.userModel;

  // 1. pehle se is Google account se bana user
  let user = await users.findOne({ authProvider: 'google', providerId: google.sub });

  if (!user) {
    // 2. email kisi aur account ka hai → kabhi auto-link nahi (password / admin account takeover ka rasta yahi tha)
    const existing = await users.findOne({ email: google.email }).collation({ locale: 'en', strength: 2 }); // case-insensitive
    if (existing) {
      throw new UnauthorizedException(
        existing.password
          ? 'This email is registered with a password. Please sign in with email and password.'
          : 'This email is already linked to another account.'
      );
    }

    // 3. naya player
    user = await users.create({
      email: google.email,
      name: name || google.name || '',
      displayPic: google.picture || '',
      providerId: google.sub,
      authProvider: 'google',
      fcmToken: fcmToken || null,
      emailVerified: true,   // Google ne verify kiya hua email
    });
  } else if (fcmToken) {
    user.fcmToken = fcmToken;
    await user.save();
  }

  if (user.role === 'admin') {
    throw new UnauthorizedException('Admin accounts must sign in with email and password');
  }
  this.assertCanLogin(user);

  const token = this.jwtService.sign({ sub: user._id, email: user.email }, { expiresIn: '1h' });

  return {
    message: 'Social login successful',
    data: { ...this.publicProfile(user), token },
  };
}

private async verifyGoogleIdToken(idToken: string) {
  // GOOGLE_CLIENT_ID me ek ya zyada client IDs (comma se alag): web / android / ios
  const audience = (process.env.GOOGLE_CLIENT_ID || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (!audience.length) {
    throw new UnauthorizedException('Google login is not configured on the server');
  }

  let payload;
  try {
    const ticket = await this.googleClient.verifyIdToken({ idToken, audience });
    payload = ticket.getPayload();
  } catch {
    throw new UnauthorizedException('Invalid or expired Google token');
  }

  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new UnauthorizedException('Google account email is not verified');
  }
  return { sub: payload.sub, email: payload.email.toLowerCase(), name: payload.name, picture: payload.picture };
}

// response me password / fcmToken kabhi nahi
private publicProfile(user: UserDocument) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    displayPic: user.displayPic,
    level: user.level,
    currentXp: user.currentXp,
    totalXp: user.totalXp,
    gem: user.gem,
    diamond: user.diamond,
    coin: user.coin,
    totalMatch: user.totalMatch,
    won: user.won,
    lost: user.lost,
    kills: user.kills,
    death: user.death,
    assists: user.assists,
    hours: user.hours,
    availableSkill: user.availableSkill,
    role: user.role,
  };
}

// ---------------------------------------------------------------- ✉️ email OTP

// "code daalo" wala jawab: koi token nahi, game OTP screen kholta hai
private verificationRequired(user: UserDocument, otp: { sent: boolean; waitSeconds: number }) {
  return {
    message: otp.sent
      ? `We sent a 6-digit code to ${user.email}`
      : 'Enter the code from your email to continue',
    data: { verificationRequired: true, email: user.email, codeSent: otp.sent, resendInSeconds: otp.waitSeconds },
  };
}

// Naya code bhejta hai — lekin 60 second me ek hi baar (pichla code tab tak chalta rehta hai)
private async sendOtp(user: UserDocument, { force = false } = {}) {
  const sentAt = user.emailOtpSentAt ? new Date(user.emailOtpSentAt).getTime() : 0;
  const waited = (Date.now() - sentAt) / 1000;
  if (sentAt && waited < OTP_RESEND_SECONDS) {
    const waitSeconds = Math.ceil(OTP_RESEND_SECONDS - waited);
    if (force) throw new BadRequestException(`Please wait ${waitSeconds} seconds before asking for a new code`);
    return { sent: false, waitSeconds };
  }
  if (!this.mail.config().configured) {
    this.logger.error('OTP not sent: SMTP is not set up in .env');
    return { sent: false, waitSeconds: 0 };
  }

  const code = newOtpCode();
  const users = this.databaseService.repositories.userModel;
  await users.updateOne({ _id: user._id }, {
    $set: {
      emailOtpHash: hashOtp(String(user._id), code),
      emailOtpExpiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      emailOtpSentAt: new Date(),
      emailOtpAttempts: 0,
    },
  });

  try {
    const title = 'Your verification code';
    await this.mail.send(
      user.email,
      `${code} is your Tokyo Revengers code`,
      `${user.name ? `Hi ${user.name},\n\n` : ''}Your Tokyo Revengers verification code is ${code}\n\nIt works for ${OTP_TTL_MINUTES} minutes. If you didn't create an account, you can ignore this email.\n\n— Tokyo Revengers`,
      this.mail.layout(title, `${user.name ? `<p style="margin:0 0 14px">Hi ${escapeHtml(user.name)},</p>` : ''}
<p style="margin:0 0 14px">Enter this code in the game to verify your email:</p>
<div style="font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;background:#f5f6f8;border-radius:10px;padding:16px;margin:0 0 14px">${code}</div>
<p style="margin:0 0 14px;color:#5b6170">It works for ${OTP_TTL_MINUTES} minutes. If you didn't create an account, you can ignore this email.</p>`),
    );
    return { sent: true, waitSeconds: OTP_RESEND_SECONDS };
  } catch (error) {
    // bhej nahi saka → wait hata do taa ke player turant "Resend" daba sake
    this.logger.error(`OTP email to ${user.email} failed: ${error.message}`);
    await users.updateOne({ _id: user._id }, { $set: { emailOtpSentAt: null } });
    return { sent: false, waitSeconds: 0 };
  }
}

async resendOtp(email: string) {
  const user = await this.databaseService.repositories.userModel.findOne({ email });
  if (!user) throw new BadRequestException('No account with this email');
  this.assertCanLogin(user);
  if (!needsEmailVerification(user)) throw new BadRequestException('This email is already verified. Please log in.');

  const otp = await this.sendOtp(user, { force: true });
  if (!otp.sent) throw new BadRequestException("We couldn't send the email right now. Please try again in a minute.");
  return this.verificationRequired(user, otp);
}

// Sahi code → email verified + login token (wahi jawab jo login deta hai)
async verifyOtp({ email, code, fcmToken }: VerifyOtpDto) {
  const users = this.databaseService.repositories.userModel;
  const user = await users.findOne({ email });
  if (!user) throw new BadRequestException('No account with this email');
  this.assertCanLogin(user);
  if (!needsEmailVerification(user)) throw new BadRequestException('This email is already verified. Please log in.');

  const id = String(user._id);
  if ((user.emailOtpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
    throw new BadRequestException('Too many wrong codes. Tap "Resend code" to get a new one.');
  }
  if (!user.emailOtpHash || !user.emailOtpExpiresAt || new Date(user.emailOtpExpiresAt).getTime() < Date.now()) {
    throw new BadRequestException('This code has expired. Tap "Resend code" to get a new one.');
  }
  if (!otpMatches(id, code, user.emailOtpHash)) {
    // sirf tab ginti jab abhi 5 se kam hain (ek saath kai requests bhi 5 se zyada try nahi kar sakti)
    const counted = await users.findOneAndUpdate(
      { _id: user._id, emailOtpAttempts: { $lt: OTP_MAX_ATTEMPTS } },
      { $inc: { emailOtpAttempts: 1 } },
      { new: true },
    );
    const left = counted ? OTP_MAX_ATTEMPTS - (counted.emailOtpAttempts || 0) : 0;
    throw new BadRequestException(left > 0
      ? `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.`
      : 'Too many wrong codes. Tap "Resend code" to get a new one.');
  }

  // code sirf ek baar chalta hai (wahi hash ho tabhi)
  const verified = await users.findOneAndUpdate(
    { _id: user._id, emailOtpHash: user.emailOtpHash },
    {
      $set: { emailVerified: true, emailOtpHash: null, emailOtpExpiresAt: null, emailOtpSentAt: null, emailOtpAttempts: 0, ...(fcmToken ? { fcmToken } : {}) },
    },
    { new: true },
  );
  if (!verified) throw new BadRequestException('This code was already used. Please log in.');

  const token = this.jwtService.sign({ sub: verified._id, email: verified.email });
  return { message: 'Email verified!', data: { ...this.publicProfile(verified), token } };
}

// banned ya admin ne remove kiya hua user login nahi kar sakta
private assertCanLogin(user: UserDocument) {
  if (user.isDeleted) {
    throw new UnauthorizedException('This account has been removed');
  }
  if (user.isBanned) {
    throw new UnauthorizedException(
      user.banReason ? `Your account has been banned: ${user.banReason}` : 'Your account has been banned'
    );
  }
}

}



