import { COMBAT } from '../data/combat';
import {
  WEAPON_IDS,
  WEAPONS,
  type ArcLevel,
  type ConeWeaponDef,
  type OrbitLevel,
  type OrbitWeaponDef,
  type ProjectileLevel,
  type ProjectileLook,
  type ProjectileWeaponDef,
  type TurretWeaponDef,
  type WeaponDef,
  type WeaponId,
  type WeaponLevel,
} from '../data/weapons';
import { spawnArc } from './arcs';
import { MAX_ENEMY_RADIUS, type Enemy } from './enemies';
import { emit } from './events';
import { spawnProjectile } from './projectiles';
import { hitEnemy } from './systems/damage';
import { placeTurret } from './turrets';
import type { World } from './world';

export interface WeaponInstance {
  def: Readonly<WeaponDef>;
  /** Index in WEAPON_IDS (for per-enemy hit timers). */
  slot: number;
  /** 1-based. */
  level: number;
  /** Seconds until the next activation. */
  cooldown: number;
  /** Game time of the last activation (render uses it for swing effects). */
  lastFireTime: number;
  /** Direction of the last activation, radians. */
  fireAngle: number;
  /** Cone: remaining active time of the cloud. */
  activeTimer: number;
  /** Cone: time until the next damage tick. */
  tickTimer: number;
  /** Orbit: current rotation, radians. */
  phase: number;
}

export function createWeapon(id: WeaponId): WeaponInstance {
  return {
    def: WEAPONS[id],
    slot: WEAPON_IDS.indexOf(id),
    level: 1,
    cooldown: 0,
    lastFireTime: Number.NEGATIVE_INFINITY,
    fireAngle: 0,
    activeTimer: 0,
    tickTimer: 0,
    phase: 0,
  };
}

/** Stats of `level` (1-based) from a level table, clamped to the table. */
export function statsAt<L>(levels: readonly L[], level: number): L {
  const stats = levels[Math.max(1, Math.min(level, levels.length)) - 1];
  if (stats === undefined) throw new Error('Weapon has no levels');
  return stats;
}

export function levelStats(weapon: Readonly<WeaponInstance>): Readonly<WeaponLevel> {
  return statsAt<WeaponLevel>(weapon.def.levels, weapon.level);
}

/** Shortest signed difference between two angles, in (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;

function facingAngle(world: World): number {
  return Math.atan2(world.player.facing.y, world.player.facing.x);
}

/**
 * Damages (and optionally poisons) every living enemy inside the circular sector.
 * Returns the first enemy hit (for the electric broom's discharge), if any.
 */
export function hitSector(
  world: World,
  x: number,
  y: number,
  angle: number,
  halfArc: number,
  range: number,
  damage: number,
  knockback: number,
  source: number,
  poisonDps = 0,
  poisonTime = 0,
): Enemy | undefined {
  let first: Enemy | undefined;
  const buf = world.queryBuf;
  const n = world.hash.query(x, y, range + MAX_ENEMY_RADIUS, buf);
  for (let k = 0; k < n; k++) {
    const e = world.enemies.items[buf[k] ?? 0] as Enemy;
    if (e.hp <= 0) continue;
    const dx = e.pos.x - x;
    const dy = e.pos.y - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > range + e.radius) continue;
    if (d > e.radius) {
      // Widen the sector by the enemy's angular size so grazing hits count.
      const tolerance = Math.asin(e.radius / d);
      if (Math.abs(angleDiff(Math.atan2(dy, dx), angle)) > halfArc + tolerance) continue;
    }
    const nx = d > 1e-6 ? dx / d : Math.cos(angle);
    const ny = d > 1e-6 ? dy / d : Math.sin(angle);
    hitEnemy(world, e, damage, nx * knockback, ny * knockback, source);
    first ??= e;
    if (poisonDps > 0) {
      e.poisonDps = Math.max(e.poisonTimer > 0 ? e.poisonDps : 0, poisonDps);
      e.poisonTimer = Math.max(e.poisonTimer, poisonTime);
    }
  }
  return first;
}

/** Zombies already struck by the current discharge (reused between calls). */
const chained: Enemy[] = [];

/** Nearest living zombie within `range` of `from` that this discharge hasn't struck. */
function nextInChain(world: World, from: Readonly<Enemy>, range: number): Enemy | undefined {
  const buf = world.queryBuf;
  const n = world.hash.query(from.pos.x, from.pos.y, range + MAX_ENEMY_RADIUS, buf);
  let best: Enemy | undefined;
  let bestD2 = range * range;
  for (let k = 0; k < n; k++) {
    const e = world.enemies.items[buf[k] ?? 0] as Enemy;
    if (e.hp <= 0 || chained.includes(e)) continue;
    const d2 = (e.pos.x - from.pos.x) ** 2 + (e.pos.y - from.pos.y) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = e;
    }
  }
  return best;
}

