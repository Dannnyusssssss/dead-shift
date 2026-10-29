import { setVec, vec2, type Vec2 } from '../core/math';
import { COUPONS, FLOOR_ITEMS } from '../data/progression';
import { AMMO } from '../data/weapons';
import { addAmmo, isReloading } from './manual';
import type { Player } from './player';
import { emit } from './events';
import { addXp } from './progression';
import { pushOutOfShelves } from './shelves';
import type { World } from './world';

/** A floor pickup the magnet can grab. */
interface Magnetic {
  pos: Vec2;
  /** Grabbed by the magnet: flies to the player from now on. */
  attracted: boolean;
  speed: number;
}

/** XP coupon on the floor. */
export interface Coupon extends Magnetic {
  value: number;
}

/** Box of gun rounds on the floor. */
export type AmmoBox = Magnetic;

export type FloorItemKind = 'medkit' | 'magnet';

/** Rare pickup: a medkit (heals) or a floor magnet (pulls every coupon on the map). */
export interface FloorItem extends Magnetic {
  kind: FloorItemKind;
}

export function createCouponObject(): Coupon {
  return { pos: vec2(), value: 0, attracted: false, speed: 0 };
}

export function createAmmoBoxObject(): AmmoBox {
  return { pos: vec2(), attracted: false, speed: 0 };
}

export function createFloorItemObject(): FloorItem {
  return { pos: vec2(), attracted: false, speed: 0, kind: 'medkit' };
}

function place(item: Magnetic, x: number, y: number): void {
  setVec(item.pos, x, y);
  item.attracted = false;
  item.speed = 0;
}

/** Drops a coupon; with the pool full, its value is merged into an existing one. */
export function dropCoupon(world: World, x: number, y: number, value: number): void {
  const pool = world.coupons;
  const c = pool.acquire();
  if (c) {
    place(c, x, y);
    c.value = value;
    return;
  }
  const target = pool.items[world.kills % pool.count];
  if (target) target.value += value;
}

/** Chance that an enemy worth `xp` drops an ammo box. */
export function ammoDropChance(xp: number): number {
  return tierChance(AMMO.dropTiers, xp);
}

/** Rolls the seeded RNG and maybe drops an ammo box (silently skipped if the pool is full). */
export function maybeDropAmmo(world: World, x: number, y: number, xp: number): void {
  if (world.rng.next() >= ammoDropChance(xp)) return;
  const box = world.ammoBoxes.acquire();
  if (box) place(box, x, y);
}

/** First tier whose `minXp` an enemy worth `xp` reaches; 0 below every tier. */
function tierChance(tiers: readonly { minXp: number; chance: number }[], xp: number): number {
  for (const tier of tiers) if (xp >= tier.minXp) return tier.chance;
  return 0;
}

/** Chance that an enemy worth `xp` drops a medkit (elites and the boss only). */
export function medkitDropChance(xp: number): number {
  return tierChance(FLOOR_ITEMS.medkit.dropTiers, xp);
}

function dropFloorItem(world: World, x: number, y: number, kind: FloorItemKind): void {
  const item = world.floorItems.acquire();
  if (!item) return;
  place(item, x, y);
  item.kind = kind;
}

/** Rolls the seeded RNG for a medkit and a floor magnet (silently skipped if the pool is full). */
export function maybeDropFloorItems(world: World, x: number, y: number, xp: number): void {
  if (world.rng.next() < medkitDropChance(xp)) dropFloorItem(world, x, y, 'medkit');
  if (world.rng.next() < FLOOR_ITEMS.magnet.chance) dropFloorItem(world, x, y, 'magnet');
}

/** Every coupon on the floor starts flying to the player, wherever it is. */
export function attractAllCoupons(world: World): void {
  const { items, count } = world.coupons;
  for (let i = 0; i < count; i++) {
    const c = items[i] as Coupon;
    if (c.attracted) continue;
    c.attracted = true;
    c.speed = COUPONS.attractStartSpeed;
  }
}

