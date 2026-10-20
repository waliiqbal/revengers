/* eslint-disable prettier/prettier */

import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FirebaseAdminService } from './firebase-admin.service';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';

// 🔐 pehle bina login ke koi bhi kisi ko push bhej sakta tha — ab sirf admin
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
@Controller('firebase')
export class FirebaseAdminController {
  constructor(private readonly firebaseService: FirebaseAdminService) {}

  @Post('send-notification')
  async sendNotification(
    @Body()
    body: {
      token: string;
      title: string;
      body: string;
      data?: { [key: string]: string };
    },
  ) {
    return this.firebaseService.sendToDevice(body.token, {
      notification: {
        title: body.title,
        body: body.body,
      },
      data: body.data,
    });
  }
}
