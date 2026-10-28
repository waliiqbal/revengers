/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { FirebaseAdminModule } from '../firebaseAdmin/firebase-admin.module';
import { AdminSupportController, SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [FirebaseAdminModule],
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService],
})
export class SupportModule {}
