/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isValidObjectId, Types } from 'mongoose';
import { DatabaseService } from '../database/databaseservice';
import { AscensionSettings, attackBonusFor, DEFAULT_ASCENSION, withAscensionDefaults } from './ascension-settings';
import { DEFAULT_UNLOCKS, UnlockSettings, withUnlockDefaults } from './unlock-settings';

const ASCENSION_KEY = 'ascension';
const UNLOCKS_KEY = 'characterUnlocks';
const CURRENCY_FIELD: Record<string, string> = { gem: 'gem', coin: 'coin' };   // user schema ke fields
const CURRENCY_NAME: Record<string, string> = { gem: 'gems', coin: 'coins' };

@Injectable()
export class CharactersService {
  private cache: { value: AscensionSettings; updatedAt: Date | null; updatedBy: any } | null = null;
  private unlockCache: { value: UnlockSettings; updatedAt: Date | null; updatedBy: any } | null = null;

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
    this.unlockCache = null;   // maxCharacters se unlock list ki lambai banti hai
    return this.getRulesWithMeta();
  }

  async resetRules(adminId: string) {
    return this.saveRules(adminId, DEFAULT_ASCENSION);
  }

  // ---------------- unlock prices (admin dashboard) ----------------
  private async loadUnlocks() {
    if (!this.unlockCache) {
      const [doc, rules]: any[] = await Promise.all([this.settingModel.findById(UNLOCKS_KEY).lean(), this.getRules()]);
      this.unlockCache = { value: withUnlockDefaults(doc?.value, rules.maxCharacters), updatedAt: doc?.updatedAt ?? null, updatedBy: doc?.updatedBy ?? null };
    }
    return this.unlockCache;
  }

  async getUnlocksWithMeta() {
    const { value, updatedAt, updatedBy } = await this.loadUnlocks();
    let by = null;
    if (updatedBy) by = (await this.userModel.findById(updatedBy).select('email').lean())?.email ?? null;
    return { settings: value, defaults: withUnlockDefaults(DEFAULT_UNLOCKS, value.characters.length), updatedAt, updatedBy: by };
  }

  async saveUnlocks(adminId: string, value: any) {
    const rules = await this.getRules();
    await this.settingModel.updateOne(
      { _id: UNLOCKS_KEY },
      { $set: { value: withUnlockDefaults(value, rules.maxCharacters), updatedBy: new Types.ObjectId(adminId) } },
      { upsert: true },
    );
    this.unlockCache = null;
    return this.getUnlocksWithMeta();
  }

  async resetUnlocks(adminId: string) {
    return this.saveUnlocks(adminId, DEFAULT_UNLOCKS);
  }

  // free (price 0) ya khareeda hua
  private isUnlocked(user: any, index: number, unlocks: UnlockSettings) {
    const price = unlocks.characters[index]?.price ?? 0;
    return price === 0 || (user?.unlockedCharacters || []).includes(index);
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
  private detail(user: any, index: number, rules: AscensionSettings, unlocks: UnlockSettings) {
    const stars = this.starsOf(user, index);
    const next = rules.stars[stars] || null;   // stars = 5 ho to null (max)
    const chapters: number[] = user.chaptersCompleted || [];
    const have = { diamonds: user.diamond || 0, wins: user.won || 0, level: user.level || 1, gems: user.gem || 0, coins: user.coin || 0 };
    const unlock = unlocks.characters[index];
    const unlocked = this.isUnlocked(user, index, unlocks);

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
    const balance = unlock?.currency === 'coin' ? have.coins : have.gems;
    return {
      index,
      name: unlock?.name || `Character ${index + 1}`,
      unlocked,
      unlockPrice: unlock?.price || 0,
      unlockCurrency: unlock?.currency || 'gem',
      canUnlock: !unlocked && balance >= (unlock?.price || 0),
      stars,
      maxStars: rules.stars.length,
      attackBonus: attackBonusFor(rules, stars),
      nextStar,
      player: have,
      chaptersCompleted: chapters,
    };
  }

  private async findPlayer(userId: string) {
    const user = await this.userModel.findById(userId).select('diamond gem coin won level chaptersCompleted characterStars unlockedCharacters').lean();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async context(userId: string) {
    const [rules, unlocks, user] = await Promise.all([this.getRules(), this.loadUnlocks().then((u) => u.value), this.findPlayer(userId)]);
    return { rules, unlocks, user };
  }

  async getAll(userId: string) {
    const { rules, unlocks, user } = await this.context(userId);
    const characters = Array.from({ length: rules.maxCharacters }, (_, i) => this.detail(user, i, rules, unlocks));
    return { message: 'Characters', data: { characters, rules: rules.stars } };
  }

  async getOne(userId: string, index: number) {
    const { rules, unlocks, user } = await this.context(userId);
    this.checkIndex(index, rules);
    return { message: 'Character', data: this.detail(user, index, rules, unlocks) };
  }

  // 🔓 Unlock: price aur currency admin dashboard se; server gems/coins ek atomic update me kaat'ta hai
  async unlock(userId: string, index: number) {
    const { rules, unlocks, user } = await this.context(userId);
    this.checkIndex(index, rules);
    if (this.isUnlocked(user, index, unlocks)) throw new BadRequestException('You already have this character');

    const { price, currency, name } = unlocks.characters[index];
    const field = CURRENCY_FIELD[currency];
    const balance = user[field] || 0;
    if (balance < price) throw new BadRequestException(`You need ${price} ${CURRENCY_NAME[currency]} to unlock ${name} (you have ${balance})`);

    // "abhi tak nahi khareeda" + "paise kaafi" dono ek saath — do baar tap = ek hi khareed
    const result = await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId), [field]: { $gte: price }, unlockedCharacters: { $ne: index } },
      { $inc: { [field]: -price }, $addToSet: { unlockedCharacters: index } },
    );
    if (result.modifiedCount !== 1) throw new BadRequestException('Unlock did not go through. Please try again.');

    const updated = await this.findPlayer(userId);
    return { message: `${name} unlocked!`, data: this.detail(updated, index, rules, unlocks) };
  }

  // ⭐ Ascend: server shartein check karta hai aur diamonds ek hi atomic update me kaat'ta hai
  async ascend(userId: string, index: number) {
    const { rules, unlocks, user } = await this.context(userId);
    this.checkIndex(index, rules);
    const info = this.detail(user, index, rules, unlocks);
    const next = info.nextStar;

    if (!info.unlocked) throw new BadRequestException(`Unlock ${info.name} first`);
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
    return { message: `Ascended to ${current + 1} star${current + 1 === 1 ? '' : 's'}!`, data: this.detail(updated, index, rules, unlocks) };
  }

  // 🎮 multiplayer host: kisi bhi player ke character ka attack bonus aur kya uske paas yeh character hai
  // (host isi se check karta hai — locked character spawn nahi hota)
  async bonusFor(userId: string, index: number) {
    if (!isValidObjectId(userId)) throw new BadRequestException('Invalid user id');
    const [rules, unlocks] = await Promise.all([this.getRules(), this.loadUnlocks().then((u) => u.value)]);
    this.checkIndex(index, rules);
    const user = await this.userModel.findById(userId).select('characterStars unlockedCharacters').lean();
    if (!user) throw new NotFoundException('User not found');
    const stars = this.starsOf(user, index);
    const unlocked = this.isUnlocked(user, index, unlocks);
    return { message: 'Character bonus', data: { userId, index, unlocked, stars, attackBonus: unlocked ? attackBonusFor(rules, stars) : 0 } };
  }
}
