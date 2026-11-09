/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';

import { FriendService } from './friend.service';
import { FriendController } from './friend.controller';
import { FirebaseAdminModule } from '../firebaseAdmin/firebase-admin.module';

@Module({
  imports: [FirebaseAdminModule],
  controllers: [FriendController],
  providers: [FriendService],
  exports: [FriendService],
})
export class friendModule {}
