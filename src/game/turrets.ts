import { setVec, vec2, type Vec2 } from '../core/math';
import type { TurretLevel } from '../data/weapons';
import { MAX_ENEMY_RADIUS, type Enemy } from './enemies';
import { hitEnemy } from './systems/damage';
import type { World } from './world';

/** Max rays any turret level fires; sizes the beam buffers. */
export const MAX_TURRET_RAYS = 4;

export interface Turret {
  pos: Vec2;
  life: number;
  maxLife: number;
  fireTimer: number;
  /** Snapshot of the weapon stats when it was placed (mods already applied). */
  damage: number;
  cooldown: number;
  rays: number;
  range: number;
  /** Index in WEAPON_IDS of the weapon that placed it. */
  source: number;
  /** Last zap, for the render: time and target positions. */
  lastFireTime: number;
  beamCount: number;
  beamX: Float32Array;
  beamY: Float32Array;
}

export function createTurretObject(): Turret {
  return {
    pos: vec2(),
    life: 0,
    maxLife: 0,
    fireTimer: 0,
    damage: 0,
    cooldown: 0,
    rays: 0,
    range: 0,
    source: -1,
    lastFireTime: Number.NEGATIVE_INFINITY,
    beamCount: 0,
    beamX: new Float32Array(MAX_TURRET_RAYS),
    beamY: new Float32Array(MAX_TURRET_RAYS),
  };
}

export function placeTurret(
  world: World,
  x: number,
  y: number,
  stats: Readonly<TurretLevel>,
  source: number,
): Turret | undefined {
  const t = world.turrets.acquire();
  if (!t) return undefined;
  const mods = world.player.mods;
  setVec(t.pos, x, y);
  t.life = t.maxLife = stats.duration;
  t.fireTimer = 0;
  t.damage = stats.damage * mods.damage;
  t.cooldown = stats.cooldown * mods.cooldown;
  t.rays = Math.min(stats.rays, MAX_TURRET_RAYS);
  t.range = stats.range;
  t.source = source;
  t.lastFireTime = Number.NEGATIVE_INFINITY;
  t.beamCount = 0;
  return t;
}

const targets: Enemy[] = [];
const targetDist: number[] = [];

/** Up to `k` nearest living enemies within `range`, closest first. The array is reused between calls. */
export function nearestEnemies(
  world: World,
  x: number,
  y: number,
  range: number,
  k: number,
): readonly Enemy[] {
  targets.length = 0;
  targetDist.length = 0;
  const buf = world.queryBuf;
  const n = world.hash.query(x, y, range + MAX_ENEMY_RADIUS, buf);
  const range2 = range * range;
  for (let i = 0; i < n; i++) {
    const e = world.enemies.items[buf[i] ?? 0] as Enemy;
    if (e.hp <= 0) continue;
    const dx = e.pos.x - x;
    const dy = e.pos.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 > range2) continue;
    // Insertion into a tiny sorted list (k <= MAX_TURRET_RAYS).
    let j: number;
    if (targets.length < k) {
      j = targets.push(e) - 1;
      targetDist.push(d2);
    } else if (d2 < (targetDist[k - 1] ?? Infinity)) {
      j = k - 1;
      targets[j] = e;
      targetDist[j] = d2;
    } else {
      continue;
    }
    while (j > 0 && (targetDist[j - 1] ?? 0) > d2) {
      targets[j] = targets[j - 1] as Enemy;
      targetDist[j] = targetDist[j - 1] ?? 0;
      targets[j - 1] = e;
      targetDist[j - 1] = d2;
      j--;
    }
  }
  return targets;
}

function zap(world: World, t: Turret): void {
  const hit = nearestEnemies(world, t.pos.x, t.pos.y, t.range, t.rays);
  t.beamCount = hit.length;
  for (let i = 0; i < hit.length; i++) {
    const e = hit[i] as Enemy;
    t.beamX[i] = e.pos.x;
    t.beamY[i] = e.pos.y;
    hitEnemy(world, e, t.damage, 0, 0, t.source);
  }
  if (hit.length > 0) t.lastFireTime = world.time;
}

export function turretSystem(world: World, dt: number): void {
  const pool = world.turrets;
  for (let i = pool.count - 1; i >= 0; i--) {
    const t = pool.items[i] as Turret;
    t.life -= dt;
    if (t.life <= 0) {
      pool.releaseAt(i);
      continue;
    }
    t.fireTimer -= dt;
    if (t.fireTimer > 0) continue;
    zap(world, t);
    // Keep trying every step until something is in range, then wait a full cooldown.
    t.fireTimer = t.beamCount > 0 ? t.cooldown : 0;
  }
}
