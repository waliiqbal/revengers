/* eslint-disable prettier/prettier */
// Kisi account ko admin banane ke liye (server pe, project folder ke andar):
//   node dist/scripts/make-admin.js <email> [password]
// - user mojood hai  → role 'admin' ho jata hai (password diya ho to woh bhi set hota hai)
// - user nahi hai    → naya admin account banta hai (password zaroori hai)
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/databaseservice';

@Module({ imports: [DatabaseModule] })
class MakeAdminModule {}

async function run() {
  const [email, password] = process.argv.slice(2);
  if (!email) {
    console.error('Usage: node dist/scripts/make-admin.js <email> [password]');
    process.exit(1);
  }
  if (password && password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(MakeAdminModule, { logger: ['error'] });
  const userModel = app.get(DatabaseService).repositories.userModel;

  try {
    const user = await userModel.findOne({ email });

    if (user) {
      user.role = 'admin';
      user.isBanned = false;
      user.isDeleted = false;
      if (password) {
        user.password = await bcrypt.hash(password, 10);
      }
      await user.save();
      console.log(`✅ ${email} is now an admin${password ? ' (password updated)' : ''}`);
      if (user.providerId) {
        console.log('⚠️  This is a social-login account, so /auth/login will reject it. Use a separate email for the admin.');
      } else if (!user.password) {
        console.log('⚠️  This account has no password. Run again with a password to use /auth/login.');
      }
    } else {
      if (!password) {
        console.error(`No user with email ${email}. Pass a password to create a new admin account.`);
        process.exitCode = 1;
        return;
      }
      await userModel.create({
        email,
        name: 'Admin',
        role: 'admin',
        password: await bcrypt.hash(password, 10),
      });
      console.log(`✅ Created new admin account ${email}`);
    }
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
