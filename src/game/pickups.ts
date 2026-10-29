import { setVec, vec2, type Vec2 } from '../core/math';
import { COUPONS } from '../data/progression';
import { addXp } from './progression';
import type { World } from './world';

/** XP coupon on the floor. */
export interface Coupon {
  pos: Vec2;
  value: number;
  /** Grabbed by the magnet: flies to the player from now on. */
  attracted: boolean;
  speed: number;
}

export function createCouponObject(): Coupon {
  return { pos: vec2(), value: 0, attracted: false, speed: 0 };
}

/** Drops a coupon; with the pool full, its value is merged into an existing one. */
export function dropCoupon(world: World, x: number, y: number, value: number): void {
  const pool = world.coupons;
  const c = pool.acquire();
  if (c) {
    setVec(c.pos, x, y);
    c.value = value;
    c.attracted = false;
    c.speed = 0;
    return;
  }
  const target = pool.items[world.kills % pool.count];
  if (target) target.value += value;
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

export function pickupSystem(world: World, dt: number): void {
  collectChests(world);
  const pool = world.coupons;
  const p = world.player;
  const grab2 = p.pickupRadius * p.pickupRadius;
  const collect = p.radius + COUPONS.radius;
  for (let i = pool.count - 1; i >= 0; i--) {
    const c = pool.items[i] as Coupon;
    const dx = p.pos.x - c.pos.x;
    const dy = p.pos.y - c.pos.y;
    const d2 = dx * dx + dy * dy;
    if (!c.attracted) {
      if (d2 > grab2) continue;
      c.attracted = true;
      c.speed = COUPONS.attractStartSpeed;
    }
    const d = Math.sqrt(d2);
    if (d <= collect) {
      addXp(p, c.value);
      pool.releaseAt(i);
      continue;
    }
    c.speed = Math.min(COUPONS.maxSpeed, c.speed + COUPONS.attractAccel * dt);
    const step = Math.min(d, c.speed * dt);
    c.pos.x += (dx / d) * step;
    c.pos.y += (dy / d) * step;
  }
}
