import { setVec, vec2, type Vec2 } from '../core/math';
import { COMBAT } from '../data/combat';
import type { ProjectileLevel, ProjectileLook } from '../data/weapons';
import { MAX_ENEMY_RADIUS, type Enemy } from './enemies';
import { damageEnemy } from './systems/damage';
import type { World } from './world';

export interface Projectile {
  pos: Vec2;
  prevPos: Vec2;
  vel: Vec2;
  damage: number;
  radius: number;
  /** Remaining extra enemies it may pass through; removed when it goes below 0. */
  pierce: number;
  life: number;
  knockback: number;
  look: ProjectileLook;
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
    radius: 0,
    pierce: 0,
    life: 0,
    knockback: 0,
    look: 'can',
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
): Projectile | undefined {
  const p = world.projectiles.acquire();
  if (!p) return undefined;
  setVec(p.pos, x, y);
  setVec(p.prevPos, x, y);
  setVec(p.vel, Math.cos(angle) * stats.speed, Math.sin(angle) * stats.speed);
  p.damage = stats.damage * world.player.mods.damage;
  p.radius = stats.radius;
  p.pierce = Math.min(stats.pierce, COMBAT.maxProjectileHits - 1);
  p.life = stats.lifetime;
  p.knockback = stats.knockback;
  p.look = look;
  p.hitCount = 0;
  p.hits.fill(null);
  return p;
}

function alreadyHit(p: Projectile, e: Enemy): boolean {
  for (let i = 0; i < p.hitCount; i++) if (p.hits[i] === e) return true;
  return false;
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
    damageEnemy(e, p.damage, (p.vel.x / speed) * p.knockback, (p.vel.y / speed) * p.knockback);
    p.hits[p.hitCount++] = e;
    p.pierce--;
    if (p.pierce < 0) return true;
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
    if (p.life <= 0 || collide(world, p)) pool.releaseAt(i);
  }
}
