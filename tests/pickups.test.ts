import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { COUPONS } from '../src/data/progression';
import { ENEMIES } from '../src/data/enemies';
import { dropCoupon, pickupSystem } from '../src/game/pickups';
import { deathSystem } from '../src/game/systems/death';
import { addClient, emptyWorld } from './helpers';

describe('coupons', () => {
  it('a dead zombie drops a coupon with its xp value', () => {
    const world = emptyWorld();
    const e = addClient(world, 300, 0);
    e.hp = 0;
    deathSystem(world);
    expect(world.coupons.count).toBe(1);
    expect(world.coupons.items[0]?.value).toBe(ENEMIES.client.xp);
    expect(world.coupons.items[0]?.pos).toEqual({ x: 300, y: 0 });
  });

  it('stays put outside the pickup radius', () => {
    const world = emptyWorld();
    dropCoupon(world, world.player.pickupRadius + 50, 0, 1);
    for (let i = 0; i < 60; i++) pickupSystem(world, FIXED_STEP);
    expect(world.coupons.items[0]?.pos.x).toBe(world.player.pickupRadius + 50);
  });

  it('is pulled in by the magnet and collected for xp', () => {
    const world = emptyWorld();
    dropCoupon(world, world.player.pickupRadius - 5, 0, 5);
    pickupSystem(world, FIXED_STEP);
    expect(world.coupons.items[0]?.attracted).toBe(true);
    for (let i = 0; i < 60 && world.coupons.count > 0; i++) pickupSystem(world, FIXED_STEP);
    expect(world.coupons.count).toBe(0);
    expect(world.player.xp).toBe(5);
  });

  it('stays attracted even if the player walks away', () => {
    const world = emptyWorld();
    dropCoupon(world, world.player.pickupRadius - 5, 0, 1);
    pickupSystem(world, FIXED_STEP);
    world.player.pos.x = -500;
    for (let i = 0; i < 240 && world.coupons.count > 0; i++) pickupSystem(world, FIXED_STEP);
    expect(world.coupons.count).toBe(0);
  });

  it('merges value into existing coupons when the pool is full', () => {
    const world = emptyWorld();
    for (let i = 0; i < COUPONS.capacity; i++) dropCoupon(world, 5000 + i, 5000, 1);
    dropCoupon(world, 0, 0, 20);
    expect(world.coupons.count).toBe(COUPONS.capacity);
    const total = world.coupons.items.reduce((sum, c) => sum + c.value, 0);
    expect(total).toBe(COUPONS.capacity + 20);
  });
});
