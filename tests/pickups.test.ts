import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { COUPONS, FLOOR_ITEMS } from '../src/data/progression';
import { ENEMIES } from '../src/data/enemies';
import {
  ammoDropChance,
  createFloorItemObject,
  dropCoupon,
  maybeDropAmmo,
  maybeDropFloorItems,
  medkitDropChance,
  pickupSystem,
  type FloorItemKind,
} from '../src/game/pickups';
import type { World } from '../src/game/world';
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

function placeItem(world: World, kind: FloorItemKind, x: number, y: number): void {
  const item = world.floorItems.acquire();
  if (!item) throw new Error('pool full');
  Object.assign(item, createFloorItemObject(), { kind });
  item.pos.x = x;
  item.pos.y = y;
}

function collectAll(world: World): void {
  for (let i = 0; i < 120 && world.floorItems.count > 0; i++) pickupSystem(world, FIXED_STEP);
}

describe('medkit', () => {
  it('drops only from elites and the boss', () => {
    expect(medkitDropChance(ENEMIES.client.xp)).toBe(0);
    expect(medkitDropChance(ENEMIES.delivery.xp)).toBe(0);
    expect(medkitDropChance(ENEMIES.frozen.xp)).toBeGreaterThan(0);
    expect(medkitDropChance(ENEMIES.frozen.xp)).toBeLessThan(0.1);
    expect(medkitDropChance(ENEMIES.manager.xp)).toBe(1);
  });

  it('the boss always drops one', () => {
    const world = emptyWorld();
    const boss = spawnEnemy(world, ENEMIES.manager, 400, 0);
    if (!boss) throw new Error('no boss');
    boss.hp = 0;
    deathSystem(world);
    const kinds = world.floorItems.items.slice(0, world.floorItems.count).map((i) => i.kind);
    expect(kinds).toContain('medkit');
  });

  it('heals 25 % of max hp, capped at max hp', () => {
    const world = emptyWorld();
    const p = world.player;
    p.hp = 10;
    placeItem(world, 'medkit', p.pickupRadius - 5, 0);
    collectAll(world);
    expect(world.floorItems.count).toBe(0);
    expect(p.hp).toBeCloseTo(10 + p.maxHp * FLOOR_ITEMS.medkit.healFraction);
    p.hp = p.maxHp - 3;
    placeItem(world, 'medkit', 0, 0);
    collectAll(world);
    expect(p.hp).toBe(p.maxHp);
  });

  it('stays on the floor while health is full', () => {
    const world = emptyWorld();
    const p = world.player;
    placeItem(world, 'medkit', 0, 0);
    for (let i = 0; i < 30; i++) pickupSystem(world, FIXED_STEP);
    expect(world.floorItems.count).toBe(1);
    p.hp = p.maxHp / 2;
    collectAll(world);
    expect(world.floorItems.count).toBe(0);
  });
});

describe('floor magnet', () => {
  it('pulls every coupon on the map, however far', () => {
    const world = emptyWorld();
    for (let i = 0; i < 20; i++) dropCoupon(world, 2000 + i * 50, -1500, 1);
    placeItem(world, 'magnet', 0, 0);
    pickupSystem(world, FIXED_STEP);
    expect(world.floorItems.count).toBe(0);
    for (let i = 0; i < world.coupons.count; i++) {
      expect(world.coupons.items[i]?.attracted).toBe(true);
    }
    for (let i = 0; i < 60 * 10 && world.coupons.count > 0; i++) pickupSystem(world, FIXED_STEP);
    expect(world.coupons.count).toBe(0);
  });

  it('is very rare and the rolls are deterministic', () => {
    const count = (seed: number): number[] => {
      const world = emptyWorld(seed);
      const tally = [0, 0];
      for (let i = 0; i < 20000; i++) {
        maybeDropFloorItems(world, 0, 0, ENEMIES.client.xp);
        for (let k = 0; k < world.floorItems.count; k++) {
          const slot = world.floorItems.items[k]?.kind === 'magnet' ? 1 : 0;
          tally[slot] = (tally[slot] ?? 0) + 1;
        }
        world.floorItems.clear();
      }
      return tally;
    };
    const tally = count(5);
    expect(count(5)).toEqual(tally);
    expect(tally[0]).toBe(0);
    const rate = (tally[1] ?? 0) / 20000;
    expect(rate).toBeGreaterThan(FLOOR_ITEMS.magnet.chance * 0.5);
    expect(rate).toBeLessThan(FLOOR_ITEMS.magnet.chance * 1.5);
  });

  it('a full pool drops nothing and does not throw', () => {
    const world = emptyWorld();
    for (let i = 0; i < FLOOR_ITEMS.capacity; i++) placeItem(world, 'magnet', 5000, 5000);
    expect(() => maybeDropFloorItems(world, 0, 0, ENEMIES.manager.xp)).not.toThrow();
    expect(world.floorItems.count).toBe(FLOOR_ITEMS.capacity);
  });
});
