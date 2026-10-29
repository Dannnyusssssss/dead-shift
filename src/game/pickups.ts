import { setVec, vec2, type Vec2 } from '../core/math';
import { COUPONS } from '../data/progression';
import { AMMO } from '../data/weapons';
import { addAmmo } from './manual';
import type { Player } from './player';
import { addXp } from './progression';
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

export function createCouponObject(): Coupon {
  return { pos: vec2(), value: 0, attracted: false, speed: 0 };
}

export function createAmmoBoxObject(): AmmoBox {
  return { pos: vec2(), attracted: false, speed: 0 };
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
  for (const tier of AMMO.dropTiers) if (xp >= tier.minXp) return tier.chance;
  return 0;
}

/** Rolls the seeded RNG and maybe drops an ammo box (silently skipped if the pool is full). */
export function maybeDropAmmo(world: World, x: number, y: number, xp: number): void {
  if (world.rng.next() >= ammoDropChance(xp)) return;
  const box = world.ammoBoxes.acquire();
  if (box) place(box, x, y);
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
  if (c) setVec(c.pos, x, y);
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
  const p = world.player;

  const coupons = world.coupons;
  for (let i = coupons.count - 1; i >= 0; i--) {
    const c = coupons.items[i] as Coupon;
    if (!pull(c, p, p.radius + COUPONS.radius, dt)) continue;
    addXp(p, c.value);
    coupons.releaseAt(i);
  }

  const boxes = world.ammoBoxes;
  for (let i = boxes.count - 1; i >= 0; i--) {
    const b = boxes.items[i] as AmmoBox;
    if (!pull(b, p, p.radius + AMMO.radius, dt)) continue;
    addAmmo(p, AMMO.boxAmount);
    boxes.releaseAt(i);
  }
}
