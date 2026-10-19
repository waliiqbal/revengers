/* eslint-disable prettier/prettier */
import { MatchRewards, Outcome } from './game.schema';
import { RewardSettings } from '../settings/reward-settings';

// 🏆 Reward NUMBERS admin dashboard (Rewards page) se aate hain → src/settings/reward-settings.ts
// Yahan sirf fixed match rules hain.
export const MATCH_RULES = {
  maxPlayers: 8,
  mvpPlaces: 3,
  pendingSeconds: 120,     // 2 matching reports ka itna intezar, phir majority
  expireMinutes: 30,       // itni der me koi result nahi → abandoned
  maxKills: 60,
};

export function mvpScore(kills: number, assists: number): number {
  return kills * 2 + assists;
}

export function rewardsFor(
  outcome: Outcome,
  kills: number,
  assists: number,
  mvpRank: number,
  rules: RewardSettings['match'],
): MatchRewards {
  const { trophies, xp, coins } = rules;

  if (outcome === 'left') {
    return { trophies: -trophies.left, xp: 0, coins: 0 };
  }

  const matchXp = xp[outcome] + kills * xp.perKill + assists * xp.perAssist;
  const mvpBonus = [coins.mvp1, coins.mvp2, coins.mvp3][mvpRank - 1] ?? 0;

  return {
    trophies: outcome === 'lost' ? -trophies.lost : trophies[outcome],
    xp: Math.min(matchXp, xp.maxPerMatch),
    coins: coins[outcome] + mvpBonus,
  };
}
