/* eslint-disable prettier/prettier */

// 📖 Story mode stages + first-clear rewards. Game design document: Chapter 1 "Top Delinquents Showdown".
// Change rewards here only. Stage numbers match the game's Level_1 … Level_7.
export interface StoryStage {
  stage: number;       // global number (Chapter 2 continues at 8)
  chapter: number;
  code: string;        // "1-1" etc. as in the design document
  name: string;
  boss: boolean;
  coins: number;
  skillPoints: number;
}

const NORMAL = { coins: 100, skillPoints: 1 };
const BOSS = { coins: 200, skillPoints: 2 };

export const STORY_STAGES: StoryStage[] = [
  { stage: 1, chapter: 1, code: '1-1', name: 'Back in the past', boss: false, ...NORMAL },
  { stage: 2, chapter: 1, code: '1-2', name: 'The park', boss: false, ...NORMAL },
  { stage: 3, chapter: 1, code: '1-3', name: 'Super Goon', boss: true, ...BOSS },
  { stage: 4, chapter: 1, code: '1-4', name: 'Five goons', boss: false, ...NORMAL },
  { stage: 5, chapter: 1, code: '1-5', name: 'Kiyomasa with a bat', boss: true, ...BOSS },
  { stage: 6, chapter: 1, code: '1-6', name: 'King vs Slave', boss: true, ...BOSS },
  { stage: 7, chapter: 1, code: '1-7', name: 'King vs Slave Part 2', boss: true, ...BOSS },
];

export const STORY_RULES = {
  // ek stage itne seconds se pehle khatam → reward nahi (cutscenes + fight)
  minStageSeconds: Number(process.env.STORY_MIN_SECONDS ?? 15),
  // shuru kiya hua stage itni der me complete na ho → run expire
  runExpiryMinutes: 120,
};

export const lastStageOfChapter = (chapter: number) =>
  Math.max(...STORY_STAGES.filter((s) => s.chapter === chapter).map((s) => s.stage));
