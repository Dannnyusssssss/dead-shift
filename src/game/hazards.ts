import { setVec, vec2, type Vec2 } from '../core/math';
import { COMBAT } from '../data/combat';
import type { TrailSpec } from '../data/enemies';
import { emit } from './events';
import { damagePlayer } from './systems/damage';
import type { World } from './world';

/** Enemy-made dangers: slowing puddles, thrown receipts that explode, boss shockwaves. */
export type HazardKind = 'puddle' | 'receipt' | 'shockwave';

export interface Hazard {
  kind: HazardKind;
  pos: Vec2;
  prevPos: Vec2;
  /** Receipt: where it lands and explodes. */
  target: Vec2;
  /** Receipt speed, px/s. */
  speed: number;
  /** Puddle radius / explosion radius / shockwave max radius, px. */
  radius: number;
  /** Seconds alive so far. */
  age: number;
  /** Puddle lifetime / receipt max flight / shockwave expansion time, s. */
  duration: number;
  /** Shockwave warning before it expands, s. */
  windup: number;
  damage: number;
  slowFactor: number;
  /** Shockwave already resolved its single hit attempt. */
  spent: boolean;
}

export function createHazardObject(): Hazard {
  return {
    kind: 'puddle',
    pos: vec2(),
    prevPos: vec2(),
    target: vec2(),
    speed: 0,
    radius: 0,
    age: 0,
    duration: 0,
    windup: 0,
    damage: 0,
    slowFactor: 0,
    spent: false,
  };
}

function acquire(world: World, kind: HazardKind, x: number, y: number): Hazard | undefined {
  const h = world.hazards.acquire();
  if (!h) return undefined;
  h.kind = kind;
  setVec(h.pos, x, y);
  setVec(h.prevPos, x, y);
  setVec(h.target, x, y);
  h.speed = 0;
  h.radius = 0;
  h.age = 0;
  h.duration = 0;
  h.windup = 0;
  h.damage = 0;
  h.slowFactor = 0;
  h.spent = false;
  return h;
}

export function spawnPuddle(world: World, x: number, y: number, spec: Readonly<TrailSpec>): void {
  const h = acquire(world, 'puddle', x, y);
  if (!h) return;
  h.radius = spec.radius;
  h.duration = spec.duration;
  h.slowFactor = spec.slowFactor;
}

export function throwReceipt(
  world: World,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  speed: number,
  explosionRadius: number,
  damage: number,
): void {
  const h = acquire(world, 'receipt', fromX, fromY);
  if (!h) return;
  setVec(h.target, toX, toY);
  h.speed = speed;
  h.radius = explosionRadius;
  h.duration = COMBAT.receiptMaxLife;
  h.damage = damage;
}

export function spawnShockwave(
  world: World,
  x: number,
  y: number,
  windup: number,
  maxRadius: number,
  duration: number,
  damage: number,
): void {
  const h = acquire(world, 'shockwave', x, y);
  if (!h) return;
  h.windup = windup;
  h.radius = maxRadius;
  h.duration = duration;
  h.damage = damage;
  emit(world.events, 'shockwave', x, y);
}

/** Current ring radius of a shockwave (0 during the wind-up). */
export function shockwaveRadius(h: Readonly<Hazard>): number {
  const t = h.age - h.windup;
  if (t <= 0) return 0;
  return h.radius * Math.min(1, t / h.duration);
}

function hurtPlayer(world: World, damage: number): void {
  const p = world.player;
  if (damagePlayer(p, damage)) emit(world.events, 'playerHit', p.pos.x, p.pos.y, '');
}

/** Returns true when the hazard is finished. */
function updatePuddle(world: World, h: Hazard): boolean {
  const p = world.player;
  const dx = p.pos.x - h.pos.x;
  const dy = p.pos.y - h.pos.y;
  if (dx * dx + dy * dy <= h.radius * h.radius) {
    p.slowFactor = Math.max(p.slowTimer > 0 ? p.slowFactor : 0, h.slowFactor);
    // Refreshed every step while inside; fades right after leaving.
    p.slowTimer = Math.max(p.slowTimer, 0.1);
  }
  return h.age >= h.duration;
}

function updateReceipt(world: World, h: Hazard, dt: number): boolean {
  h.prevPos.x = h.pos.x;
  h.prevPos.y = h.pos.y;
  const dx = h.target.x - h.pos.x;
  const dy = h.target.y - h.pos.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const step = h.speed * dt;
  if (d > step && h.age < h.duration) {
    h.pos.x += (dx / d) * step;
    h.pos.y += (dy / d) * step;
    return false;
  }
  h.pos.x = h.target.x;
  h.pos.y = h.target.y;
  const p = world.player;
  const px = p.pos.x - h.pos.x;
  const py = p.pos.y - h.pos.y;
  const r = h.radius + p.radius;
  if (px * px + py * py <= r * r) hurtPlayer(world, h.damage);
  emit(world.events, 'explosion', h.pos.x, h.pos.y, '');
  return true;
}

function updateShockwave(world: World, h: Hazard): boolean {
  const ring = shockwaveRadius(h);
  if (!h.spent && ring > 0) {
    const p = world.player;
    const d = Math.hypot(p.pos.x - h.pos.x, p.pos.y - h.pos.y);
    if (Math.abs(d - ring) <= COMBAT.shockwaveThickness / 2 + p.radius) {
      h.spent = true;
      hurtPlayer(world, h.damage);
    }
  }
  return h.age >= h.windup + h.duration;
}

export function hazardSystem(world: World, dt: number): void {
  const pool = world.hazards;
  for (let i = pool.count - 1; i >= 0; i--) {
    const h = pool.items[i] as Hazard;
    h.age += dt;
    let done: boolean;
    switch (h.kind) {
      case 'puddle':
        done = updatePuddle(world, h);
        break;
      case 'receipt':
        done = updateReceipt(world, h, dt);
        break;
      case 'shockwave':
        done = updateShockwave(world, h);
        break;
    }
    if (done) pool.releaseAt(i);
  }
}
