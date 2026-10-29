/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { DatabaseService } from '../database/databaseservice';

// game me dikhne wali leaderboard ki categories (admin wali me zyada hain)
export const PUBLIC_LEADERBOARD_FIELDS = ['trophies', 'level', 'won', 'kills'];

// sirf yeh fields players ko dikhte hain — email waghera kabhi nahi
const PUBLIC_FIELDS = 'name displayPic level trophies won kills totalMatch';

@Injectable()
export class LeaderboardService {
  constructor(private databaseService: DatabaseService) {}

  private get userModel() {
    return this.databaseService.repositories.userModel;
  }

  // banned, removed aur admin accounts leaderboard me nahi aate
  private readonly ranked = { role: { $ne: 'admin' }, isDeleted: { $ne: true }, isBanned: { $ne: true } };

  async getLeaderboard(userId: string, sortBy: string, page: number, limit: number) {
    const [players, total, me] = await Promise.all([
      this.userModel
        .find(this.ranked)
        .select(PUBLIC_FIELDS)
        .sort({ [sortBy]: -1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(this.ranked),
      this.myEntry(userId, sortBy),
    ]);

    const offset = (page - 1) * limit;
    return {
      message: 'Leaderboard fetched',
      data: {
        sortBy,
        leaderboard: players.map((p, i) => this.entry(p, offset + i + 1, userId)),
        me,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // player ka apna rank — wahi order jo list me hai (value desc, phir _id asc)
  private async myEntry(userId: string, sortBy: string) {
    const me = await this.userModel.findOne({ _id: new Types.ObjectId(userId), ...this.ranked }).select(PUBLIC_FIELDS).lean();
    if (!me) return null;

    // MongoDB descending sort: numbers first (bade se chhote), phir jin ke paas field hi nahi (purane accounts)
    const value = me[sortBy];
    const hasValue = typeof value === 'number';
    const ahead = await this.userModel.countDocuments({
      ...this.ranked,
      $or: hasValue
        ? [{ [sortBy]: { $gt: value } }, { [sortBy]: value, _id: { $lt: me._id } }]
        : [{ [sortBy]: { $type: 'number' } }, { [sortBy]: null, _id: { $lt: me._id } }],
    });
    return this.entry(me, ahead + 1, userId);
  }

  private entry(p: any, rank: number, userId: string) {
    return {
      rank,
      _id: String(p._id),
      name: p.name || 'Player',
      displayPic: p.displayPic || '',
      level: p.level || 1,
      trophies: p.trophies || 0,
      won: p.won || 0,
      kills: p.kills || 0,
      totalMatch: p.totalMatch || 0,
      isMe: String(p._id) === String(userId),
    };
  }
}