/**
 * Electric broom: a discharge from the player to `first` that jumps up to `jumps` times to the
 * nearest zombie it hasn't struck, within `range` of the previous one. Returns the zombies struck
 * after `first`.
 */
export function chainLightning(
  world: World,
  first: Enemy,
  jumps: number,
  range: number,
  damage: number,
  source: number,
): number {
  const p = world.player.pos;
  spawnArc(world, p.x, p.y, first.pos.x, first.pos.y);
  chained.length = 0;
  chained.push(first);
  let from = first;
  for (let j = 0; j < jumps; j++) {
    const next = nextInChain(world, from, range);
    if (!next) break;
    spawnArc(world, from.pos.x, from.pos.y, next.pos.x, next.pos.y);
    hitEnemy(world, next, damage, 0, 0, source);
    chained.push(next);
    from = next;
  }
  emit(world.events, 'chainZap', first.pos.x, first.pos.y);
  return chained.length - 1;
}

/** Melee swing toward `angle` (and behind, if the level says so). */
export function swingArc(
  w: WeaponInstance,
  s: Readonly<ArcLevel>,
  world: World,
  angle: number,
): void {
  const p = world.player;
  const damage = s.damage * p.mods.damage;
  w.fireAngle = angle;
  w.lastFireTime = world.time;
  const half = toRad(s.arcDegrees / 2);
  let first = hitSector(world, p.pos.x, p.pos.y, angle, half, s.range, damage, s.knockback, w.slot);
  if (s.bothSides) {
    const back = angle + Math.PI;
    const behind = hitSector(
      world,
      p.pos.x,
      p.pos.y,
      back,
      half,
      s.range,
      damage,
      s.knockback,
      w.slot,
    );
    first ??= behind;
  }
  if (first && s.chainJumps) {
    const jumpDamage = damage * (s.chainDamageFraction ?? 0);
    chainLightning(world, first, s.chainJumps, s.chainRange ?? 0, jumpDamage, w.slot);
  }
}

export function findNearestEnemy(
  world: World,
  x: number,
  y: number,
  maxDist: number,
): Enemy | undefined {
  const { items, count } = world.enemies;
  let best: Enemy | undefined;
  let bestD2 = maxDist * maxDist;
  for (let i = 0; i < count; i++) {
    const e = items[i] as Enemy;
    if (e.hp <= 0) continue;
    const dx = e.pos.x - x;
    const dy = e.pos.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = e;
    }
  }
  return best;
}

/** Fires `count` projectiles from the player toward `angle`, fanned out by the spread. */
export function fireVolley(
  w: WeaponInstance,
  s: Readonly<ProjectileLevel>,
  look: ProjectileLook,
  world: World,
  angle: number,
): void {
  const p = world.player;
  w.fireAngle = angle;
  w.lastFireTime = world.time;
  const spread = toRad(s.spreadDegrees);
  for (let i = 0; i < s.count; i++) {
    const offset = (i - (s.count - 1) / 2) * spread;
    spawnProjectile(world, p.pos.x, p.pos.y, angle + offset, s, s.look ?? look, w.slot);
  }
}

/** Throws at the nearest enemy. Returns false when there is none (it retries next step). */
function fireAtNearest(
  w: WeaponInstance,
  def: Readonly<ProjectileWeaponDef>,
  world: World,
): boolean {
  const p = world.player;
  const target = findNearestEnemy(world, p.pos.x, p.pos.y, COMBAT.maxTargetDistance);
  if (!target) return false;
  const angle = Math.atan2(target.pos.y - p.pos.y, target.pos.x - p.pos.x);
  fireVolley(w, statsAt(def.levels, w.level), def.look, world, angle);
  emit(world.events, 'canThrow', p.pos.x, p.pos.y);
  return true;
}

/** Angle of bag `k` of an orbit weapon (shared with the renderer). */
export function orbitBagAngle(w: Readonly<WeaponInstance>, k: number, bags: number): number {
  return w.phase + (k * Math.PI * 2) / bags;
}

