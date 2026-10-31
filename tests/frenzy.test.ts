import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { FRENZY } from '../src/data/shift';
import { WEAPONS } from '../src/data/weapons';
import { enemyMovementSystem } from '../src/game/enemies';
import { EVOLVED_LEVEL } from '../src/game/evolutions';
import { projectileSystem, spawnProjectile } from '../src/game/projectiles';
import {
  FRENZY_START,
  enemySpeedScale,
  frenzySystem,
  isFrenzy,
  shiftClock,
} from '../src/game/shift';
import { spatialIndexSystem } from '../src/game/systems/collision';
import { statsAt } from '../src/game/weapons';
import { updateWorld } from '../src/game/world';
import { addClient, emptyWorld } from './helpers';

describe('5 AM frenzy', () => {
  it('starts at 5:00 AM on the shift clock (minute 8:45)', () => {
    expect(FRENZY_START).toBe(525);
    expect(shiftClock(FRENZY_START)).toBe('5:00 AM');
    expect(isFrenzy(FRENZY_START - FIXED_STEP)).toBe(false);
    expect(isFrenzy(FRENZY_START)).toBe(true);
  });

  it('speeds the horde up and halves the slows', () => {
    expect(enemySpeedScale(0, false)).toBe(1);
    expect(enemySpeedScale(0.4, false)).toBeCloseTo(0.6);
    expect(enemySpeedScale(0, true)).toBeCloseTo(FRENZY.speedMultiplier);
    const slow = 0.4 * (1 - FRENZY.slowResist);
    expect(enemySpeedScale(0.4, true)).toBeCloseTo((1 - slow) * FRENZY.speedMultiplier);
    // The blizzard's freeze (slowFactor 1) no longer stops them dead.
    expect(enemySpeedScale(1, false)).toBe(0);
    expect(enemySpeedScale(1, true)).toBeGreaterThan(0);
  });

  it('turns on once, with one event', () => {
    const world = emptyWorld();
    world.time = FRENZY_START - 2 * FIXED_STEP;
    let events = 0;
    for (let i = 0; i < 10; i++) {
      frenzySystem(world);
      for (let k = 0; k < world.events.count; k++)
        if (world.events.items[k]?.type === 'frenzyStart') events++;
      world.events.clear();
      world.time += FIXED_STEP;
    }
    expect(world.frenzy).toBe(true);
    expect(events).toBe(1);
  });

  it('moves the zombies faster in the world', () => {
    const calm = emptyWorld();
    const angry = emptyWorld();
    angry.frenzy = true;
    const a = addClient(calm, 0, 300);
    const b = addClient(angry, 0, 300);
    a.vel.y = b.vel.y = -50;
    enemyMovementSystem(calm, 1);
    enemyMovementSystem(angry, 1);
    expect(300 - a.pos.y).toBeCloseTo(50);
    expect(300 - b.pos.y).toBeCloseTo(50 * FRENZY.speedMultiplier);
  });

  it('is part of the run from 5:00 AM on', () => {
    const world = emptyWorld();
    world.player.invincible = true;
    world.time = FRENZY_START - FIXED_STEP;
    updateWorld(world, FIXED_STEP);
    expect(world.frenzy).toBe(false);
    updateWorld(world, FIXED_STEP);
    expect(world.frenzy).toBe(true);
  });
});

describe('laser pistol falloff', () => {
  const labelDef = WEAPONS.labelGun;
  if (labelDef.behavior !== 'gun') throw new Error('unexpected pistol behavior');
  const LASER = statsAt(labelDef.levels, EVOLVED_LEVEL);
  const falloff = LASER.pierceFalloff ?? 0;

  it('each zombie pierced takes a smaller share of the shot', () => {
    expect(falloff).toBeGreaterThan(0);
    const world = emptyWorld();
    const row = Array.from({ length: 12 }, (_, i) => {
      const e = addClient(world, 60 + i * 30, 0);
      e.hp = e.maxHp = 10_000;
      return e;
    });
    spawnProjectile(world, 0, 0, 0, LASER, 'laser', 5);
    for (let i = 0; i < 40; i++) {
      spatialIndexSystem(world);
      projectileSystem(world, FIXED_STEP);
    }
    const dealt = row.map((e) => 10_000 - e.hp);
    expect(dealt[0]).toBeCloseTo(LASER.damage);
    for (let i = 1; i < dealt.length; i++)
      expect(dealt[i]).toBeCloseTo(LASER.damage * (1 - falloff) ** i);
  });

  it('other projectiles keep their full damage when they pierce', () => {
    const cans = WEAPONS.cans;
    if (cans.behavior !== 'projectile') throw new Error('unexpected cans behavior');
    const L5 = statsAt(cans.levels, 5);
    expect(L5.pierce).toBeGreaterThan(0);
    expect(L5.pierceFalloff ?? 0).toBe(0);
  });
});
