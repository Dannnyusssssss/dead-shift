import { setVec, vec2, type Vec2 } from '../core/math';
import { COMBAT } from '../data/combat';
import {
  ENEMIES,
  type BossBehavior,
  type ChargeBehavior,
  type EnemyDef,
  type RangedBehavior,
  type ZigzagBehavior,
} from '../data/enemies';
import { WEAPON_IDS } from '../data/weapons';
import { spawnPuddle, spawnShockwave, throwReceipt } from './hazards';
import type { World } from './world';

/** States of the `charge` behavior (stored in `aiState`). */
export const CHARGE_STATE = { approach: 0, windup: 1, charging: 2, recover: 3 } as const;

export interface Enemy {
  def: Readonly<EnemyDef>;
  pos: Vec2;
  prevPos: Vec2;
  /** Velocity chosen by the behavior, px/s. */
  vel: Vec2;
  /** Knockback velocity, decays over time, px/s. */
  knockback: Vec2;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  /** Per-minute (and boss) multiplier applied at spawn; also scales its attacks. */
  scale: number;
  /** Remaining white-flash time after being hit, s. */
  hitTimer: number;
  /** Fraction of speed removed while `slowTimer` > 0. */
  slowFactor: number;
  slowTimer: number;
  poisonDps: number;
  poisonTimer: number;
  /** Per weapon (WEAPON_IDS order): time until that weapon may hit this enemy again. */
  weaponHitTimers: Float32Array;
  /** Behavior scratch state; meaning depends on `def.behavior.kind`. */
  aiState: number;
  aiTimer: number;
  aiTimer2: number;
  aiPhase: number;
  /** Locked direction (charge) or strafe side (ranged). */
  aiDir: Vec2;
  /** Time until the next trail puddle. */
  trailTimer: number;
}

/** Largest enemy radius; pads spatial queries so big enemies are not missed. */
export const MAX_ENEMY_RADIUS = Math.max(...Object.values(ENEMIES).map((d) => d.radius));

export function createEnemyObject(): Enemy {
  return {
    def: ENEMIES.client,
    pos: vec2(),
    prevPos: vec2(),
    vel: vec2(),
    knockback: vec2(),
    hp: 0,
    maxHp: 0,
    speed: 0,
    damage: 0,
    radius: 0,
    scale: 1,
    hitTimer: 0,
    slowFactor: 0,
    slowTimer: 0,
    poisonDps: 0,
    poisonTimer: 0,
    weaponHitTimers: new Float32Array(WEAPON_IDS.length),
    aiState: 0,
    aiTimer: 0,
    aiTimer2: 0,
    aiPhase: 0,
    aiDir: vec2(),
    trailTimer: 0,
  };
}

/** Hp/damage multiplier for something spawning at `time`. */
export function scaleAt(time: number): number {
  return 1 + COMBAT.scalingPerMinute * (time / 60);
}

function initBehavior(e: Enemy, world: World): void {
  e.aiState = 0;
  e.aiTimer = 0;
  e.aiTimer2 = 0;
  e.aiPhase = world.rng.range(0, Math.PI * 2);
  setVec(e.aiDir, 1, 0);
  const b = e.def.behavior;
  switch (b.kind) {
    case 'ranged':
      e.aiTimer = b.fireInterval * 0.5;
      e.aiDir.x = world.rng.next() < 0.5 ? -1 : 1;
      break;
    case 'boss':
      e.aiTimer = b.summonInterval;
      e.aiTimer2 = b.shockwaveInterval;
      break;
    default:
      break;
  }
  e.trailTimer = e.def.trail?.interval ?? 0;
}

/** Takes an enemy from the pool and initializes it. Returns undefined at the cap. */
export function spawnEnemy(
  world: World,
  def: Readonly<EnemyDef>,
  x: number,
  y: number,
  hpMultiplier = 1,
  damageMultiplier = 1,
): Enemy | undefined {
  if (world.enemies.count >= COMBAT.maxEnemies) return undefined;
  const e = world.enemies.acquire();
  if (!e) return undefined;
  const scale = scaleAt(world.time);
  e.def = def;
  setVec(e.pos, x, y);
  setVec(e.prevPos, x, y);
  setVec(e.vel, 0, 0);
  setVec(e.knockback, 0, 0);
  e.scale = scale * damageMultiplier;
  e.hp = e.maxHp = def.hp * scale * hpMultiplier;
  e.speed = def.speed;
  e.damage = def.damage * scale * damageMultiplier;
  e.radius = def.radius;
  e.hitTimer = 0;
  e.slowFactor = 0;
  e.slowTimer = 0;
  e.poisonDps = 0;
  e.poisonTimer = 0;
  e.weaponHitTimers.fill(0);
  initBehavior(e, world);
  return e;
}

/** Unit vector and distance from the enemy to the player, written into `out`. */
function towardPlayer(e: Enemy, world: World, out: Vec2): number {
  const dx = world.player.pos.x - e.pos.x;
  const dy = world.player.pos.y - e.pos.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-6) setVec(out, 0, 0);
  else setVec(out, dx / d, dy / d);
  return d;
}

const dir = vec2();

function chase(e: Enemy, world: World, speedScale = 1): number {
  const d = towardPlayer(e, world, dir);
  setVec(e.vel, dir.x * e.speed * speedScale, dir.y * e.speed * speedScale);
  return d;
}

