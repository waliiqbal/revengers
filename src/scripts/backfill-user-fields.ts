/* eslint-disable prettier/prettier */
// Purane users me naye fields (trophies, story, admin flags) nahi hote — yeh script unhe default value deta hai.
// Sirf MISSING fields set karta hai, koi existing value nahi badalta, dobara chalane se kuch nahi badalta.
//   node dist/scripts/backfill-user-fields.js --dry-run   → sirf batata hai kitne users me kya missing hai
//   node dist/scripts/backfill-user-fields.js             → fields bhar deta hai
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/databaseservice';

@Module({ imports: [DatabaseModule] })
class BackfillModule {}

// field → default (same as src/user/schema/user.schema.ts)
const DEFAULTS: Record<string, unknown> = {
  level: 1,
  currentXp: 0,
  totalXp: 0,
  trophies: 0,
  gem: 0,
  diamond: 0,
  coin: 0,
  totalMatch: 0,
  won: 0,
  lost: 0,
  kills: 0,
  death: 0,
  assists: 0,
  hours: 0,
  skillPoints: 0,
  storyStage: 0,
  chaptersCompleted: [],
  storyRun: null,
  role: 'player',
  isBanned: false,
  banReason: null,
  bannedAt: null,
  isDeleted: false,
  deletedAt: null,
};

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const app = await NestFactory.createApplicationContext(BackfillModule, { logger: ['error'] });
  const users = app.get(DatabaseService).repositories.userModel.collection;

  try {
    console.log(`${dryRun ? 'DRY RUN — nothing will be changed. ' : ''}Users: ${await users.countDocuments()}`);
    let updated = 0;

    for (const [field, value] of Object.entries(DEFAULTS)) {
      const filter = { [field]: { $exists: false } };
      const missing = await users.countDocuments(filter);
      if (!missing) continue;

      if (dryRun) {
        console.log(`  ${field.padEnd(18)} missing on ${missing}`);
      } else {
        const result = await users.updateMany(filter, { $set: { [field]: value } });
        console.log(`  ${field.padEnd(18)} set to ${JSON.stringify(value)} on ${result.modifiedCount}`);
        updated += result.modifiedCount;
      }
    }

    if (!dryRun) {
      console.log(updated ? `Done: ${updated} field values added.` : '0 users updated — everything was already filled in.');
    }
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
