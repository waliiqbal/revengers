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
import { UploadModule } from './upload/upload.module';
import { FirebaseAdminModule } from './firebaseAdmin/firebase-admin.module';
import { AdminModule } from './admin/admin.module';
import { StoryModule } from './story/story.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SupportModule } from './support/support.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { ShopModule } from './shop/shop.module';

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
    UploadModule,
    FirebaseAdminModule,
    AdminModule,
    StoryModule,
    NotificationsModule,
    SupportModule,
    LeaderboardModule,
    ShopModule,


  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
