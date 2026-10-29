/* eslint-disable prettier/prettier */
// ⭐ Character ascension (document: "5 STAR GENERAL ASCENSION"). Shards ki jagah Diamonds lagte hain.
// Har star ka: diamonds kitne, kitne wins, kaunsa player level, kaunsa story chapter poora ho, aur kitna attack milta hai.
// Admin dashboard (Store page) se badalte hain; database me na hon to yeh defaults.
export interface AscensionStar {
  star: number;          // 1..5
  diamonds: number;      // document me shards: 50 / 100 / 200 / 300 / 300
  minWins: number;       // document: 1★ 25 wins, 3★ 200, 4★ 400
  minLevel: number;      // document: 1★ lvl 20, 2★ 40, 3★ 60, 4★ 80
  chapter: number;       // document: 2★ chapter 1, 5★ chapter 2 (0 = koi chapter nahi chahiye)
  attackBonus: number;   // document: har star +5 physical attack
}

export interface AscensionSettings {
  stars: AscensionStar[];
  maxCharacters: number;  // game me kitne characters hain (index 0 .. maxCharacters-1)
}

export const DEFAULT_ASCENSION: AscensionSettings = {
  maxCharacters: 8,   // Assets/Prefabs/CharacterList.asset: Akkun, Chifuyu, Kazutora, Takemitchy, Mitsuya, Kiyomasa, Pah Chin, Osenai
  stars: [
    { star: 1, diamonds: 50, minWins: 25, minLevel: 20, chapter: 0, attackBonus: 5 },
    { star: 2, diamonds: 100, minWins: 0, minLevel: 40, chapter: 1, attackBonus: 5 },
    { star: 3, diamonds: 200, minWins: 200, minLevel: 60, chapter: 0, attackBonus: 5 },
    { star: 4, diamonds: 300, minWins: 400, minLevel: 80, chapter: 0, attackBonus: 5 },
    { star: 5, diamonds: 300, minWins: 0, minLevel: 0, chapter: 2, attackBonus: 5 },
  ],
};

const int = (v: any, fallback: number, min = 0, max = 10000000) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

// database / admin se aayi value ko hamesha poora aur sahi shape me lao
export function withAscensionDefaults(value: any): AscensionSettings {
  const stars = DEFAULT_ASCENSION.stars.map((def, i) => {
    const s = value?.stars?.[i] || {};
    return {
      star: def.star,
      diamonds: int(s.diamonds, def.diamonds),
      minWins: int(s.minWins, def.minWins),
      minLevel: int(s.minLevel, def.minLevel, 0, 1000),
      chapter: int(s.chapter, def.chapter, 0, 100),
      attackBonus: int(s.attackBonus, def.attackBonus, 0, 1000),
    };
  });
  return { stars, maxCharacters: int(value?.maxCharacters, DEFAULT_ASCENSION.maxCharacters, 1, 100) };
}

// kitne stars pe kitna total attack bonus (stars 1..n ka jod)
export const attackBonusFor = (settings: AscensionSettings, stars: number) =>
  settings.stars.slice(0, Math.max(0, Math.min(stars, settings.stars.length))).reduce((sum, s) => sum + s.attackBonus, 0);
