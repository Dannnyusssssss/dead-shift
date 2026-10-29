import { COMBAT } from '../data/combat';
import { ENEMIES } from '../data/enemies';
import { WAVES, type WaveEntry } from '../data/waves';
import { spawnEnemy, type Enemy } from './enemies';
import type { World } from './world';

export interface SpawnerState {
  /** Fractional groups owed per wave entry (same index as the wave table). */
  acc: Float64Array;
}

export function createSpawnerState(waves: readonly WaveEntry[] = WAVES): SpawnerState {
  return { acc: new Float64Array(waves.length) };
}

/** Ring radius that keeps spawns just outside a view of the given size. */
export function spawnRadiusForView(viewW: number, viewH: number): number {
  return Math.max(COMBAT.spawnRingMinRadius, Math.hypot(viewW, viewH) / 2 + COMBAT.spawnRingMargin);
}

function ringPoint(world: World, angle: number, out: { x: number; y: number }): void {
  const r = world.spawnRadius + world.rng.range(0, COMBAT.spawnRingThickness);
  out.x = world.player.pos.x + Math.cos(angle) * r;
  out.y = world.player.pos.y + Math.sin(angle) * r;
}

const scratch = { x: 0, y: 0 };

export function spawnGroup(world: World, entry: Readonly<WaveEntry>): void {
  const def = ENEMIES[entry.enemyId];
  ringPoint(world, world.rng.range(0, Math.PI * 2), scratch);
  const spread = entry.groupSize > 1 ? COMBAT.groupSpread : 0;
  for (let k = 0; k < entry.groupSize; k++) {
    const x = scratch.x + world.rng.range(-spread, spread);
    const y = scratch.y + world.rng.range(-spread, spread);
    if (!spawnEnemy(world, def, x, y)) return;
  }
}

/** Evenly spaced horde on the ring (debug / stress testing). */
export function spawnHorde(world: World, count: number): void {
  const def = ENEMIES.client;
  for (let i = 0; i < count; i++) {
    ringPoint(world, (i / count) * Math.PI * 2, scratch);
    if (!spawnEnemy(world, def, scratch.x, scratch.y)) return;
  }
}

/** Moves enemies left far behind back onto the ring so the arena never empties. */
function relocateFarEnemies(world: World): void {
  const limit = world.spawnRadius * COMBAT.relocateFactor;
  const limit2 = limit * limit;
  const { items, count } = world.enemies;
  const p = world.player.pos;
  for (let i = 0; i < count; i++) {
    const e = items[i] as Enemy;
    const dx = e.pos.x - p.x;
    const dy = e.pos.y - p.y;
    if (dx * dx + dy * dy <= limit2) continue;
    ringPoint(world, world.rng.range(0, Math.PI * 2), scratch);
    e.pos.x = e.prevPos.x = scratch.x;
    e.pos.y = e.prevPos.y = scratch.y;
  }
}

export function spawnSystem(world: World, dt: number): void {
  const minute = Math.floor(world.time / 60);
  const acc = world.spawner.acc;
  for (let i = 0; i < WAVES.length; i++) {
    const entry = WAVES[i] as WaveEntry;
    if (entry.minute !== minute) continue;
    let owed = (acc[i] ?? 0) + entry.spawnPerSecond * dt;
    while (owed >= 1) {
      owed -= 1;
      spawnGroup(world, entry);
    }
    acc[i] = owed;
  }
  relocateFarEnemies(world);
}