function updateOrbit(
  w: WeaponInstance,
  def: Readonly<OrbitWeaponDef>,
  world: World,
  dt: number,
): void {
  const s: Readonly<OrbitLevel> = statsAt(def.levels, w.level);
  const p = world.player;
  w.phase = (w.phase + s.angularSpeed * dt) % (Math.PI * 2);
  const damage = s.damage * p.mods.damage;
  const buf = world.queryBuf;
  for (let b = 0; b < s.bags; b++) {
    const a = orbitBagAngle(w, b, s.bags);
    const bx = p.pos.x + Math.cos(a) * s.orbitRadius;
    const by = p.pos.y + Math.sin(a) * s.orbitRadius;
    const n = world.hash.query(bx, by, s.bagRadius + MAX_ENEMY_RADIUS, buf);
    for (let k = 0; k < n; k++) {
      const e = world.enemies.items[buf[k] ?? 0] as Enemy;
      if (e.hp <= 0 || (e.weaponHitTimers[w.slot] ?? 0) > 0) continue;
      const dx = e.pos.x - bx;
      const dy = e.pos.y - by;
      const r = e.radius + s.bagRadius;
      if (dx * dx + dy * dy > r * r) continue;
      const ex = e.pos.x - p.pos.x;
      const ey = e.pos.y - p.pos.y;
      const d = Math.hypot(ex, ey) || 1;
      hitEnemy(world, e, damage, (ex / d) * s.knockback, (ey / d) * s.knockback, w.slot);
      e.weaponHitTimers[w.slot] = s.hitInterval;
      e.slowFactor = Math.max(e.slowTimer > 0 ? e.slowFactor : 0, s.slowFactor);
      e.slowTimer = Math.max(e.slowTimer, s.slowTime);
    }
  }
}

function updateCone(
  w: WeaponInstance,
  def: Readonly<ConeWeaponDef>,
  world: World,
  dt: number,
): void {
  const s = statsAt(def.levels, w.level);
  const p = world.player;
  if (w.activeTimer <= 0) {
    w.cooldown -= dt;
    if (w.cooldown > 0) return;
    w.activeTimer = s.activeTime;
    w.tickTimer = 0;
    w.lastFireTime = world.time;
  }
  w.fireAngle = facingAngle(world);
  w.tickTimer -= dt;
  if (w.tickTimer <= 0) {
    w.tickTimer += s.tickInterval;
    const dmg = p.mods.damage;
    const halfArc = toRad(s.angleDegrees / 2);
    hitSector(
      world,
      p.pos.x,
      p.pos.y,
      w.fireAngle,
      halfArc,
      s.range,
      s.damage * dmg,
      0,
      w.slot,
      s.poisonDps * dmg,
      s.poisonTime,
    );
  }
  w.activeTimer -= dt;
  if (w.activeTimer <= 0) {
    w.activeTimer = 0;
    w.cooldown = s.cooldown * p.mods.cooldown;
  }
}

function placeMicrowaves(w: WeaponInstance, def: Readonly<TurretWeaponDef>, world: World): void {
  const s = statsAt(def.levels, w.level);
  const p = world.player;
  const angle = facingAngle(world);
  // Several units sit side by side, perpendicular to where the player faces.
  const px = -Math.sin(angle);
  const py = Math.cos(angle);
  const gap = 45;
  for (let i = 0; i < s.units; i++) {
    const offset = (i - (s.units - 1) / 2) * gap;
    placeTurret(world, p.pos.x + px * offset, p.pos.y + py * offset, s, w.slot);
  }
  w.fireAngle = angle;
  w.lastFireTime = world.time;
  w.cooldown = (s.duration + s.respawnDelay) * p.mods.cooldown;
}

/** 0..1 of an automatic weapon's recharge still to go (0 = ready or always active), for the HUD. */
export function cooldownFraction(w: Readonly<WeaponInstance>, cooldownMult: number): number {
  const def = w.def;
  let full: number;
  switch (def.behavior) {
    case 'projectile':
      full = statsAt(def.levels, w.level).cooldown;
      break;
    case 'cone':
      if (w.activeTimer > 0) return 0;
      full = statsAt(def.levels, w.level).cooldown;
      break;
    case 'turret': {
      const s = statsAt(def.levels, w.level);
      full = s.duration + s.respawnDelay;
      break;
    }
    default:
      return 0;
  }
  const total = full * cooldownMult;
  return total > 0 ? Math.min(1, Math.max(0, w.cooldown / total)) : 0;
}

/** Automatic weapons only; manual ones live in `player.manual`. */
export function weaponSystem(world: World, dt: number): void {
  const mods = world.player.mods;
  for (const w of world.player.weapons) {
    const def = w.def;
    switch (def.behavior) {
      case 'orbit':
        updateOrbit(w, def, world, dt);
        break;
      case 'cone':
        updateCone(w, def, world, dt);
        break;
      case 'turret':
        w.cooldown -= dt;
        if (w.cooldown <= 0) placeMicrowaves(w, def, world);
        break;
      case 'melee':
      case 'gun':
        // Manual weapons are driven by the player (see manual.ts).
        break;
      case 'projectile': {
        w.cooldown -= dt;
        if (w.cooldown > 0) break;
        if (fireAtNearest(w, def, world)) {
          w.cooldown += statsAt(def.levels, w.level).cooldown * mods.cooldown;
        } else {
          w.cooldown = 0;
        }
        break;
      }
    }
  }
}
