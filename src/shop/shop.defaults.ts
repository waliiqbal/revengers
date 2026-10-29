/* eslint-disable prettier/prettier */
// Store ki shuruaati values — bilkul wahi jo game ke Store_Screen prefab aur panel scripts me hain
// (CoinPanel / GemsPanel / DiamondsPanel). "Reset to game defaults" bhi inhi pe wapas laata hai.
export interface ShopItemDefaults {
  section: string;
  slot: number;
  title: string;
  amount: number;
  description?: string;
  price: number;
}

const packs = (section: string, amounts: number[], prices: number[]): ShopItemDefaults[] =>
  amounts.map((amount, i) => ({ section, slot: i + 1, title: `PACK NO ${i + 1}`, amount, price: prices[i] }));

export const SHOP_DEFAULTS: ShopItemDefaults[] = [
  // Coins tab: asli paise (card pe likha price)
  { section: 'coins', slot: 1, title: 'Bundle 1', amount: 100, price: 4.99 },
  { section: 'coins', slot: 2, title: 'Bundle 2', amount: 200, price: 9.99 },
  { section: 'coins', slot: 3, title: 'Bundle 3', amount: 500, price: 14.99 },
  { section: 'coins', slot: 4, title: 'Bundle 4', amount: 1000, price: 24.99 },

  // Gems tab: coins de kar (GemsPanel.cs; card 7 pe "10000" likha tha, code 1000 deta hai — code wali value)
  ...packs('gems', [25, 50, 100, 250, 500, 700, 1000], [100, 200, 300, 400, 500, 600, 1000]),

  // Diamonds tab: gems de kar (DiamondsPanel.cs)
  ...packs('diamonds', [25, 50, 100, 250, 500, 700, 1000], [100, 200, 300, 400, 500, 600, 1000]),

  // Weapons tab: abhi sirf dikhte hain
  ...[100, 200, 300, 400, 500, 600, 1000].map((price, i) => ({
    section: 'weapons', slot: i + 1, title: `Weapon ${i + 1}`, amount: 0, description: '', price,
  })),
];
