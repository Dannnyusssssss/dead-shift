import { setVec, vec2, type Vec2 } from '../core/math';
import { COMBAT } from '../data/combat';
import type { ProjectileLevel, ProjectileLook } from '../data/weapons';
import { MAX_ENEMY_RADIUS, type Enemy } from './enemies';
import { emit } from './events';
import { circleHitsShelf } from './shelves';
import { damageTakenFrom, hitEnemy } from './systems/damage';
import type { World } from './world';

/** Extra flight time after a bounce, beyond reaching the new target, s. */
const FIXED_LIFE_PAD = 0.1;

export interface Projectile {
  pos: Vec2;
  prevPos: Vec2;
  vel: Vec2;
  damage: number;
  /** Multiplier on `damage` left after the enemies already pierced (pierceFalloff). */
  damageScale: number;
  /** Fraction of the damage lost per enemy hit. */
  pierceFalloff: number;
  radius: number;
  /** Remaining extra enemies it may pass through; removed when it goes below 0. */
  pierce: number;
  life: number;
  knockback: number;
  look: ProjectileLook;
  /** Index in WEAPON_IDS of the weapon that fired it. */
  source: number;
  /** Burn (poison) applied on hit, per second, and its duration (0 = none). */
  burnDps: number;
  burnTime: number;
  /** Jumps left to the nearest enemy not hit yet, and their max distance. */
  bounces: number;
  bounceRange: number;
  /** Blast on impact (grenade cans): radius and damage (0 = none). */
  explosionRadius: number;
  explosionDamage: number;
  /** Enemies already hit, so a piercing shot never hits the same one twice. */
  hits: (Enemy | null)[];
  hitCount: number;
}

export function createProjectileObject(): Projectile {
  return {
    pos: vec2(),
    prevPos: vec2(),
    vel: vec2(),
    damage: 0,
    damageScale: 1,
    pierceFalloff: 0,
    radius: 0,
    pierce: 0,
    life: 0,
    knockback: 0,
    look: 'can',
    source: -1,
    burnDps: 0,
    burnTime: 0,
    bounces: 0,
    bounceRange: 0,
    explosionRadius: 0,
    explosionDamage: 0,
    hits: Array.from({ length: COMBAT.maxProjectileHits }, () => null),
    hitCount: 0,
  };
}

export function spawnProjectile(
  world: World,
  x: number,
  y: number,
  angle: number,
  stats: Readonly<ProjectileLevel>,
  look: ProjectileLook,
  source: number,
  /** Distance to the target, for lobbed shots (`detonateAtTarget`); Infinity = full flight. */
  targetDistance = Infinity,
): Projectile | undefined {
  const p = world.projectiles.acquire();
  if (!p) return undefined;
  setVec(p.pos, x, y);
  setVec(p.prevPos, x, y);
  setVec(p.vel, Math.cos(angle) * stats.speed, Math.sin(angle) * stats.speed);
  p.damage = stats.damage * world.player.mods.damage;
  p.damageScale = 1;
  p.pierceFalloff = stats.pierceFalloff ?? 0;
  p.radius = stats.radius;
  p.pierce = Math.min(stats.pierce, COMBAT.maxProjectileHits - 1);
  p.life = stats.detonateAtTarget
    ? Math.min(stats.lifetime, targetDistance / stats.speed)
    : stats.lifetime;
  p.knockback = stats.knockback;
  p.look = look;
  p.source = source;
  p.burnDps = (stats.burnDps ?? 0) * world.player.mods.damage;
  p.burnTime = stats.burnTime ?? 0;
  p.bounces = stats.bounces ?? 0;
  p.bounceRange = stats.bounceRange ?? 0;
  p.explosionRadius = stats.explosionRadius ?? 0;
  p.explosionDamage = (stats.explosionDamage ?? 0) * world.player.mods.damage;
  p.hitCount = 0;
  p.hits.fill(null);
  return p;
}

function alreadyHit(p: Projectile, e: Enemy): boolean {
  for (let i = 0; i < p.hitCount; i++) if (p.hits[i] === e) return true;
  return false;
}

/** Burn reuses the aerosol's poison: the stronger dps and the longer timer win. */
function applyBurn(e: Enemy, p: Projectile): void {
  if (p.burnDps <= 0) return;
  const dps = p.burnDps * damageTakenFrom(e, p.source);
  e.poisonDps = Math.max(e.poisonTimer > 0 ? e.poisonDps : 0, dps);
  e.poisonTimer = Math.max(e.poisonTimer, p.burnTime);
}

