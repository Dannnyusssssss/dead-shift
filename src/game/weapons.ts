import { WEAPONS, type ArcLevel, type WeaponDef, type WeaponId } from '../data/weapons';
import { MAX_ENEMY_RADIUS, type Enemy } from './enemies';
import { damageEnemy } from './systems/damage';
import type { World } from './world';

export interface WeaponInstance {
  def: Readonly<WeaponDef>;
  /** 1-based. */
  level: number;
  /** Seconds until the next activation. */
  cooldown: number;
  /** Game time of the last activation (render uses it for the swing effect). */
  lastFireTime: number;
  /** Direction of the last activation, radians. */
  fireAngle: number;
}

export function createWeapon(id: WeaponId): WeaponInstance {
  return {
    def: WEAPONS[id],
    level: 1,
    cooldown: 0,
    lastFireTime: Number.NEGATIVE_INFINITY,
    fireAngle: 0,
  };
}

export function levelStats(weapon: Readonly<WeaponInstance>): Readonly<ArcLevel> {
  const levels = weapon.def.levels;
  const stats = levels[Math.min(weapon.level, levels.length) - 1] ?? levels[0];
  if (!stats) throw new Error(`Weapon ${weapon.def.id} has no levels`);
  return stats;
}

/** Shortest signed difference between two angles, in (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

function sweepArc(world: World, angle: number, stats: Readonly<ArcLevel>): void {
  const p = world.player;
  const halfArc = ((stats.arcDegrees / 2) * Math.PI) / 180;
  const buf = world.queryBuf;
  const n = world.hash.query(p.pos.x, p.pos.y, stats.range + MAX_ENEMY_RADIUS, buf);
  for (let k = 0; k < n; k++) {
    const e = world.enemies.items[buf[k] ?? 0] as Enemy;
    if (e.hp <= 0) continue;
    const dx = e.pos.x - p.pos.x;
    const dy = e.pos.y - p.pos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > stats.range + e.radius) continue;
    if (d > e.radius) {
      // Widen the arc by the enemy's angular size so grazing hits count.
      const tolerance = Math.asin(e.radius / d);
      if (Math.abs(angleDiff(Math.atan2(dy, dx), angle)) > halfArc + tolerance) continue;
    }
    const nx = d > 1e-6 ? dx / d : Math.cos(angle);
    const ny = d > 1e-6 ? dy / d : Math.sin(angle);
    damageEnemy(e, stats.damage, nx * stats.knockback, ny * stats.knockback);
  }
}

type WeaponBehavior = (weapon: WeaponInstance, world: World) => void;

function arc(weapon: WeaponInstance, world: World): void {
  const stats = levelStats(weapon);
  const angle = Math.atan2(world.player.facing.y, world.player.facing.x);
  weapon.fireAngle = angle;
  weapon.lastFireTime = world.time;
  sweepArc(world, angle, stats);
  if (stats.bothSides) sweepArc(world, angle + Math.PI, stats);
}

const BEHAVIORS: Readonly<Record<WeaponDef['behavior'], WeaponBehavior>> = { arc };

export function weaponSystem(world: World, dt: number): void {
  for (const weapon of world.player.weapons) {
    weapon.cooldown -= dt;
    if (weapon.cooldown > 0) continue;
    BEHAVIORS[weapon.def.behavior](weapon, world);
    weapon.cooldown += levelStats(weapon).cooldown;
  }
}
