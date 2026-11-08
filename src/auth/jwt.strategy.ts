/* eslint-disable prettier/prettier */
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/databaseservice';
import { needsEmailVerification } from './email-otp';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // 🟢 Get token from header
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'), // 🟢 Secret from .env
    });
  }

  // har request pe DB se check: ban / remove turant apply ho jata hai, role bhi DB se aata hai
  async validate(payload: any) {
    const user = await this.databaseService.repositories.userModel
      .findById(payload.sub)
      .select('email role isBanned isDeleted providerId emailVerified')
      .lean();

    if (!user || user.isDeleted) {
      throw new UnauthorizedException('Account not found');
    }
    if (user.isBanned) {
      throw new ForbiddenException('Your account has been banned');
    }
    // ✉️ purane tokens bhi: email verify hone tak koi API nahi
    if (needsEmailVerification(user)) {
      throw new ForbiddenException('Please verify your email first');
    }

    return { userId: payload.sub, email: user.email, role: user.role || 'player' };
  }
}
