/* eslint-disable prettier/prettier */
import { STORY_STAGES } from '../story/story-rewards';

// 🎁 Saare reward numbers jo admin dashboard (Rewards page) se badal sakte hain.
// Database me na hon to yeh defaults use hote hain.
export interface RewardSettings {
  match: {
    trophies: { won: number; draw: number; lost: number; left: number };   // lost / left = kitne trophies kam honge
    xp: { won: number; draw: number; lost: number; perKill: number; perAssist: number; maxPerMatch: number };
    coins: { won: number; draw: number; lost: number; mvp1: number; mvp2: number; mvp3: number };
    trophiesPerLevel: number;
    minMatchSeconds: number;
  };
  story: {
    minStageSeconds: number;
    stages: { stage: number; coins: number; skillPoints: number }[];
  };
}

export const DEFAULT_REWARD_SETTINGS: RewardSettings = {
  match: {
    trophies: { won: 30, draw: 10, lost: 15, left: 15 },
    xp: { won: 100, draw: 60, lost: 40, perKill: 10, perAssist: 5, maxPerMatch: 300 },
    coins: { won: 50, draw: 30, lost: 20, mvp1: 25, mvp2: 15, mvp3: 10 },
    trophiesPerLevel: 75,
    minMatchSeconds: Number(process.env.MATCH_MIN_SECONDS ?? 60),
  },
  story: {
    minStageSeconds: Number(process.env.STORY_MIN_SECONDS ?? 15),
    stages: STORY_STAGES.map((s) => ({ stage: s.stage, coins: s.coins, skillPoints: s.skillPoints })),
  },
};

// DB value + defaults → har field hamesha mojood (naye fields ke liye bhi)
export function withDefaults(saved: any): RewardSettings {
  const d = DEFAULT_REWARD_SETTINGS;
  const m = saved?.match ?? {};
  const s = saved?.story ?? {};
  const savedStages = new Map<number, any>((s.stages ?? []).map((x: any) => [x.stage, x]));
  return {
    match: {
      trophies: { ...d.match.trophies, ...m.trophies },
      xp: { ...d.match.xp, ...m.xp },
      coins: { ...d.match.coins, ...m.coins },
      trophiesPerLevel: m.trophiesPerLevel ?? d.match.trophiesPerLevel,
      minMatchSeconds: m.minMatchSeconds ?? d.match.minMatchSeconds,
    },
    story: {
      minStageSeconds: s.minStageSeconds ?? d.story.minStageSeconds,
      stages: d.story.stages.map((def) => ({ ...def, ...(savedStages.get(def.stage) ?? {}), stage: def.stage })),
    },
  };
}
