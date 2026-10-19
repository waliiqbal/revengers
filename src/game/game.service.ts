/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Types } from 'mongoose';
import { DatabaseService } from '../database/databaseservice';
import { GameWonDto, StartGameDto } from './dto/match.dto';
import { GamePlayer, Outcome, Team } from './game.schema';
import { MATCH_RULES, mvpScore, REWARD_RULES, rewardsFor } from './rewards';

const MAINTENANCE_INTERVAL_MS = 30 * 1000;

@Injectable()
export class GameService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameService.name);
  private timer: NodeJS.Timeout;

  constructor(private databaseService: DatabaseService) {}

  private get gameModel() {
    return this.databaseService.repositories.gameModel;
  }

  // ⏱️ har 30 sec: pending matches finalize, purane matches abandon, failed rewards retry
  onModuleInit() {
    this.timer = setInterval(() => {
      this.runMaintenance().catch((error) => this.logger.error(`Match maintenance failed: ${error.message}`));
    }, MAINTENANCE_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  // ── POST /Game/startGame ────────────────────────────────────────────────
  // Har player apne device se call karta hai; same matchKey → same match document
  async startGame(userId: string, dto: StartGameDto) {
    const user = new Types.ObjectId(userId);

    try {
      await this.gameModel.updateOne(
        { matchKey: dto.matchKey },
        { $setOnInsert: { matchKey: dto.matchKey, status: 'active', players: [] } },
        { upsert: true },
      );
    } catch (error) {
      // do players ne bilkul ek saath create kiya — dusra wala bas join karega
      if (error.code !== 11000) throw error;
    }

    const entry: GamePlayer = { user, team: dto.team as Team, isHost: !!dto.isHost, joinedAt: new Date() };
    await this.gameModel.updateOne(
      {
        matchKey: dto.matchKey,
        status: 'active',
        'players.user': { $ne: user },
        [`players.${MATCH_RULES.maxPlayers - 1}`]: { $exists: false },
      },
      { $push: { players: entry } },
    );
    if (dto.isHost) {
      await this.gameModel.updateOne({ matchKey: dto.matchKey, hostUser: null }, { $set: { hostUser: user } });
    }

    const game = await this.gameModel.findOne({ matchKey: dto.matchKey }).lean();
    const joined = game.players.some((p) => p.user.equals(user));
    if (!joined && game.status === 'active') {
      throw new BadRequestException('This match is already full');
    }

    return {
      message: 'Game successfully started',
      data: { gameId: game._id, matchKey: game.matchKey, status: game.status, players: game.players.length },
    };
  }

  // ── POST /Game/GameWon ──────────────────────────────────────────────────
  // Har player apna report bhejta hai; 2 same reports aate hi sab ko ek baar rewards milte hain
  async reportResult(userId: string, dto: GameWonDto) {
    const user = new Types.ObjectId(userId);
    let game = await this.findParticipantGame(dto.matchKey, user);

    if (game.status !== 'active') {
      return this.resultFor(game, user);
    }

    const participants = new Set(game.players.map((p) => p.user.toString()));
    const seen = new Set<string>();
    for (const row of dto.scoreboard) {
      if (!participants.has(row.userId)) {
        throw new BadRequestException(`Player ${row.userId} is not part of this match`);
      }
      if (seen.has(row.userId)) {
        throw new BadRequestException(`Player ${row.userId} appears twice in the scoreboard`);
      }
      seen.add(row.userId);
    }

    const payload = {
      winnerTeam: dto.winnerTeam,
      teamAScore: dto.teamAScore,
      teamBScore: dto.teamBScore,
      durationSeconds: dto.durationSeconds,
      scoreboard: dto.scoreboard
        .map(({ userId: id, kills, deaths, assists }) => ({ userId: id, kills, deaths, assists }))
        .sort((a, b) => a.userId.localeCompare(b.userId)),
    };
    // duration aur team scores har device pe thode alag ho sakte hain, is liye hash me nahi
    const hash = createHash('sha1')
      .update(JSON.stringify({ winnerTeam: payload.winnerTeam, scoreboard: payload.scoreboard }))
      .digest('hex');

    await this.gameModel.updateOne(
      { _id: game._id, status: 'active', 'reports.user': { $ne: user } },
      { $push: { reports: { user, hash, payload, at: new Date() } } },
    );

    game = await this.gameModel.findById(game._id).lean();
    if (game.status === 'active') {
      const agreeing = game.reports.filter((r) => r.hash === hash).length;
      if (agreeing >= 2 || game.players.length === 1) {
        await this.finalize(game._id, hash, 'reported');
      }
      game = await this.gameModel.findById(game._id).lean();
    }

    return this.resultFor(game, user);
  }

  // ── POST /Game/hostLeft ─────────────────────────────────────────────────
  async reportHostLeft(userId: string, matchKey: string) {
    const user = new Types.ObjectId(userId);
    let game = await this.findParticipantGame(matchKey, user);

    if (game.status === 'active' && game.hostUser && !game.hostUser.equals(user)) {
      await this.gameModel.updateOne({ _id: game._id, status: 'active' }, { $addToSet: { hostLeftReports: user } });
      game = await this.gameModel.findById(game._id).lean();

      const otherPlayers = game.players.filter((p) => !p.user.equals(game.hostUser)).length;
      const needed = Math.min(2, Math.max(otherPlayers, 1));
      if (game.status === 'active' && game.hostLeftReports.length >= needed) {
        await this.abandonForHostLeaving(game._id);
        game = await this.gameModel.findById(game._id).lean();
      }
    }

    return this.resultFor(game, user);
  }

  // ── GET /Game/result ────────────────────────────────────────────────────
  async getResult(userId: string, matchKey: string) {
    const user = new Types.ObjectId(userId);
    return this.resultFor(await this.findParticipantGame(matchKey, user), user);
  }

  // ── Background maintenance ──────────────────────────────────────────────
  async runMaintenance(now = new Date()) {
    // 1) reports aaye lekin 2 match nahi kiye → 2 min baad jo version sab se zyada aaya woh use karo
    const pendingBefore = new Date(now.getTime() - MATCH_RULES.pendingSeconds * 1000);
    const pending = await this.gameModel
      .find({ status: 'active', 'reports.0.at': { $lte: pendingBefore } })
      .select('reports')
      .lean();
    for (const game of pending) {
      await this.finalize(game._id, this.mostAgreedHash(game.reports), 'timeout');
    }

    // 2) koi report hi nahi aaya → 30 min baad abandoned, kisi ko kuch nahi
    const expireBefore = new Date(now.getTime() - MATCH_RULES.expireMinutes * 60 * 1000);
    await this.gameModel.updateMany(
      { status: 'active', createdAt: { $lte: expireBefore }, 'reports.0': { $exists: false } },
      { $set: { status: 'abandoned', endReason: 'expired', endedAt: now, rewardsApplied: true } },
    );

    // 3) rewards lagate waqt crash hua tha → dobara try
    const retryBefore = new Date(now.getTime() - 60 * 1000);
    const unpaid = await this.gameModel
      .find({ status: { $in: ['completed', 'abandoned'] }, rewardsApplied: false, endedAt: { $lte: retryBefore } })
      .select('_id')
      .lean();
    for (const game of unpaid) {
      await this.applyRewards(game._id);
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────
  private async finalize(gameId: unknown, hash: string, reason: 'reported' | 'timeout') {
    const game = await this.gameModel.findById(gameId).lean();
    if (!game || game.status !== 'active') return;

    const report = game.reports.find((r) => r.hash === hash);
    const { winnerTeam, teamAScore, teamBScore, durationSeconds, scoreboard } = report.payload;
    const now = new Date();
    const serverSeconds = (now.getTime() - new Date(game.createdAt).getTime()) / 1000;

    // bohot chhota match (test / exploit) → record karo lekin reward nahi
    if (serverSeconds < MATCH_RULES.minSeconds) {
      await this.gameModel.updateOne(
        { _id: gameId, status: 'active' },
        { $set: { status: 'abandoned', endReason: 'too_short', endedAt: now, rewardsApplied: true, winnerTeam, teamAScore, teamBScore } },
      );
      return;
    }

    const rows = new Map<string, { kills: number; deaths: number; assists: number }>(
      scoreboard.map((row) => [row.userId, row]),
    );

    // MVP: (kills × 2 + assists) zyada → pehle; barabar ho to kam deaths, phir jeetne wali team
    const ranked = game.players
      .filter((p) => rows.has(p.user.toString()))
      .map((p) => ({ id: p.user.toString(), team: p.team, ...rows.get(p.user.toString()) }))
      .map((p) => ({ ...p, score: mvpScore(p.kills, p.assists) }))
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score || a.deaths - b.deaths || Number(b.team === winnerTeam) - Number(a.team === winnerTeam));
    const mvpRanks = new Map(ranked.slice(0, REWARD_RULES.coins.mvp.length).map((p, i) => [p.id, i + 1]));

    const players = game.players.map((p) => {
      const row = rows.get(p.user.toString());
      // scoreboard me nahi → match khatam hone se pehle chala gaya
      const outcome: Outcome = !row ? 'left' : winnerTeam === 'draw' ? 'draw' : p.team === winnerTeam ? 'won' : 'lost';
      const kills = row?.kills ?? 0;
      const assists = row?.assists ?? 0;
      const mvpRank = mvpRanks.get(p.user.toString()) ?? 0;
      return {
        ...p,
        outcome,
        result: outcome === 'won',
        score: mvpScore(kills, assists),
        kills,
        deaths: row?.deaths ?? 0,
        assists,
        mvpRank,
        rewards: rewardsFor(outcome, kills, assists, mvpRank),
      };
    });

    const claimed = await this.gameModel.updateOne(
      { _id: gameId, status: 'active' },
      {
        $set: {
          status: 'completed',
          endReason: reason,
          endedAt: now,
          rewardsApplied: false,
          winnerTeam,
          teamAScore,
          teamBScore,
          durationSeconds: Math.min(Math.round(Math.min(durationSeconds, serverSeconds)), 3600),
          players,
        },
      },
    );
    // sirf ek hi call match ko complete kar sakti hai → rewards ek hi baar
    if (claimed.modifiedCount === 1) {
      await this.applyRewards(gameId);
    }
  }

  private async abandonForHostLeaving(gameId: unknown) {
    const game = await this.gameModel.findById(gameId).lean();
    const players = game.players.map((p) =>
      p.user.equals(game.hostUser)
        ? { ...p, outcome: 'left' as Outcome, result: false, rewards: rewardsFor('left', 0, 0, 0) }
        : p,
    );
    const claimed = await this.gameModel.updateOne(
      { _id: gameId, status: 'active' },
      { $set: { status: 'abandoned', endReason: 'host_left', endedAt: new Date(), rewardsApplied: false, players } },
    );
    if (claimed.modifiedCount === 1) {
      await this.applyRewards(gameId);
    }
  }

  // users pe trophies / XP / coins / stats lagao — trophies 0 se neeche nahi, level kabhi kam nahi
  private async applyRewards(gameId: unknown) {
    const game = await this.gameModel.findById(gameId).lean();
    if (!game || game.rewardsApplied) return;

    const hours = Math.round(((game.durationSeconds || 0) / 3600) * 100) / 100;
    const add = (field: string, value: number) => ({ $add: [{ $ifNull: [`$${field}`, 0] }, value] });

    const operations = game.players
      .filter((p) => p.outcome && p.rewards)
      .map((p) => {
        const r = p.rewards;
        const finished = p.outcome !== 'left';
        return {
          updateOne: {
            filter: { _id: p.user },
            update: [
              {
                $set: {
                  trophies: { $max: [0, add('trophies', r.trophies)] },
                  totalXp: add('totalXp', r.xp),
                  currentXp: add('currentXp', r.xp),
                  coin: add('coin', r.coins),
                  totalMatch: add('totalMatch', 1),
                  won: add('won', p.outcome === 'won' ? 1 : 0),
                  lost: add('lost', p.outcome === 'lost' || p.outcome === 'left' ? 1 : 0),
                  kills: add('kills', p.kills || 0),
                  death: add('death', p.deaths || 0),
                  assists: add('assists', p.assists || 0),
                  hours: add('hours', finished ? hours : 0),
                },
              },
              {
                $set: {
                  level: {
                    $max: [
                      { $ifNull: ['$level', 1] },
                      { $add: [1, { $floor: { $divide: ['$trophies', REWARD_RULES.trophiesPerLevel] } }] },
                    ],
                  },
                },
              },
            ],
          },
        };
      });

    if (operations.length) {
      await this.databaseService.repositories.userModel.collection.bulkWrite(operations as any, { ordered: false });
    }
    await this.gameModel.updateOne({ _id: gameId }, { $set: { rewardsApplied: true } });
  }

  private mostAgreedHash(reports: { hash: string }[]) {
    const counts = new Map<string, number>();
    for (const r of reports) counts.set(r.hash, (counts.get(r.hash) || 0) + 1);
    // barabar ho to jo pehle aaya (Map insertion order = report order)
    return [...counts.entries()].reduce((best, current) => (current[1] > best[1] ? current : best))[0];
  }

  private async findParticipantGame(matchKey: string, user: Types.ObjectId) {
    const game = await this.gameModel.findOne({ matchKey }).lean();
    if (!game) {
      throw new NotFoundException('Match not found');
    }
    if (!game.players.some((p) => p.user.equals(user))) {
      throw new ForbiddenException('You are not part of this match');
    }
    return game;
  }

  private resultFor(game: any, user: Types.ObjectId) {
    const me = game.players.find((p) => p.user.equals(user));
    const settled = game.status !== 'active';
    return {
      message: settled ? 'Match result' : 'Result received, waiting for other players',
      data: {
        matchKey: game.matchKey,
        status: game.status,             // active = abhi pending, completed, abandoned
        endReason: game.endReason,
        winnerTeam: game.winnerTeam,
        outcome: settled ? me?.outcome ?? null : null,
        mvpRank: me?.mvpRank ?? 0,
        rewards: settled ? me?.rewards ?? null : null,
      },
    };
  }
}
