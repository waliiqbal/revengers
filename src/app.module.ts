/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { DatabaseModule } from './database/database.module';
import { UsersModule } from './user/user.module';
import { StoreModule } from './store/store.module';

import { AuthModule } from './auth/auth.module';
import { paymentModule } from './payment/payment.module';
import { gameModule } from './game/game.module';
import { friendModule } from './friend/friend.module';
import { ClanModule } from './Clan/clan.module';

@Module({
  imports: [
    // ✅ Load .env globally
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    ClanModule,
    StoreModule,
    paymentModule,
    friendModule,
    gameModule,
   

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
