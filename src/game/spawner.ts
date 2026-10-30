import { COMBAT } from '../data/combat';
import { ENEMIES } from '../data/enemies';
import { BOSSES, WAVES, type BossEntry, type WaveEntry } from '../data/waves';
import { spawnEnemy, type Enemy } from './enemies';
import { pushOutOfShelves } from './shelves';
import { emit } from './events';
import type { World } from './world';

export interface SpawnerState {
  /** Fractional groups owed per wave entry (same index as the wave table). */
  acc: Float64Array;
  /** Index of the next boss in BOSSES. */
  nextBoss: number;
}

export function createSpawnerState(waves: readonly WaveEntry[] = WAVES): SpawnerState {
  return { acc: new Float64Array(waves.length), nextBoss: 0 };
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

/** At the cap, frees the slot of the regular enemy farthest from the player. */
function makeRoom(world: World): void {
  const pool = world.enemies;
  if (pool.count < COMBAT.maxEnemies) return;
  const p = world.player.pos;
  let farthest = -1;
  let best = -1;
  for (let i = 0; i < pool.count; i++) {
    const e = pool.items[i] as Enemy;
    if (e.def.dropsChest) continue;
    const d2 = (e.pos.x - p.x) ** 2 + (e.pos.y - p.y) ** 2;
    if (d2 > best) {
      best = d2;
      farthest = i;
    }
  }
  if (farthest >= 0) pool.releaseAt(farthest);
}

function spawnBoss(world: World, entry: Readonly<BossEntry>): void {
  // A boss must always appear, even when the arena is at the enemy cap.
  makeRoom(world);
  ringPoint(world, world.rng.range(0, Math.PI * 2), scratch);
  const boss = spawnEnemy(
    world,
    ENEMIES[entry.enemyId],
    scratch.x,
    scratch.y,
    entry.hpMultiplier,
    entry.damageMultiplier,
  );
  if (boss) emit(world.events, 'bossSpawn', boss.pos.x, boss.pos.y);
}

/** Evenly spaced horde on the ring (debug / stress testing). */
export function spawnHorde(world: World, count: number): void {
  const def = ENEMIES.client;
  for (let i = 0; i < count; i++) {
    ringPoint(world, (i / count) * Math.PI * 2, scratch);
    if (!spawnEnemy(world, def, scratch.x, scratch.y)) return;
  }
}

/** Debug: start the run at `time`, skipping bosses that would already have appeared. */
export function fastForward(world: World, time: number): void {
  world.time = time;
  let next = 0;
  while (next < BOSSES.length && (BOSSES[next]?.time ?? Infinity) < time) next++;
  world.spawner.nextBoss = next;
}

/** Moves an enemy to a random free point of the spawn ring. */
export function relocateToRing(world: World, e: Enemy): void {
  ringPoint(world, world.rng.range(0, Math.PI * 2), scratch);
  e.pos.x = scratch.x;
  e.pos.y = scratch.y;
  pushOutOfShelves(e.pos, e.radius, world.seed);
  e.prevPos.x = e.pos.x;
  e.prevPos.y = e.pos.y;
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
    relocateToRing(world, e);
  }
}

export function spawnSystem(world: World, dt: number): void {
  const minute = Math.floor(world.time / 60);
  const intoMinute = world.time - minute * 60;
  const acc = world.spawner.acc;
  const waves = world.waves;
  const rate = world.difficulty.spawnRate;
  for (let i = 0; i < waves.length; i++) {
    const entry = waves[i] as WaveEntry;
    if (entry.minute !== minute || intoMinute < (entry.offset ?? 0)) continue;
    let owed = (acc[i] ?? 0) + entry.spawnPerSecond * rate * dt;
    while (owed >= 1) {
      owed -= 1;
      spawnGroup(world, entry);
    }
    acc[i] = owed;
  }
  const s = world.spawner;
  for (let boss = BOSSES[s.nextBoss]; boss && world.time >= boss.time; boss = BOSSES[s.nextBoss]) {
    spawnBoss(world, boss);
    s.nextBoss++;
  }
  relocateFarEnemies(world);
}
