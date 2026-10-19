/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
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

@Injectable()
export class AuthService {
   private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); // 👈 Google Client
  constructor(
   
    private databaseService: DatabaseService,

    private readonly jwtService: JwtService
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

    const payload = { sub: user._id, email: user.email };
    const token = this.jwtService.sign(payload);

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
    token
  }
};
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



