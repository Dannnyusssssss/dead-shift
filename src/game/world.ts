import { copyVec, vec2, type Vec2 } from '../core/math';
import { createPool, type Pool } from '../core/pool';
import { createRng, type Rng } from '../core/rng';
import { createSpatialHash, type SpatialHash } from '../core/spatial-hash';
import { COMBAT } from '../data/combat';
import { createEnemyObject, enemyBehaviorSystem, enemyMovementSystem, type Enemy } from './enemies';
import { createEventQueue, type EventQueue } from './events';
import { createPlayer, type Player } from './player';
import { createSpawnerState, spawnSystem, type SpawnerState } from './spawner';
import { contactDamageSystem, separationSystem, spatialIndexSystem } from './systems/collision';
import { deathSystem, timersSystem } from './systems/damage';
import { movementSystem } from './systems/movement';
import { weaponSystem } from './weapons';

export type WorldStatus = 'playing' | 'dead';

export interface World {
  seed: number;
  rng: Rng;
  status: WorldStatus;
  /** Seconds of simulated game time. */
  time: number;
  tick: number;
  kills: number;
  player: Player;
  /** Desired movement this step, magnitude <= 1. Written by the host from input. */
  moveInput: Vec2;
  enemies: Pool<Enemy>;
  hash: SpatialHash;
  /** Reusable output buffer for spatial queries. */
  queryBuf: Int32Array;
  events: EventQueue;
  spawner: SpawnerState;
  /** Distance from the player at which enemies appear. The host sets it from the view size. */
  spawnRadius: number;
}

export type System = (world: World, dt: number) => void;

/** The one place that declares system execution order. */
const SYSTEMS: readonly System[] = [
  movementSystem,
  spawnSystem,
  enemyBehaviorSystem,
  enemyMovementSystem,
  spatialIndexSystem,
  separationSystem,
  weaponSystem,
  contactDamageSystem,
  deathSystem,
  timersSystem,
];

export function createWorld(seed: number): World {
  return {
    seed,
    rng: createRng(seed),
    status: 'playing',
    time: 0,
    tick: 0,
    kills: 0,
    player: createPlayer(),
    moveInput: vec2(0, 0),
    enemies: createPool(COMBAT.maxEnemies, createEnemyObject),
    hash: createSpatialHash(COMBAT.cellSize, COMBAT.maxEnemies),
    queryBuf: new Int32Array(COMBAT.queryBufferSize),
    events: createEventQueue(COMBAT.eventCapacity),
    spawner: createSpawnerState(),
    spawnRadius: COMBAT.spawnRingMinRadius,
  };
}

export function updateWorld(world: World, dt: number): void {
  if (world.status !== 'playing') return;
  copyVec(world.player.prevPos, world.player.pos);
  for (const system of SYSTEMS) system(world, dt);
  world.time += dt;
  world.tick++;
}
