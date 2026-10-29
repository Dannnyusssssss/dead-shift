import { copyVec, vec2, type Vec2 } from '../core/math';
import { createPool, type Pool } from '../core/pool';
import { createRng, type Rng } from '../core/rng';
import { createSpatialHash, type SpatialHash } from '../core/spatial-hash';
import { COMBAT } from '../data/combat';
import { COUPONS, FLOOR_ITEMS, PROGRESSION } from '../data/progression';
import { AMMO, WEAPON_IDS } from '../data/weapons';
import { createEnemyObject, enemyBehaviorSystem, enemyMovementSystem, type Enemy } from './enemies';
import { createEventQueue, createHitQueue, type EventQueue, type HitQueue } from './events';
import { createHazardObject, hazardSystem, type Hazard } from './hazards';
import { manualWeaponSystem } from './manual';
import {
  createAmmoBoxObject,
  createChestObject,
  createCouponObject,
  createFloorItemObject,
  pickupSystem,
  type AmmoBox,
  type Chest,
  type Coupon,
  type FloorItem,
} from './pickups';
import { createPlayer, type Player } from './player';
import { progressionSystem, type Offer } from './progression';
import { createProjectileObject, projectileSystem, type Projectile } from './projectiles';
import { checkDawn } from './shift';
import { createSpawnerState, spawnSystem, type SpawnerState } from './spawner';
import { contactDamageSystem, separationSystem, spatialIndexSystem } from './systems/collision';
import { timersSystem } from './systems/damage';
import { deathSystem } from './systems/death';
import { movementSystem } from './systems/movement';
import { statusSystem } from './systems/status';
import { createTurretObject, turretSystem, type Turret } from './turrets';
import { weaponSystem } from './weapons';

/** `levelup` pauses the simulation until an offer is chosen; `dead` and `won` end the run. */
export type WorldStatus = 'playing' | 'levelup' | 'dead' | 'won';

/** Where the current offers come from: a level-up or a boss chest. */
export type OfferSource = 'level' | 'chest';

export interface World {
  seed: number;
  rng: Rng;
  status: WorldStatus;
  /** Seconds of simulated game time. */
  time: number;
  tick: number;
  kills: number;
  /** Kills per weapon, indexed like WEAPON_IDS (debug stats and balance reports). */
  killsByWeapon: Int32Array;
  player: Player;
  /** Desired movement this step, magnitude <= 1. Written by the host from input. */
  moveInput: Vec2;
  /** Unit aim direction. Written by the host while `aimActive`; otherwise it follows `facing`. */
  aim: Vec2;
  /** A mouse or aim stick is steering the aim (keyboard-only play leaves this false). */
  aimActive: boolean;
  /** Fire / swing button held this step. */
  triggerHeld: boolean;
  /** One-shot requests from the host, consumed by the manual weapon system. */
  swapRequested: boolean;
  reloadRequested: boolean;
  enemies: Pool<Enemy>;
  projectiles: Pool<Projectile>;
  turrets: Pool<Turret>;
  coupons: Pool<Coupon>;
  chests: Pool<Chest>;
  ammoBoxes: Pool<AmmoBox>;
  /** Medkits and floor magnets. */
  floorItems: Pool<FloorItem>;
  hazards: Pool<Hazard>;
  hash: SpatialHash;
  /** Reusable output buffer for spatial queries. */
  queryBuf: Int32Array;
  events: EventQueue;
  /** Damage dealt this frame, drained by the host like `events`. */
  hits: HitQueue;
  spawner: SpawnerState;
  /** Distance from the player at which enemies appear. The host sets it from the view size. */
  spawnRadius: number;
  /** Upgrades on offer while `status === 'levelup'`. */
  offers: Offer[];
  offerSource: OfferSource;
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
  manualWeaponSystem,
  weaponSystem,
  turretSystem,
  projectileSystem,
  hazardSystem,
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
    killsByWeapon: new Int32Array(WEAPON_IDS.length),
    player: createPlayer(),
    moveInput: vec2(0, 0),
    aim: vec2(1, 0),
    aimActive: false,
    triggerHeld: false,
    swapRequested: false,
    reloadRequested: false,
    enemies: createPool(COMBAT.maxEnemies, createEnemyObject),
    projectiles: createPool(COMBAT.projectileCapacity, createProjectileObject),
    turrets: createPool(COMBAT.turretCapacity, createTurretObject),
    coupons: createPool(COUPONS.capacity, createCouponObject),
    chests: createPool(COUPONS.chestCapacity, createChestObject),
    ammoBoxes: createPool(AMMO.capacity, createAmmoBoxObject),
    floorItems: createPool(FLOOR_ITEMS.capacity, createFloorItemObject),
    hazards: createPool(COMBAT.hazardCapacity, createHazardObject),
    hash: createSpatialHash(COMBAT.cellSize, COMBAT.maxEnemies),
    queryBuf: new Int32Array(COMBAT.queryBufferSize),
    events: createEventQueue(COMBAT.eventCapacity),
    hits: createHitQueue(COMBAT.hitCapacity),
    spawner: createSpawnerState(),
    spawnRadius: COMBAT.spawnRingMinRadius,
    offers: [],
    offerSource: 'level',
    rerollsLeft: PROGRESSION.rerollsPerRun,
  };
}

export function updateWorld(world: World, dt: number): void {
  if (world.status !== 'playing') return;
  copyVec(world.player.prevPos, world.player.pos);
  for (const system of SYSTEMS) system(world, dt);
  world.time += dt;
  world.tick++;
  checkDawn(world);
}
