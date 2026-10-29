/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isValidObjectId, Types } from 'mongoose';
import { DatabaseService } from '../database/databaseservice';
import { AscensionSettings, attackBonusFor, DEFAULT_ASCENSION, withAscensionDefaults } from './ascension-settings';

const ASCENSION_KEY = 'ascension';

@Injectable()
export class CharactersService {
  private cache: { value: AscensionSettings; updatedAt: Date | null; updatedBy: any } | null = null;

  constructor(private databaseService: DatabaseService) {}

  private get userModel() {
    return this.databaseService.repositories.userModel;
  }

  private get settingModel() {
    return this.databaseService.repositories.settingModel;
  }

  // ---------------- rules (admin dashboard) ----------------
  private async load() {
    if (!this.cache) {
      const doc: any = await this.settingModel.findById(ASCENSION_KEY).lean();
      this.cache = { value: withAscensionDefaults(doc?.value), updatedAt: doc?.updatedAt ?? null, updatedBy: doc?.updatedBy ?? null };
    }
    return this.cache;
  }

  async getRules() {
    return (await this.load()).value;
  }

  async getRulesWithMeta() {
    const { value, updatedAt, updatedBy } = await this.load();
    let by = null;
    if (updatedBy) by = (await this.userModel.findById(updatedBy).select('email').lean())?.email ?? null;
    return { settings: value, defaults: DEFAULT_ASCENSION, updatedAt, updatedBy: by };
  }

  async saveRules(adminId: string, value: any) {
    await this.settingModel.updateOne(
      { _id: ASCENSION_KEY },
      { $set: { value: withAscensionDefaults(value), updatedBy: new Types.ObjectId(adminId) } },
      { upsert: true },
    );
    this.cache = null;
    return this.getRulesWithMeta();
  }

  async resetRules(adminId: string) {
    return this.saveRules(adminId, DEFAULT_ASCENSION);
  }

  // ---------------- player (game) ----------------
  private checkIndex(index: number, rules: AscensionSettings) {
    if (!Number.isInteger(index) || index < 0 || index >= rules.maxCharacters) {
      throw new BadRequestException(`Character must be 0 to ${rules.maxCharacters - 1}`);
    }
  }

  private starsOf(user: any, index: number): number {
    const map = user?.characterStars || {};
    const value = map instanceof Map ? map.get(String(index)) : map[String(index)];
    return Number(value) || 0;
  }

  // ek character ka haal: kitne stars, attack bonus, agle star ki shartein aur kya poori hain
  private detail(user: any, index: number, rules: AscensionSettings) {
    const stars = this.starsOf(user, index);
    const next = rules.stars[stars] || null;   // stars = 5 ho to null (max)
    const chapters: number[] = user.chaptersCompleted || [];
    const have = { diamonds: user.diamond || 0, wins: user.won || 0, level: user.level || 1 };

    let nextStar = null;
    if (next) {
      const checks = {
        diamonds: have.diamonds >= next.diamonds,
        wins: have.wins >= next.minWins,
        level: have.level >= next.minLevel,
        chapter: !next.chapter || chapters.includes(next.chapter),
      };
      nextStar = { ...next, checks, canAscend: Object.values(checks).every(Boolean) };
    }
    return {
      index,
      stars,
      maxStars: rules.stars.length,
      attackBonus: attackBonusFor(rules, stars),
      nextStar,
      player: have,
      chaptersCompleted: chapters,
    };
  }

  private async findPlayer(userId: string) {
    const user = await this.userModel.findById(userId).select('diamond won level chaptersCompleted characterStars').lean();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getAll(userId: string) {
    const [rules, user] = await Promise.all([this.getRules(), this.findPlayer(userId)]);
    const characters = Array.from({ length: rules.maxCharacters }, (_, i) => this.detail(user, i, rules));
    return { message: 'Characters', data: { characters, rules: rules.stars } };
  }

  async getOne(userId: string, index: number) {
    const [rules, user] = await Promise.all([this.getRules(), this.findPlayer(userId)]);
    this.checkIndex(index, rules);
    return { message: 'Character', data: this.detail(user, index, rules) };
  }

  // ⭐ Ascend: server shartein check karta hai aur diamonds ek hi atomic update me kaat'ta hai
  async ascend(userId: string, index: number) {
    const rules = await this.getRules();
    this.checkIndex(index, rules);
    const user = await this.findPlayer(userId);
    const info = this.detail(user, index, rules);
    const next = info.nextStar;

    if (!next) throw new BadRequestException('This character already has all the stars');
    if (!next.checks.level) throw new BadRequestException(`Reach player level ${next.minLevel} first (you are level ${info.player.level})`);
    if (!next.checks.wins) throw new BadRequestException(`Win ${next.minWins} matches first (you have ${info.player.wins})`);
    if (!next.checks.chapter) throw new BadRequestException(`Complete story chapter ${next.chapter} first`);
    if (!next.checks.diamonds) throw new BadRequestException(`You need ${next.diamonds} diamonds (you have ${info.player.diamonds})`);

    const field = `characterStars.${index}`;
    const current = info.stars;
    // dono shartein ek saath: diamonds abhi bhi kaafi hon AUR star abhi bhi wahi ho (do baar tap = ek hi upgrade)
    const result = await this.userModel.updateOne(
      {
        _id: new Types.ObjectId(userId),
        diamond: { $gte: next.diamonds },
        ...(current === 0 ? { $or: [{ [field]: { $exists: false } }, { [field]: 0 }] } : { [field]: current }),
      },
      { $inc: { diamond: -next.diamonds }, $set: { [field]: current + 1 } },
    );
    if (result.modifiedCount !== 1) {
      throw new BadRequestException('Upgrade did not go through (diamonds or stars changed). Please try again.');
    }

    const updated = await this.findPlayer(userId);
    return { message: `Ascended to ${current + 1} star${current + 1 === 1 ? '' : 's'}!`, data: this.detail(updated, index, rules) };
  }

  // 🎮 multiplayer host: kisi bhi player ke character ka attack bonus (stars public info hain)
  async bonusFor(userId: string, index: number) {
    if (!isValidObjectId(userId)) throw new BadRequestException('Invalid user id');
    const rules = await this.getRules();
    this.checkIndex(index, rules);
    const user = await this.userModel.findById(userId).select('characterStars').lean();
    if (!user) throw new NotFoundException('User not found');
    const stars = this.starsOf(user, index);
    return { message: 'Character bonus', data: { userId, index, stars, attackBonus: attackBonusFor(rules, stars) } };
  }
}
