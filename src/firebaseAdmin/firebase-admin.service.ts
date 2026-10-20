/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { serviceAccount } from '../certs/firebase-adminsdk';

@Injectable()
export class FirebaseAdminService {
  private readonly messaging: admin.messaging.Messaging;

  constructor() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });
    }
    this.messaging = admin.messaging();
  }

  async sendToDevice(
    deviceToken: string,
    payload: {
      notification?: { title: string; body: string };
      data?: { [key: string]: string };
    },
  ) {
    const message: admin.messaging.Message = {
      token: deviceToken,
      notification: payload.notification,
      data: payload.data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    };

    try {
      const result = await this.messaging.send(message);
      return { success: true, result };
    } catch (error) {
      console.error('Firebase Error:', error);
      return { success: false, error };
    }
  }

  // Ek saath bohot devices ko (Firebase limit: 500 tokens per call).
  // invalidTokens = uninstall / expired → caller DB se hata de.
  async sendToMany(
    tokens: string[],
    notification: { title: string; body: string },
    data?: { [key: string]: string },
  ) {
    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];
    const DEAD = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'];

    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      const response = await this.messaging.sendEachForMulticast({
        tokens: batch,
        notification,
        data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      sent += response.successCount;
      failed += response.failureCount;
      response.responses.forEach((r, index) => {
        if (!r.success && DEAD.includes(r.error?.code)) invalidTokens.push(batch[index]);
      });
    }
    return { sent, failed, invalidTokens };
  }
}
