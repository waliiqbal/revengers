/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { DatabaseService } from '../database/databaseservice';
import { DEFAULT_REWARD_SETTINGS, RewardSettings, withDefaults } from './reward-settings';
import { STORY_STAGES } from '../story/story-rewards';

const REWARDS_KEY = 'rewards';

@Injectable()
export class SettingsService {
  // ek hi server process hai — admin save kare to cache turant clear hota hai
  private cache: { value: RewardSettings; updatedAt: Date | null; updatedBy: any } | null = null;

  constructor(private databaseService: DatabaseService) {}

  private get settingModel() {
    return this.databaseService.repositories.settingModel;
  }

  async getRewards(): Promise<RewardSettings> {
    return (await this.load()).value;
  }

  async getRewardsWithMeta() {
    const { value, updatedAt, updatedBy } = await this.load();
    let updatedByEmail = null;
    if (updatedBy) {
      const admin = await this.databaseService.repositories.userModel.findById(updatedBy).select('email').lean();
      updatedByEmail = admin?.email ?? null;
    }
    const stages = STORY_STAGES.map(({ stage, code, name, boss }) => ({ stage, code, name, boss }));
    return { settings: value, defaults: DEFAULT_REWARD_SETTINGS, stages, updatedAt, updatedBy: updatedByEmail };
  }

  async saveRewards(adminId: string, settings: RewardSettings) {
    await this.settingModel.updateOne(
      { _id: REWARDS_KEY },
      { $set: { value: withDefaults(settings), updatedBy: new Types.ObjectId(adminId) } },
      { upsert: true },
    );
    this.cache = null;
    return this.getRewardsWithMeta();
  }

  async resetRewards(adminId: string) {
    return this.saveRewards(adminId, DEFAULT_REWARD_SETTINGS);
  }

  private async load() {
    if (!this.cache) {
      const doc: any = await this.settingModel.findById(REWARDS_KEY).lean();
      this.cache = { value: withDefaults(doc?.value), updatedAt: doc?.updatedAt ?? null, updatedBy: doc?.updatedBy ?? null };
    }
    return this.cache;
  }
}
