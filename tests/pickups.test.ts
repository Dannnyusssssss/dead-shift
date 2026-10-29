import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { COUPONS } from '../src/data/progression';
import { ENEMIES } from '../src/data/enemies';
import { ammoDropChance, dropCoupon, maybeDropAmmo, pickupSystem } from '../src/game/pickups';
import { spawnEnemy } from '../src/game/enemies';
import { AMMO } from '../src/data/weapons';
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

describe('ammo boxes', () => {
  it('drop chance depends on how valuable the zombie is', () => {
    expect(ammoDropChance(ENEMIES.client.xp)).toBe(AMMO.dropTiers[2]?.chance);
    expect(ammoDropChance(ENEMIES.frozen.xp)).toBe(AMMO.dropTiers[1]?.chance);
    expect(ammoDropChance(ENEMIES.manager.xp)).toBe(1);
  });

  it('drops are deterministic with the seed and roughly match the chance', () => {
    const count = (seed: number) => {
      const world = emptyWorld(seed);
      let drops = 0;
      for (let i = 0; i < 2000; i++) {
        const before = world.ammoBoxes.count;
        maybeDropAmmo(world, 5000, 5000, ENEMIES.client.xp);
        if (world.ammoBoxes.count > before) drops++;
        world.ammoBoxes.clear();
      }
      return drops;
    };
    expect(count(3)).toBe(count(3));
    const rate = count(3) / 2000;
    expect(rate).toBeGreaterThan(ammoDropChance(1) * 0.7);
    expect(rate).toBeLessThan(ammoDropChance(1) * 1.3);
  });

  it('the boss always drops one', () => {
    const world = emptyWorld();
    const boss = spawnEnemy(world, ENEMIES.manager, 400, 0);
    if (!boss) throw new Error('no boss');
    boss.hp = 0;
    deathSystem(world);
    expect(world.ammoBoxes.count).toBe(1);
  });

  it('is pulled in by the magnet and adds rounds to the reserve', () => {
    const world = emptyWorld();
    const before = world.player.manual.reserve;
    maybeDropAmmo(world, world.player.pickupRadius - 5, 0, ENEMIES.manager.xp);
    for (let i = 0; i < 60 && world.ammoBoxes.count > 0; i++) pickupSystem(world, FIXED_STEP);
    expect(world.ammoBoxes.count).toBe(0);
    expect(world.player.manual.reserve).toBe(before + AMMO.boxAmount);
  });
});