/** Points a used-up shot at the nearest living enemy it hasn't hit. Returns false if none. */
function bounce(world: World, p: Projectile): boolean {
  if (p.bounces <= 0 || p.hitCount >= p.hits.length) return false;
  const buf = world.queryBuf;
  const n = world.hash.query(p.pos.x, p.pos.y, p.bounceRange + MAX_ENEMY_RADIUS, buf);
  let best: Enemy | undefined;
  let bestD2 = p.bounceRange * p.bounceRange;
  for (let k = 0; k < n; k++) {
    const e = world.enemies.items[buf[k] ?? 0] as Enemy;
    if (e.hp <= 0 || alreadyHit(p, e)) continue;
    const d2 = (e.pos.x - p.pos.x) ** 2 + (e.pos.y - p.pos.y) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = e;
    }
  }
  if (!best) return false;
  const speed = Math.hypot(p.vel.x, p.vel.y);
  const d = Math.sqrt(bestD2) || 1;
  p.vel.x = ((best.pos.x - p.pos.x) / d) * speed;
  p.vel.y = ((best.pos.y - p.pos.y) / d) * speed;
  p.bounces--;
  p.pierce = 0;
  // A fresh flight, so a bounce off a far zombie isn't cut short.
  p.life = Math.max(p.life, d / speed + FIXED_LIFE_PAD);
  return true;
}

/**
 * Damages and pushes outward every living zombie whose body reaches into the circle.
 * Returns how many were hit. The query margin covers the biggest enemy and the few px
 * zombies move between the spatial index and this call (separation, shelves).
 */
export function blast(
  world: World,
  x: number,
  y: number,
  radius: number,
  damage: number,
  knockback: number,
  source: number,
): number {
  const buf = world.queryBuf;
  const n = world.hash.query(x, y, radius + MAX_ENEMY_RADIUS, buf);
  let hit = 0;
  for (let k = 0; k < n; k++) {
    const e = world.enemies.items[buf[k] ?? 0] as Enemy;
    if (e.hp <= 0) continue;
    const dx = e.pos.x - x;
    const dy = e.pos.y - y;
    const d = Math.hypot(dx, dy);
    if (d > radius + e.radius) continue;
    const kx = d > 1e-6 ? (dx / d) * knockback : 0;
    const ky = d > 1e-6 ? (dy / d) * knockback : 0;
    hitEnemy(world, e, damage, kx, ky, source);
    hit++;
  }
  return hit;
}

/** Grenade cans: blast where the can is. Called before the projectile is released. */
function explode(world: World, p: Projectile): void {
  if (p.explosionRadius <= 0) return;
  blast(world, p.pos.x, p.pos.y, p.explosionRadius, p.explosionDamage, p.knockback, p.source);
  emit(world.events, 'canExplosion', p.pos.x, p.pos.y);
}

/** Returns true if the projectile is used up. */
function collide(world: World, p: Projectile): boolean {
  const buf = world.queryBuf;
  const n = world.hash.query(p.pos.x, p.pos.y, p.radius + MAX_ENEMY_RADIUS, buf);
  const speed = Math.hypot(p.vel.x, p.vel.y) || 1;
  for (let k = 0; k < n; k++) {
    const e = world.enemies.items[buf[k] ?? 0] as Enemy;
    if (e.hp <= 0 || alreadyHit(p, e)) continue;
    const dx = e.pos.x - p.pos.x;
    const dy = e.pos.y - p.pos.y;
    const r = e.radius + p.radius;
    if (dx * dx + dy * dy > r * r) continue;
    const kx = (p.vel.x / speed) * p.knockback;
    hitEnemy(world, e, p.damage * p.damageScale, kx, (p.vel.y / speed) * p.knockback, p.source);
    p.damageScale *= 1 - p.pierceFalloff;
    applyBurn(e, p);
    p.hits[p.hitCount++] = e;
    p.pierce--;
    if (p.pierce < 0) return !bounce(world, p);
  }
  return false;
}

export function projectileSystem(world: World, dt: number): void {
  const pool = world.projectiles;
  for (let i = pool.count - 1; i >= 0; i--) {
    const p = pool.items[i] as Projectile;
    p.prevPos.x = p.pos.x;
    p.prevPos.y = p.pos.y;
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.life -= dt;
    if (circleHitsShelf(p.pos.x, p.pos.y, p.radius, world.seed)) {
      emit(world.events, 'shelfHit', p.pos.x, p.pos.y);
      explode(world, p);
      pool.releaseAt(i);
      continue;
    }
    // A grenade never vanishes silently: it goes off on a zombie, a shelf or at the end of its flight.
    if (collide(world, p) || p.life <= 0) {
      explode(world, p);
      pool.releaseAt(i);
    }
  }
}
