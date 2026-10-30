import { setVec } from '../src/core/math';
import { ENEMIES } from '../src/data/enemies';
import { spawnEnemy, type Enemy } from '../src/game/enemies';
import { entryOf, gunStats, hasAmmo, isGun, type ManualEntry } from '../src/game/manual';
import type { Vec2 } from '../src/core/math';
import { circleHitsShelf } from '../src/game/shelves';
import { findNearestEnemy } from '../src/game/weapons';
import { createWorld, type World } from '../src/game/world';

/** The pistol's ammo entry (always owned). */
export function pistolOf(world: World): ManualEntry {
  const e = entryOf(world.player.manual, 'labelGun');
  if (!e) throw new Error('no pistol');
  return e;
}

/** The shotgun's ammo entry; throws if the player doesn't have it. */
export function shotgunOf(world: World): ManualEntry {
  const e = entryOf(world.player.manual, 'shotgun');
  if (!e) throw new Error('no shotgun');
  return e;
}

/** Fresh world with no enemies; tests call individual systems on it. */
export function emptyWorld(seed = 1): World {
  return createWorld(seed);
}

export function addClient(world: World, x: number, y: number): Enemy {
  const e = spawnEnemy(world, ENEMIES.client, x, y);
  if (!e) throw new Error('pool full');
  return e;
}

