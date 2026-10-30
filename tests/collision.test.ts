import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { setVec } from '../src/core/math';
import { ENEMIES } from '../src/data/enemies';
import { WEAPONS } from '../src/data/weapons';
import {
  contactDamageSystem,
  separationSystem,
  spatialIndexSystem,
} from '../src/game/systems/collision';
import { manualWeaponSystem, selectManual } from '../src/game/manual';
import { angleDiff } from '../src/game/weapons';
import type { World } from '../src/game/world';
import { addClient, emptyWorld } from './helpers';

const broomDef = WEAPONS.broom;
if (broomDef.behavior !== 'melee') throw new Error('broom must be a melee weapon');
const broom = broomDef.levels[0];
if (!broom) throw new Error('broom level 1 missing');

/** World with the broom in hand, aiming at (ax, ay), trigger held. */
function swinging(ax: number, ay: number): World {
  const world = emptyWorld();
  selectManual(world.player.manual, 'broom');
  world.aimActive = true;
  setVec(world.aim, ax, ay);
  world.triggerHeld = true;
  return world;
}

describe('broom (manual melee)', () => {
  it('hits enemies inside the arc toward the aim and ignores those behind or out of reach', () => {
    const world = swinging(1, 0);
    const front = addClient(world, 50, 0);
    const frontEdge = addClient(world, 40, 40); // 45°, inside the 110° arc
    const behind = addClient(world, -50, 0);
    const side = addClient(world, 0, 60); // 90°, outside
    const far = addClient(world, broom.range + 40, 0);
    spatialIndexSystem(world);
    manualWeaponSystem(world, FIXED_STEP);
    const full = ENEMIES.client.hp;
    expect(front.hp).toBe(full - broom.damage);
    expect(frontEdge.hp).toBe(full - broom.damage);
    expect(behind.hp).toBe(full);
    expect(side.hp).toBe(full);
    expect(far.hp).toBe(full);
  });

  it('pushes hit enemies away from the player', () => {
    const world = swinging(0, -1);
    const e = addClient(world, 0, -40);
    spatialIndexSystem(world);
    manualWeaponSystem(world, FIXED_STEP);
    expect(e.knockback.y).toBeLessThan(0);
    expect(Math.abs(e.knockback.x)).toBeLessThan(1e-6);
  });

  it('swings once per cooldown while the trigger is held, never without it', () => {
    const world = swinging(1, 0);
    const e = addClient(world, 30, 0);
    e.hp = 1000;
    spatialIndexSystem(world);
    const steps = Math.round(broom.cooldown / FIXED_STEP) * 3;
    for (let i = 0; i < steps; i++) manualWeaponSystem(world, FIXED_STEP);
    // Swings on the first step, then once per cooldown.
    const hits = (1000 - e.hp) / broom.damage;
    expect(hits).toBeGreaterThanOrEqual(3);
    expect(hits).toBeLessThanOrEqual(4);
    const before = e.hp;
    world.triggerHeld = false;
    for (let i = 0; i < steps; i++) manualWeaponSystem(world, FIXED_STEP);
    expect(e.hp).toBe(before);
  });

  it('angleDiff wraps around', () => {
    expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(-0.2);
    expect(angleDiff(0.1, -0.1)).toBeCloseTo(0.2);
  });
});

describe('contact damage', () => {
  it('hurts the player when a zombie touches, once per invulnerability window', () => {
    const world = emptyWorld();
    addClient(world, 10, 0);
    addClient(world, -10, 0);
    spatialIndexSystem(world);
    contactDamageSystem(world);
    expect(world.player.hp).toBe(world.player.maxHp - ENEMIES.client.damage);
    contactDamageSystem(world);
    expect(world.player.hp).toBe(world.player.maxHp - ENEMIES.client.damage);
    expect(world.events.items[0]?.type).toBe('playerHit');
  });

  it('does nothing when no zombie is touching', () => {
    const world = emptyWorld();
    addClient(world, 100, 0);
    spatialIndexSystem(world);
    contactDamageSystem(world);
    expect(world.player.hp).toBe(world.player.maxHp);
  });
});

describe('separation', () => {
  it('pushes overlapping zombies apart, including perfectly stacked ones', () => {
    const world = emptyWorld();
    const a = addClient(world, 500, 500);
    const b = addClient(world, 505, 500);
    const c = addClient(world, 800, 800);
    const d = addClient(world, 800, 800);
    const gap = () => Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y);
    const before = gap();
    for (let i = 0; i < 30; i++) {
      spatialIndexSystem(world);
      separationSystem(world);
    }
    expect(gap()).toBeGreaterThan(before);
    expect(gap()).toBeGreaterThanOrEqual(a.radius + b.radius - 0.5);
    expect(Math.hypot(d.pos.x - c.pos.x, d.pos.y - c.pos.y)).toBeGreaterThan(0);
  });
});
