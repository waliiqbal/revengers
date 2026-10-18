/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isValidObjectId, Model, SortOrder } from 'mongoose';
import { DatabaseService } from '../database/databaseservice';
import { LeaderboardQueryDto, ListPlayersQueryDto } from './dto/admin-query.dto';

// admin ko password / fcmToken kabhi nahi bhejna
const HIDDEN_FIELDS = '-password -fcmToken';
const CHART_DAYS = 14;

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class AdminService {
  constructor(private databaseService: DatabaseService) {}

  private get userModel() {
    return this.databaseService.repositories.userModel;
  }

  async getStats() {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const chartStart = new Date(startOfToday.getTime() - (CHART_DAYS - 1) * 24 * 60 * 60 * 1000);
    const players = { role: { $ne: 'admin' } };

    const [
      totalPlayers,
      bannedPlayers,
      removedPlayers,
      newPlayersToday,
      newPlayersLast7Days,
      totalGames,
      gamesToday,
      signupsPerDay,
      gamesPerDay,
    ] = await Promise.all([
      this.userModel.countDocuments({ ...players, isDeleted: { $ne: true } }),
      this.userModel.countDocuments({ ...players, isDeleted: { $ne: true }, isBanned: true }),
      this.userModel.countDocuments({ ...players, isDeleted: true }),
      this.userModel.countDocuments({ ...players, createdAt: { $gte: startOfToday } }),
      this.userModel.countDocuments({ ...players, createdAt: { $gte: sevenDaysAgo } }),
      this.databaseService.repositories.gameModel.countDocuments(),
      this.databaseService.repositories.gameModel.countDocuments({ createdAt: { $gte: startOfToday } }),
      this.countPerDay(this.userModel, { ...players, createdAt: { $gte: chartStart } }),
      this.countPerDay(this.databaseService.repositories.gameModel, { createdAt: { $gte: chartStart } }),
    ]);

    return {
      message: 'Stats fetched successfully',
      data: {
        totalPlayers,
        activePlayers: totalPlayers - bannedPlayers,
        bannedPlayers,
        removedPlayers,
        newPlayersToday,
        newPlayersLast7Days,
        totalGames,
        gamesToday,
        // dashboard charts ke liye: pichle 14 din, har din ka count (UTC dates)
        signupsLast14Days: this.fillDays(chartStart, signupsPerDay),
        gamesLast14Days: this.fillDays(chartStart, gamesPerDay),
      },
    };
  }

  private countPerDay(model: Model<any>, filter: object): Promise<{ _id: string; count: number }[]> {
    return model.aggregate([
      { $match: filter },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]);
  }

  // jis din koi data nahi, us din bhi 0 ke saath entry ho taa ke chart me gap na aaye
  private fillDays(start: Date, rows: { _id: string; count: number }[]) {
    const counts = new Map(rows.map((row) => [row._id, row.count]));
    return Array.from({ length: CHART_DAYS }, (_, i) => {
      const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return { date, count: counts.get(date) || 0 };
    });
  }

  async listPlayers(query: ListPlayersQueryDto) {
    const { page, limit, search, status, sortBy, order } = query;
    const filter: any = { role: { $ne: 'admin' } };

    if (status === 'active') {
      filter.isDeleted = { $ne: true };
      filter.isBanned = { $ne: true };
    } else if (status === 'banned') {
      filter.isDeleted = { $ne: true };
      filter.isBanned = true;
    } else if (status === 'removed') {
      filter.isDeleted = true;
    } else {
      filter.isDeleted = { $ne: true };
    }

    if (search?.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [{ name: regex }, { email: regex }];
    }

    const sort: Record<string, SortOrder> = { [sortBy]: order === 'asc' ? 1 : -1, _id: 1 };

    const [players, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select(HIDDEN_FIELDS)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      message: 'Players fetched successfully',
      data: {
        players,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    };
  }

  async getPlayer(playerId: string) {
    const player = await this.findPlayerOrFail(playerId);

    const recentGames = await this.databaseService.repositories.gameModel
      .find({ 'players.user': player._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return {
      message: 'Player fetched successfully',
      data: { player, recentGames },
    };
  }

  async banPlayer(adminId: string, playerId: string, reason?: string) {
    await this.findPlayerOrFail(playerId, adminId);

    const player = await this.userModel
      .findByIdAndUpdate(
        playerId,
        { $set: { isBanned: true, banReason: reason || null, bannedAt: new Date() } },
        { new: true },
      )
      .select(HIDDEN_FIELDS)
      .lean();

    return { message: 'Player banned successfully', data: player };
  }

  async unbanPlayer(adminId: string, playerId: string) {
    await this.findPlayerOrFail(playerId, adminId);

    const player = await this.userModel
      .findByIdAndUpdate(
        playerId,
        { $set: { isBanned: false, banReason: null, bannedAt: null } },
        { new: true },
      )
      .select(HIDDEN_FIELDS)
      .lean();

    return { message: 'Player unbanned successfully', data: player };
  }

  // soft delete: data rehta hai, player login nahi kar sakta, restore ho sakta hai
  async removePlayer(adminId: string, playerId: string) {
    await this.findPlayerOrFail(playerId, adminId);

    const player = await this.userModel
      .findByIdAndUpdate(
        playerId,
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { new: true },
      )
      .select(HIDDEN_FIELDS)
      .lean();

    return { message: 'Player removed successfully', data: player };
  }

  async restorePlayer(adminId: string, playerId: string) {
    await this.findPlayerOrFail(playerId, adminId);

    const player = await this.userModel
      .findByIdAndUpdate(
        playerId,
        { $set: { isDeleted: false, deletedAt: null } },
        { new: true },
      )
      .select(HIDDEN_FIELDS)
      .lean();

    return { message: 'Player restored successfully', data: player };
  }

  async getLeaderboard(query: LeaderboardQueryDto) {
    const { page, limit, sortBy } = query;
    const filter = { role: { $ne: 'admin' }, isDeleted: { $ne: true }, isBanned: { $ne: true } };

    const [players, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('name email displayPic level totalXp won lost kills death assists totalMatch hours')
        .sort({ [sortBy]: -1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(filter),
    ]);

    const offset = (page - 1) * limit;
    const leaderboard = players.map((player, index) => ({ rank: offset + index + 1, ...player }));

    return {
      message: 'Leaderboard fetched successfully',
      data: {
        sortBy,
        leaderboard,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    };
  }

  // adminId diya ho to: admin khud ko ya dusre admin ko ban/remove nahi kar sakta
  private async findPlayerOrFail(playerId: string, adminId?: string) {
    if (!isValidObjectId(playerId)) {
      throw new BadRequestException('Invalid player id');
    }

    const player = await this.userModel.findById(playerId).select(HIDDEN_FIELDS).lean();
    if (!player) {
      throw new NotFoundException('Player not found');
    }

    if (adminId) {
      if (player._id.toString() === adminId) {
        throw new ForbiddenException('You cannot perform this action on your own account');
      }
      if (player.role === 'admin') {
        throw new ForbiddenException('You cannot perform this action on another admin');
      }
    }

    return player;
  }
}
