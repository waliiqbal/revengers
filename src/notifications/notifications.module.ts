/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { FirebaseAdminModule } from '../firebaseAdmin/firebase-admin.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [FirebaseAdminModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