function zigzag(e: Enemy, b: Readonly<ZigzagBehavior>, world: World, dt: number): void {
  towardPlayer(e, world, dir);
  e.aiPhase += dt * b.frequency * Math.PI * 2;
  const side = Math.sin(e.aiPhase) * b.weave;
  // Forward plus a sideways component (perpendicular = (-y, x)), renormalized.
  const vx = dir.x - dir.y * side;
  const vy = dir.y + dir.x * side;
  const len = Math.hypot(vx, vy) || 1;
  setVec(e.vel, (vx / len) * e.speed, (vy / len) * e.speed);
}

function charge(e: Enemy, b: Readonly<ChargeBehavior>, world: World, dt: number): void {
  e.aiTimer -= dt;
  switch (e.aiState) {
    case CHARGE_STATE.approach: {
      const d = chase(e, world);
      if (d <= b.triggerRange && e.aiTimer <= 0) {
        e.aiState = CHARGE_STATE.windup;
        e.aiTimer = b.windup;
        towardPlayer(e, world, e.aiDir);
        setVec(e.vel, 0, 0);
      }
      break;
    }
    case CHARGE_STATE.windup:
      setVec(e.vel, 0, 0);
      if (e.aiTimer <= 0) {
        e.aiState = CHARGE_STATE.charging;
        e.aiTimer = b.chargeTime;
      }
      break;
    case CHARGE_STATE.charging:
      setVec(e.vel, e.aiDir.x * b.chargeSpeed, e.aiDir.y * b.chargeSpeed);
      if (e.aiTimer <= 0) {
        e.aiState = CHARGE_STATE.recover;
        e.aiTimer = b.recover;
      }
      break;
    default:
      chase(e, world, 0.5);
      if (e.aiTimer <= 0) {
        e.aiState = CHARGE_STATE.approach;
        e.aiTimer = 0;
      }
      break;
  }
}

function ranged(e: Enemy, b: Readonly<RangedBehavior>, world: World, dt: number): void {
  const d = towardPlayer(e, world, dir);
  if (d > b.preferredDistance + b.band) {
    setVec(e.vel, dir.x * e.speed, dir.y * e.speed);
  } else if (d < b.preferredDistance - b.band) {
    setVec(e.vel, -dir.x * e.speed, -dir.y * e.speed);
  } else {
    // Strafe around the player; aiDir.x holds the side (+1 / -1).
    const s = e.aiDir.x * e.speed * 0.6;
    setVec(e.vel, -dir.y * s, dir.x * s);
  }
  e.aiTimer -= dt;
  if (e.aiTimer <= 0 && d <= b.preferredDistance + b.band * 3) {
    e.aiTimer = b.fireInterval;
    const p = world.player.pos;
    throwReceipt(
      world,
      e.pos.x,
      e.pos.y,
      p.x,
      p.y,
      b.projectileSpeed,
      b.explosionRadius,
      b.explosionDamage * e.scale,
    );
  }
}

function boss(e: Enemy, b: Readonly<BossBehavior>, world: World, dt: number): void {
  chase(e, world);
  e.aiTimer -= dt;
  if (e.aiTimer <= 0) {
    e.aiTimer += b.summonInterval;
    const minion = ENEMIES[b.summonId];
    for (let k = 0; k < b.summonCount; k++) {
      const a = (k / b.summonCount) * Math.PI * 2;
      const r = b.summonRadius + e.radius;
      spawnEnemy(world, minion, e.pos.x + Math.cos(a) * r, e.pos.y + Math.sin(a) * r);
    }
  }
  e.aiTimer2 -= dt;
  if (e.aiTimer2 <= 0) {
    e.aiTimer2 += b.shockwaveInterval;
    spawnShockwave(
      world,
      e.pos.x,
      e.pos.y,
      b.shockwaveWindup,
      b.shockwaveRadius,
      b.shockwaveDuration,
      b.shockwaveDamage * e.scale,
    );
  }
}

function trail(e: Enemy, world: World, dt: number): void {
  const spec = e.def.trail;
  if (!spec) return;
  e.trailTimer -= dt;
  if (e.trailTimer > 0) return;
  e.trailTimer += spec.interval;
  spawnPuddle(world, e.pos.x, e.pos.y, spec);
}

export function enemyBehaviorSystem(world: World, dt: number): void {
  const enemies = world.enemies;
  // Bosses may summon while we iterate; only process enemies alive at the start.
  const count = enemies.count;
  for (let i = 0; i < count; i++) {
    const e = enemies.items[i] as Enemy;
    const b = e.def.behavior;
    switch (b.kind) {
      case 'chase':
        chase(e, world);
        break;
      case 'zigzag':
        zigzag(e, b, world, dt);
        break;
      case 'charge':
        charge(e, b, world, dt);
        break;
      case 'ranged':
        ranged(e, b, world, dt);
        break;
      case 'boss':
        boss(e, b, world, dt);
        break;
    }
    trail(e, world, dt);
  }
}

export function enemyMovementSystem(world: World, dt: number): void {
  const { items, count } = world.enemies;
  const decay = Math.exp(-COMBAT.knockbackDecay * dt);
  for (let i = 0; i < count; i++) {
    const e = items[i] as Enemy;
    const speedScale = e.slowTimer > 0 ? 1 - e.slowFactor : 1;
    e.prevPos.x = e.pos.x;
    e.prevPos.y = e.pos.y;
    e.pos.x += (e.vel.x * speedScale + e.knockback.x) * dt;
    e.pos.y += (e.vel.y * speedScale + e.knockback.y) * dt;
    e.knockback.x *= decay;
    e.knockback.y *= decay;
  }
}
