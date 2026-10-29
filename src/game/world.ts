import { copyVec, vec2, type Vec2 } from '../core/math';
import { createPool, type Pool } from '../core/pool';
import { createRng, type Rng } from '../core/rng';
import { createSpatialHash, type SpatialHash } from '../core/spatial-hash';
import { COMBAT } from '../data/combat';
import { COUPONS, PROGRESSION } from '../data/progression';
import { createEnemyObject, enemyBehaviorSystem, enemyMovementSystem, type Enemy } from './enemies';
import { createEventQueue, type EventQueue } from './events';
import { createCouponObject, pickupSystem, type Coupon } from './pickups';
import { createPlayer, type Player } from './player';
import { progressionSystem, type Offer } from './progression';
import { createProjectileObject, projectileSystem, type Projectile } from './projectiles';
import { createSpawnerState, spawnSystem, type SpawnerState } from './spawner';
import { contactDamageSystem, separationSystem, spatialIndexSystem } from './systems/collision';
import { timersSystem } from './systems/damage';
import { deathSystem } from './systems/death';
import { movementSystem } from './systems/movement';
import { statusSystem } from './systems/status';
import { createTurretObject, turretSystem, type Turret } from './turrets';
import { weaponSystem } from './weapons';

/** `levelup` pauses the simulation until an offer is chosen. */
export type WorldStatus = 'playing' | 'levelup' | 'dead';

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
  projectiles: Pool<Projectile>;
  turrets: Pool<Turret>;
  coupons: Pool<Coupon>;
  hash: SpatialHash;
  /** Reusable output buffer for spatial queries. */
  queryBuf: Int32Array;
  events: EventQueue;
  spawner: SpawnerState;
  /** Distance from the player at which enemies appear. The host sets it from the view size. */
  spawnRadius: number;
  /** Upgrades on offer while `status === 'levelup'`. */
  offers: Offer[];
  rerollsLeft: number;
}

export type System = (world: World, dt: number) => void;

/** The one place that declares system execution order. */
const SYSTEMS: readonly System[] = [
  movementSystem,
  spawnSystem,
  enemyBehaviorSystem,
  statusSystem,
  enemyMovementSystem,
  spatialIndexSystem,
  separationSystem,
  weaponSystem,
  turretSystem,
  projectileSystem,
  contactDamageSystem,
  deathSystem,
  pickupSystem,
  progressionSystem,
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
    projectiles: createPool(COMBAT.projectileCapacity, createProjectileObject),
    turrets: createPool(COMBAT.turretCapacity, createTurretObject),
    coupons: createPool(COUPONS.capacity, createCouponObject),
    hash: createSpatialHash(COMBAT.cellSize, COMBAT.maxEnemies),
    queryBuf: new Int32Array(COMBAT.queryBufferSize),
    events: createEventQueue(COMBAT.eventCapacity),
    spawner: createSpawnerState(),
    spawnRadius: COMBAT.spawnRingMinRadius,
    offers: [],
    rerollsLeft: PROGRESSION.rerollsPerRun,
  };
}

export function updateWorld(world: World, dt: number): void {
  if (world.status !== 'playing') return;
  copyVec(world.player.prevPos, world.player.pos);
  for (const system of SYSTEMS) system(world, dt);
  world.time += dt;
  world.tick++;
}
