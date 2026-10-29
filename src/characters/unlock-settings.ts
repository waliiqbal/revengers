/* eslint-disable prettier/prettier */
// 🔓 Character unlock prices — admin dashboard (Store page) se. price 0 = sab ke liye free.
// User ne kaha: pehla character free, baaki gems se. Document ("You use coins to buy characters")
// ke hisaab se admin kisi bhi character ki currency coins bhi kar sakta hai.
export const UNLOCK_CURRENCIES = ['gem', 'coin'];

// Assets/Prefabs/CharacterList.asset ka order (game ka character index)
export const CHARACTER_NAMES = ['Akkun', 'Chifuyu', 'Kazutora', 'Takemitchy', 'Mitsuya', 'Kiyomasa', 'Pah Chin', 'Osenai'];

export interface CharacterUnlock {
  index: number;
  name: string;
  price: number;      // 0 = free
  currency: string;   // gem | coin
}

export interface UnlockSettings {
  characters: CharacterUnlock[];
}

export const DEFAULT_UNLOCKS: UnlockSettings = {
  characters: CHARACTER_NAMES.map((name, index) => ({ index, name, price: index === 0 ? 0 : 200, currency: 'gem' })),
};

const int = (v: any, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(10000000, Math.max(0, Math.round(n))) : fallback;
};

export function withUnlockDefaults(value: any, count: number): UnlockSettings {
  const characters = Array.from({ length: count }, (_, index) => {
    const def = DEFAULT_UNLOCKS.characters[index] || { index, name: `Character ${index + 1}`, price: 200, currency: 'gem' };
    const saved = (value?.characters || []).find((c: any) => Number(c?.index) === index) || {};
    return {
      index,
      name: def.name,
      price: int(saved.price, def.price),
      currency: UNLOCK_CURRENCIES.includes(saved.currency) ? saved.currency : def.currency,
    };
  });
  return { characters };
}
