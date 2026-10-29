import type { EnemyId } from './enemies';

export interface WaveEntry {
  /** Active during [minute, minute + 1) of game time. */
  minute: number;
  enemyId: EnemyId;
  /** Groups spawned per second (e.g. 1/8 = one group every 8 s). */
  spawnPerSecond: number;
  groupSize: number;
}

// Milestone 2: only Clients, ramping up. Milestone 4 completes the table.
export const WAVES: readonly Readonly<WaveEntry>[] = [
  { minute: 0, enemyId: 'client', spawnPerSecond: 1.0, groupSize: 1 },
  { minute: 1, enemyId: 'client', spawnPerSecond: 1.5, groupSize: 1 },
  { minute: 2, enemyId: 'client', spawnPerSecond: 1.5, groupSize: 1 },
  { minute: 2, enemyId: 'client', spawnPerSecond: 1 / 8, groupSize: 5 },
  { minute: 3, enemyId: 'client', spawnPerSecond: 2.0, groupSize: 1 },
  { minute: 4, enemyId: 'client', spawnPerSecond: 2.0, groupSize: 1 },
  { minute: 4, enemyId: 'client', spawnPerSecond: 1 / 6, groupSize: 6 },
  { minute: 5, enemyId: 'client', spawnPerSecond: 2.5, groupSize: 1 },
  { minute: 6, enemyId: 'client', spawnPerSecond: 2.5, groupSize: 1 },
  { minute: 7, enemyId: 'client', spawnPerSecond: 3.0, groupSize: 1 },
  { minute: 8, enemyId: 'client', spawnPerSecond: 3.0, groupSize: 1 },
  { minute: 9, enemyId: 'client', spawnPerSecond: 3.5, groupSize: 1 },
];
