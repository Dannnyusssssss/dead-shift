import type { TextKey } from './texts';

export type DifficultyId = 'easy' | 'normal' | 'hard';

/**
 * Multipliers applied on top of the regular game. Easy is the game as it was before
 * difficulties existed: every multiplier is 1 and nothing starts early (tests/regression.test.ts).
 * Player stats, the XP curve, the enemy cap and the shift length never change.
 */
export interface DifficultyDef {
  id: DifficultyId;
  nameKey: TextKey;
  /** Wave groups per second. */
  spawnRate: number;
  /** Hp of every non-boss enemy (waves, boss summons). */
  enemyHp: number;
  /** Contact damage, receipts and shockwaves of every enemy, bosses included. */
  enemyDamage: number;
  /** Hp of the bosses (instead of `enemyHp`). */
  bossHp: number;
  /** Coupon value of each kill. */
  xp: number;
  /** Drop chance of ammo / shell boxes and medkits. */
  drops: number;
  /** Fraction of its start time by which each enemy type's first wave comes early (0 = on time). */
  introLead: number;
}

export const DIFFICULTY_IDS: readonly DifficultyId[] = ['easy', 'normal', 'hard'];

export const DEFAULT_DIFFICULTY: DifficultyId = 'easy';

export const DIFFICULTIES: Readonly<Record<DifficultyId, Readonly<DifficultyDef>>> = {
  easy: {
    id: 'easy',
    nameKey: 'difficultyEasy',
    spawnRate: 1,
    enemyHp: 1,
    enemyDamage: 1,
    bossHp: 1,
    xp: 1,
    drops: 1,
    introLead: 0,
  },
  normal: {
    id: 'normal',
    nameKey: 'difficultyNormal',
    spawnRate: 1.3,
    enemyHp: 1.25,
    enemyDamage: 1.2,
    bossHp: 1.3,
    xp: 1,
    drops: 0.9,
    introLead: 0,
  },
  hard: {
    id: 'hard',
    nameKey: 'difficultyHard',
    // Tuned with the bot (docs/DECISIONS.md, Hito 11): the starting point (spawn x1.7, hp x1.6,
    // xp x0.9) killed it within the first minute and a half.
    spawnRate: 1.5,
    enemyHp: 1.3,
    enemyDamage: 1.5,
    bossHp: 1.8,
    xp: 1,
    drops: 0.75,
    introLead: 0.2,
  },
};
