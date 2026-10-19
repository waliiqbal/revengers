/* eslint-disable prettier/prettier */
import { MatchRewards, Outcome } from './game.schema';

// 🏆 Saare reward numbers yahan hain — change karne ho to sirf yeh file badlo
export const REWARD_RULES = {
  trophies: { won: 30, draw: 10, lost: -15, left: -15 },
  xp: { won: 100, draw: 60, lost: 40, left: 0, perKill: 10, perAssist: 5, maxPerMatch: 300 },
  coins: { won: 50, draw: 30, lost: 20, left: 0, mvp: [25, 15, 10] },
  trophiesPerLevel: 75,
};

export const MATCH_RULES = {
  maxPlayers: 8,
  minSeconds: Number(process.env.MATCH_MIN_SECONDS ?? 60),   // is se chhota match → koi reward nahi
  pendingSeconds: 120,                                      // 2 matching reports ka itna intezar, phir majority
  expireMinutes: 30,                                        // itni der me koi result nahi → abandoned
  maxKills: 60,
};

export function levelForTrophies(trophies: number): number {
  return 1 + Math.floor(Math.max(trophies, 0) / REWARD_RULES.trophiesPerLevel);
}

export function mvpScore(kills: number, assists: number): number {
  return kills * 2 + assists;
}

export function rewardsFor(outcome: Outcome, kills: number, assists: number, mvpRank: number): MatchRewards {
  const { trophies, xp, coins } = REWARD_RULES;

  if (outcome === 'left') {
    return { trophies: trophies.left, xp: 0, coins: 0 };
  }

  const matchXp = xp[outcome] + kills * xp.perKill + assists * xp.perAssist;
  const mvpBonus = mvpRank >= 1 && mvpRank <= coins.mvp.length ? coins.mvp[mvpRank - 1] : 0;

  return {
    trophies: trophies[outcome],
    xp: Math.min(matchXp, xp.maxPerMatch),
    coins: coins[outcome] + mvpBonus,
  };
}
