import type { EnemyId } from './enemies';

export interface WaveEntry {
  /** Active during [minute*60 + offset, (minute + 1) * 60) of game time. */
  minute: number;
  enemyId: EnemyId;
  /** Groups spawned per second (e.g. 1/8 = one group every 8 s). */
  spawnPerSecond: number;
  groupSize: number;
  /** Seconds into the minute before this row starts (default 0). */
  offset?: number;
}

export interface BossEntry {
  /** Game time of the appearance, s. */
  time: number;
  enemyId: EnemyId;
  /** Extra multipliers on top of the per-minute scaling. */
  hpMultiplier: number;
  damageMultiplier: number;
}

const w = (
  minute: number,
  enemyId: EnemyId,
  spawnPerSecond: number,
  groupSize = 1,
  offset = 0,
): WaveEntry => ({ minute, enemyId, spawnPerSecond, groupSize, offset });

export const WAVES: readonly Readonly<WaveEntry>[] = [
  // 0-1: warm-up
  w(0, 'client', 1.0),
  // 1-3: delivery packs from 1:30
  w(1, 'client', 1.5),
  w(1, 'delivery', 1 / 8, 5, 30),
  w(2, 'client', 1.5),
  w(2, 'delivery', 1 / 8, 5),
  // 3-5: frozen tanks; carts from 4:30
  w(3, 'client', 1.8),
  w(3, 'delivery', 1 / 8, 5),
  w(3, 'frozen', 0.2),
  w(4, 'client', 2.0),
  w(4, 'delivery', 1 / 7, 5),
  w(4, 'frozen', 0.2),
  w(4, 'cart', 0.2, 1, 30),
  // 5: first boss (see BOSSES)
  w(5, 'client', 2.0),
  w(5, 'delivery', 1 / 7, 5),
  w(5, 'frozen', 0.25),
  w(5, 'cart', 0.3),
  // 6-8: cashiers join, density rises
  w(6, 'client', 2.2),
  w(6, 'delivery', 1 / 6, 6),
  w(6, 'frozen', 0.25),
  w(6, 'cart', 0.3),
  w(6, 'cashier', 0.2),
  w(7, 'client', 2.5),
  w(7, 'delivery', 1 / 6, 6),
  w(7, 'frozen', 0.3),
  w(7, 'cart', 0.35),
  w(7, 'cashier', 0.25),
  // 7-10: armored guards, so the end of the shift needs the manual weapons
  w(7, 'guard', 0.15),
  w(8, 'client', 2.8),
  w(8, 'delivery', 1 / 5, 6),
  w(8, 'frozen', 0.3),
  w(8, 'cart', 0.4),
  w(8, 'cashier', 0.3),
  w(8, 'guard', 0.25),
  // 9-10: second boss and the final swarm from 9:30
  w(9, 'client', 3.0),
  w(9, 'delivery', 1 / 5, 8),
  w(9, 'frozen', 0.35),
  w(9, 'cart', 0.4),
  w(9, 'cashier', 0.35),
  w(9, 'guard', 0.3),
  w(9, 'client', 1 / 4, 12, 30),
];

export const BOSSES: readonly Readonly<BossEntry>[] = [
  { time: 300, enemyId: 'manager', hpMultiplier: 1, damageMultiplier: 1 },
  { time: 540, enemyId: 'manager', hpMultiplier: 1.5, damageMultiplier: 1.25 },
];
