/* eslint-disable prettier/prettier */
import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import * as schema from './schema';
import { DatabaseService } from './databaseservice'
import { SettingsService } from '../settings/settings.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGODB_URI),
    MongooseModule.forFeature([
      { name: schema.User.name, schema: schema.UserSchema },
       { name: schema.Store.name, schema: schema.StoreSchema },
        { name: schema.Payment.name, schema: schema.PaymentSchema },
          { name: schema.Game.name, schema: schema.GameSchema },
           { name: schema.Friend.name, schema: schema.FriendSchema },
            { name: schema.Clan.name, schema: schema.ClanSchema },
             { name: schema.clanRequest.name, schema: schema.clanRequestSchema },
              { name: schema.Setting.name, schema: schema.SettingSchema },
               { name: schema.NotificationLog.name, schema: schema.NotificationLogSchema },
                { name: schema.SupportTicket.name, schema: schema.SupportTicketSchema },
                 { name: schema.ShopItem.name, schema: schema.ShopItemSchema },

    ]),
  ],
  // SettingsService: admin dashboard se badalne wale reward numbers (src/settings)
  exports: [MongooseModule, DatabaseService, SettingsService],
  providers: [DatabaseService, SettingsService],
})
export class DatabaseModule {}