function nearestItem<T extends { pos: Vec2 }>(
  world: World,
  pool: { readonly items: readonly T[]; readonly count: number },
  maxDist = Infinity,
): T | undefined {
  const p = world.player.pos;
  let best: T | undefined;
  let bestD = maxDist;
  for (let i = 0; i < pool.count; i++) {
    const b = pool.items[i];
    if (!b) continue;
    const d = Math.hypot(b.pos.x - p.x, b.pos.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

/**
 * Bot preference when picking an upgrade card: weapons first, then passives, then heal.
 * With `newWeapons` false it takes a new automatic weapon only when nothing else is offered.
 */
export function botPickOffer(world: World, newWeapons = true): number {
  const rank = (kind: string): number =>
    kind === 'newWeapon'
      ? newWeapons
        ? 0
        : 5
      : kind === 'upgradeWeapon'
        ? 1
        : kind === 'heal'
          ? 4
          : 2;
  let best = 0;
  world.offers.forEach((o, i) => {
    if (rank(o.kind) < rank(world.offers[best]?.kind ?? 'heal')) best = i;
  });
  return best;
}

/** The bot rerolls a level-up screen that offers no weapon at all, while rerolls are left. */
export function botWantsReroll(world: World): boolean {
  return (
    world.offerSource === 'level' &&
    world.rerollsLeft > 0 &&
    !world.offers.some((o) => o.kind === 'newWeapon' || o.kind === 'upgradeWeapon')
  );
}

/** Distance within which the bot feels "pressure" from a zombie and steps away from it, px. */
const BOT_DANGER_RADIUS = 220;
/** Fraction of the gun's reach within which the bot pulls the trigger. */
const BOT_FIRE_REACH = 0.85;
const reachOf = (s: { speed: number; lifetime: number }): number =>
  s.speed * s.lifetime * BOT_FIRE_REACH;
/** With no zombie this close, the bot walks to coupons within `BOT_COUPON_RANGE`, px. */
const BOT_SAFE_RADIUS = 140;
const BOT_COUPON_RANGE = 350;
/** Spacing of the samples of the line of fire checked against shelves, px. */
const BOT_SIGHT_STEP = 16;

/** No shelf between the two points (a person doesn't shoot into a shelf). */
function clearShot(world: World, x0: number, y0: number, x1: number, y1: number): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.ceil(d / BOT_SIGHT_STEP);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (circleHitsShelf(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 2, world.seed)) return false;
  }
  return true;
}

/**
 * A crude stand-in for a human player, used by the long simulations: aims at the nearest
 * zombie and holds the trigger, kites away from the crowd (weighted by closeness, with a
 * sideways drift so it circles instead of backing into a wall of zombies), closes in with
 * the broom, and walks to the nearest ammo box when it is running dry. It holds fire while a
 * shelf is in the way.
 * With `useMelee` false it never swings: with the gun dry it only kites and looks for boxes.
 */
export function playerBot(world: World, useMelee = true): void {
  const p = world.player.pos;
  const m = world.player.manual;
  const target = findNearestEnemy(world, p.x, p.y, Infinity);
  world.aimActive = true;
  // Shotgun when the target is within its reach and it has shells, otherwise the pistol.
  const dist = target ? Math.hypot(target.pos.x - p.x, target.pos.y - p.y) : Infinity;
  if (m.active !== 'broom' || !m.autoSwitched) {
    const sg = entryOf(m, 'shotgun') ? gunStats(m, 'shotgun') : undefined;
    const wantsShotgun = sg !== undefined && hasAmmo(m, 'shotgun') && dist <= reachOf(sg);
    if (wantsShotgun && m.active !== 'shotgun') world.selectRequested = 3;
    else if (!wantsShotgun && m.active === 'shotgun' && hasAmmo(m, 'labelGun')) {
      world.selectRequested = 1;
    }
  }
  const meleeActive = !isGun(m.owned.find((e) => e.weapon.def.id === m.active) as ManualEntry);
  // Like a person, it only shoots at zombies its rounds can reach (not at the ones off-screen).
  const reach = meleeActive ? Infinity : reachOf(gunStats(m));
  const inReach =
    target !== undefined &&
    Math.hypot(target.pos.x - p.x, target.pos.y - p.y) <= reach &&
    clearShot(world, p.x, p.y, target.pos.x, target.pos.y);
  world.triggerHeld = meleeActive ? target !== undefined && useMelee : inReach;
  let mx = 0;
  let my = 0;
  if (target) {
    const dx = target.pos.x - p.x;
    const dy = target.pos.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    setVec(world.aim, dx / d, dy / d);
    if (meleeActive && useMelee && d > 50) {
      mx = dx / d;
      my = dy / d;
    } else {
      // Repulsion from every nearby zombie, closer ones weigh more.
      let rx = 0;
      let ry = 0;
      for (let i = 0; i < world.enemies.count; i++) {
        const e = world.enemies.items[i];
        if (!e) continue;
        const ex = p.x - e.pos.x;
        const ey = p.y - e.pos.y;
        const ed = Math.hypot(ex, ey) || 1;
        if (ed > BOT_DANGER_RADIUS) continue;
        const w = (BOT_DANGER_RADIUS - ed) / BOT_DANGER_RADIUS;
        rx += (ex / ed) * w;
        ry += (ey / ed) * w;
      }
      // Drift sideways relative to the target so the bot circles the horde.
      mx = rx - (dy / d) * 0.6;
      my = ry + (dx / d) * 0.6;
    }
  }
  const safe = !target || Math.hypot(target.pos.x - p.x, target.pos.y - p.y) > BOT_SAFE_RADIUS;
  const pistolReserve = entryOf(m, 'labelGun')?.reserve ?? 0;
  const lowOnAmmo = !hasAmmo(m, 'labelGun') || pistolReserve < 20;
  const box = lowOnAmmo ? nearestItem(world, world.ammoBoxes) : undefined;
  const coupon = safe && !box ? nearestItem(world, world.coupons, BOT_COUPON_RANGE) : undefined;
  if (coupon && !(meleeActive && useMelee)) {
    const dx = coupon.pos.x - p.x;
    const dy = coupon.pos.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    mx = dx / d;
    my = dy / d;
  }
  if (box) {
    const dx = box.pos.x - p.x;
    const dy = box.pos.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    mx = dx / d;
    my = dy / d;
  }
  setVec(world.moveInput, mx, my);
}
