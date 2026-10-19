/* eslint-disable prettier/prettier */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/databaseservice';
import { CompleteStageDto } from './dto/story.dto';
import { lastStageOfChapter, STORY_RULES, STORY_STAGES } from './story-rewards';

const NO_REWARDS = { coins: 0, skillPoints: 0 };

@Injectable()
export class StoryService {
  constructor(private databaseService: DatabaseService) {}

  private get userModel() {
    return this.databaseService.repositories.userModel;
  }

  // ── GET /story/progress ─────────────────────────────────────────────────
  async getProgress(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('storyStage skillPoints chaptersCompleted')
      .lean();
    if (!user) throw new NotFoundException('User not found');

    const cleared = user.storyStage || 0;
    const lastStage = STORY_STAGES[STORY_STAGES.length - 1].stage;

    return {
      message: 'Story progress',
      data: {
        storyStage: cleared,
        nextStage: Math.min(cleared + 1, lastStage),   // sab clear → aakhri stage dobara
        allCleared: cleared >= lastStage,
        skillPoints: user.skillPoints || 0,
        chaptersCompleted: user.chaptersCompleted || [],
        stages: STORY_STAGES.map((s) => ({
          ...s,
          cleared: s.stage <= cleared,
          unlocked: s.stage <= cleared + 1,
        })),
      },
    };
  }

  // ── POST /story/start ───────────────────────────────────────────────────
  // Stage sirf order me khulte hain: storyStage + 1 tak hi khel sakte hain
  async startStage(userId: string, stageNumber: number) {
    const stage = STORY_STAGES.find((s) => s.stage === stageNumber);
    if (!stage) throw new BadRequestException(`Stage ${stageNumber} does not exist`);

    const user = await this.userModel.findById(userId).select('storyStage').lean();
    if (!user) throw new NotFoundException('User not found');
    if (stage.stage > (user.storyStage || 0) + 1) {
      throw new ForbiddenException(`Stage ${stage.code} is locked. Clear the previous stage first.`);
    }

    const runId = randomUUID();
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { storyRun: { id: runId, stage: stage.stage, startedAt: new Date() } } },
    );
    return { message: 'Stage started', data: { runId, stage: stage.stage, code: stage.code } };
  }

  // ── POST /story/complete ────────────────────────────────────────────────
  // Pehli baar clear → coins + skill points (aur chapter poora ho to record). Replay → kuch nahi.
  async completeStage(userId: string, dto: CompleteStageDto) {
    // run ko ek hi baar use kar sakte hain (atomic claim)
    const before = await this.userModel
      .findOneAndUpdate({ _id: userId, 'storyRun.id': dto.runId }, { $set: { storyRun: null } })
      .select('storyRun storyStage')
      .lean();
    if (!before?.storyRun) {
      throw new BadRequestException('Unknown or already finished stage run');
    }

    const run = before.storyRun;
    const stage = STORY_STAGES.find((s) => s.stage === run.stage);
    const seconds = (Date.now() - new Date(run.startedAt).getTime()) / 1000;
    const base = { stage: stage.stage, code: stage.code, won: dto.won, firstClear: false, rewards: NO_REWARDS, chapterCompleted: null };

    if (!dto.won) {
      return this.result('Stage failed', userId, base);
    }
    if (seconds < STORY_RULES.minStageSeconds || seconds > STORY_RULES.runExpiryMinutes * 60) {
      return this.result('Stage cleared, but the run was too short or too old for rewards', userId, base);
    }
    if (stage.stage !== (before.storyStage || 0) + 1) {
      return this.result('Stage cleared again (rewards are for the first clear only)', userId, base);
    }

    const finishesChapter = stage.stage === lastStageOfChapter(stage.chapter);
    const rewards = { coins: stage.coins, skillPoints: stage.skillPoints };
    const update: any = {
      $set: { storyStage: stage.stage },
      $inc: { coin: rewards.coins, skillPoints: rewards.skillPoints },
    };
    if (finishesChapter) update.$addToSet = { chaptersCompleted: stage.chapter };

    // condition storyStage = stage - 1 → do baar ek saath call ho to bhi reward ek hi baar.
    // Purane accounts me storyStage field hi nahi hota (null match karta hai missing field ko).
    const previous = before.storyStage || 0;
    const stageFilter = previous === 0 ? { $in: [0, null] } : previous;
    const paid = await this.userModel.updateOne({ _id: userId, storyStage: stageFilter }, update);
    if (paid.modifiedCount !== 1) {
      return this.result('Stage cleared again (rewards are for the first clear only)', userId, base);
    }

    return this.result('Stage cleared!', userId, {
      ...base,
      firstClear: true,
      rewards,
      chapterCompleted: finishesChapter ? stage.chapter : null,
    });
  }

  private async result(message: string, userId: string, data: any) {
    const user = await this.userModel.findById(userId).select('storyStage').lean();
    const cleared = user?.storyStage || 0;
    const lastStage = STORY_STAGES[STORY_STAGES.length - 1].stage;
    return {
      message,
      data: { ...data, storyStage: cleared, nextStage: Math.min(cleared + 1, lastStage), allCleared: cleared >= lastStage },
    };
  }
}