/** Heals a fraction of max hp, capped at max hp. */
export function healFraction(p: Player, fraction: number): void {
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * fraction);
}

function collectFloorItems(world: World, dt: number): void {
  const p = world.player;
  const pool = world.floorItems;
  const collectRadius = p.radius + FLOOR_ITEMS.radius;
  for (let i = pool.count - 1; i >= 0; i--) {
    const item = pool.items[i] as FloorItem;
    // A medkit is left on the floor while health is full, so it isn't wasted.
    if (item.kind === 'medkit' && !item.attracted && p.hp >= p.maxHp) continue;
    if (!pull(item, p, collectRadius, dt)) continue;
    if (item.kind === 'medkit') {
      healFraction(p, FLOOR_ITEMS.medkit.healFraction);
      emit(world.events, 'medkitPickup', item.pos.x, item.pos.y);
    } else {
      attractAllCoupons(world);
      emit(world.events, 'magnetPickup', item.pos.x, item.pos.y);
    }
    pool.releaseAt(i);
  }
}

/** Boss chest on the floor; walk over it to open a free weapon upgrade. */
export interface Chest {
  pos: Vec2;
}

export function createChestObject(): Chest {
  return { pos: vec2() };
}

export function dropChest(world: World, x: number, y: number): void {
  const c = world.chests.acquire();
  if (!c) return;
  setVec(c.pos, x, y);
  pushOutOfShelves(c.pos, COUPONS.chestRadius, world.seed);
}

function collectChests(world: World): void {
  const pool = world.chests;
  const p = world.player;
  const r = p.radius + COUPONS.chestRadius;
  for (let i = pool.count - 1; i >= 0; i--) {
    const c = pool.items[i] as Chest;
    const dx = p.pos.x - c.pos.x;
    const dy = p.pos.y - c.pos.y;
    if (dx * dx + dy * dy > r * r) continue;
    p.pendingChests++;
    pool.releaseAt(i);
  }
}

/** Magnet pull toward the player. Returns true once the item reaches the player. */
function pull(item: Magnetic, p: Player, collectRadius: number, dt: number): boolean {
  const dx = p.pos.x - item.pos.x;
  const dy = p.pos.y - item.pos.y;
  const d2 = dx * dx + dy * dy;
  if (!item.attracted) {
    if (d2 > p.pickupRadius * p.pickupRadius) return false;
    item.attracted = true;
    item.speed = COUPONS.attractStartSpeed;
  }
  const d = Math.sqrt(d2);
  if (d <= collectRadius) return true;
  item.speed = Math.min(COUPONS.maxSpeed, item.speed + COUPONS.attractAccel * dt);
  const step = Math.min(d, item.speed * dt);
  item.pos.x += (dx / d) * step;
  item.pos.y += (dy / d) * step;
  return false;
}

export function pickupSystem(world: World, dt: number): void {
  collectChests(world);
  // Before the coupons, so a magnet's pull starts this same step.
  collectFloorItems(world, dt);
  const p = world.player;

  const coupons = world.coupons;
  for (let i = coupons.count - 1; i >= 0; i--) {
    const c = coupons.items[i] as Coupon;
    if (!pull(c, p, p.radius + COUPONS.radius, dt)) continue;
    addXp(p, c.value);
    emit(world.events, 'couponPickup', c.pos.x, c.pos.y);
    coupons.releaseAt(i);
  }

  const boxes = world.ammoBoxes;
  for (let i = boxes.count - 1; i >= 0; i--) {
    const b = boxes.items[i] as AmmoBox;
    if (!pull(b, p, p.radius + AMMO.radius, dt)) continue;
    emit(world.events, 'ammoPickup', b.pos.x, b.pos.y);
    if (addAmmo(p, AMMO.boxAmount)) {
      emit(world.events, 'weaponSwap', p.pos.x, p.pos.y);
      if (isReloading(p.manual)) emit(world.events, 'reloadStart', p.pos.x, p.pos.y);
    }
    boxes.releaseAt(i);
  }
}
