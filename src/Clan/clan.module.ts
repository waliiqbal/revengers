/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { ClanService } from './clan.service';
import { ClanController } from './clan.controller';
import { JwtStrategy } from 'src/auth/jwt.strategy';



@Module({
  imports: [
   
    ConfigModule,

    PassportModule,

  
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),

    // ✅ User schema inject for MongoDB
   
  ],
  controllers: [ClanController],
  providers: [ClanService, JwtStrategy],
  exports: [ClanService], 
})
export class ClanModule {}
