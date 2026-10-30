import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { setVec } from '../src/core/math';
import { WEAPON_IDS, type WeaponId } from '../src/data/weapons';
import { projectileSystem } from '../src/game/projectiles';
import { spatialIndexSystem } from '../src/game/systems/collision';
import { statusSystem } from '../src/game/systems/status';
import { turretSystem } from '../src/game/turrets';
import { createWeapon, weaponSystem } from '../src/game/weapons';
import { manualWeaponSystem, selectManual } from '../src/game/manual';
import { deathSystem } from '../src/game/systems/death';
import type { World } from '../src/game/world';
import { addClient, emptyWorld } from './helpers';

function worldWith(id: WeaponId, level = 1): World {
  const world = emptyWorld();
  const w = createWeapon(id);
  w.level = level;
  world.player.weapons = [w];
  return world;
}

/** Runs the combat-relevant systems for `seconds`. */
function run(world: World, seconds: number): void {
  const steps = Math.round(seconds / FIXED_STEP);
  for (let i = 0; i < steps; i++) {
    statusSystem(world, FIXED_STEP);
    spatialIndexSystem(world);
    weaponSystem(world, FIXED_STEP);
    turretSystem(world, FIXED_STEP);
    projectileSystem(world, FIXED_STEP);
    world.time += FIXED_STEP;
  }
}

/** Huge hp so nothing dies and damage can be measured. */
function tank(world: World, x: number, y: number) {
  const e = addClient(world, x, y);
  e.hp = e.maxHp = 10_000;
  return e;
}

describe('Latas (projectile)', () => {
  it('waits for a target, then throws at the nearest enemy', () => {
    const world = worldWith('cans');
    run(world, 0.2);
    expect(world.projectiles.count).toBe(0);
    const near = tank(world, 0, 150);
    const far = tank(world, 400, 0);
    run(world, 0.6);
    expect(near.hp).toBeLessThan(10_000);
    expect(far.hp).toBe(10_000);
  });

  it('pierces at level 4 (one shot hits two enemies in a line)', () => {
    const world = worldWith('cans', 4);
    const a = tank(world, 100, 0);
    const b = tank(world, 140, 0);
    run(world, 0.5);
    expect(a.hp).toBeLessThan(10_000);
    expect(b.hp).toBeLessThan(10_000);
  });

  it('does not pierce at level 1', () => {
    const world = worldWith('cans', 1);
    const a = tank(world, 100, 0);
    const b = tank(world, 135, 0);
    run(world, 0.5);
    expect(10_000 - a.hp).toBe(8);
    expect(b.hp).toBe(10_000);
  });
});

describe('Bolsas de hielo (orbit)', () => {
  it('hits enemies on the ring, slows them, and respects the per-enemy interval', () => {
    const world = worldWith('ice');
    const e = tank(world, 70, 0);
    run(world, 0.05);
    expect(10_000 - e.hp).toBe(6);
    expect(e.slowTimer).toBeGreaterThan(0);
    // The bag is still overlapping, but the 0.5 s interval blocks extra hits.
    run(world, 0.2);
    expect(10_000 - e.hp).toBe(6);
  });

  it('does not touch enemies far from the orbit', () => {
    const world = worldWith('ice');
    const e = tank(world, 200, 0);
    run(world, 3);
    expect(e.hp).toBe(10_000);
  });
});

describe('Aerosol (cone)', () => {
  it('ticks damage inside the cone only while active', () => {
    const world = worldWith('aerosol');
    setVec(world.player.facing, 1, 0);
    const front = tank(world, 80, 0);
    const side = tank(world, 0, 80);
    run(world, 1.7);
    // 4 damage every 0.25 s for 1.5 s (6 ticks; a 7th can land on the boundary).
    expect([24, 28]).toContain(10_000 - front.hp);
    expect(side.hp).toBe(10_000);
    const afterCloud = front.hp;
    run(world, 2);
    expect(front.hp).toBe(afterCloud);
  });

  it('poisons at level 4', () => {
    const world = worldWith('aerosol', 4);
    const e = tank(world, 80, 0);
    run(world, 0.3);
    expect(e.poisonTimer).toBeGreaterThan(0);
    expect(e.poisonDps).toBe(3);
  });
});

describe('Microondas (turret)', () => {
  it('is placed, zaps the nearest enemies and expires', () => {
    const world = worldWith('microwave', 2);
    const a = tank(world, 100, 0);
    const b = tank(world, -120, 0);
    const out = tank(world, 400, 0);
    run(world, 0.1);
    expect(world.turrets.count).toBe(1);
    expect(a.hp).toBe(10_000 - 7);
    expect(b.hp).toBe(10_000 - 7);
    expect(out.hp).toBe(10_000);
    run(world, 8);
    expect(world.turrets.count).toBe(0);
  });

  it('places two units at level 5', () => {
    const world = worldWith('microwave', 5);
    run(world, FIXED_STEP);
    expect(world.turrets.count).toBe(2);
  });
});

describe('modifiers', () => {
  it('Calculadora multiplies automatic weapon damage', () => {
    const world = worldWith('cans');
    world.player.mods.damage = 1.5;
    const e = tank(world, 100, 0);
    run(world, 0.4);
    expect(10_000 - e.hp).toBe(12);
  });

  it('Café shortens automatic cooldowns', () => {
    const slow = worldWith('cans');
    const fast = worldWith('cans');
    fast.player.mods.cooldown = 0.5;
    const a = tank(slow, 100, 0);
    const b = tank(fast, 100, 0);
    run(slow, 3);
    run(fast, 3);
    expect(10_000 - b.hp).toBeGreaterThan((10_000 - a.hp) * 1.6);
  });

  it('ignores manual weapons (they are driven by manual.ts)', () => {
    const world = emptyWorld();
    world.player.weapons = [createWeapon('broom'), createWeapon('labelGun')];
    const e = tank(world, 40, 0);
    run(world, 2);
    expect(e.hp).toBe(10_000);
    expect(world.projectiles.count).toBe(0);
  });
});

it('every weapon id has a definition with 5 levels', () => {
  for (const id of WEAPON_IDS) expect(createWeapon(id).def.levels).toHaveLength(5);
});

describe('kills by weapon', () => {
  const idx = (id: WeaponId): number => WEAPON_IDS.indexOf(id);

  it('credits the weapon that landed the last hit', () => {
    const world = worldWith('cans');
    addClient(world, 80, 0).hp = 1;
    run(world, 2);
    deathSystem(world);
    expect(world.kills).toBe(1);
    expect(world.killsByWeapon[idx('cans')]).toBe(1);
    expect(world.killsByWeapon[idx('broom')]).toBe(0);
  });

  it('credits the manual gun and the broom', () => {
    const world = emptyWorld();
    world.aimActive = true;
    world.triggerHeld = true;
    addClient(world, 60, 0).hp = 1;
    for (let i = 0; i < 30 && world.kills === 0; i++) {
      spatialIndexSystem(world);
      manualWeaponSystem(world, FIXED_STEP);
      projectileSystem(world, FIXED_STEP);
      deathSystem(world);
    }
    expect(world.killsByWeapon[idx('labelGun')]).toBe(1);

    selectManual(world.player.manual, 'broom');
    addClient(world, 30, 0).hp = 1;
    spatialIndexSystem(world);
    manualWeaponSystem(world, FIXED_STEP);
    deathSystem(world);
    expect(world.killsByWeapon[idx('broom')]).toBe(1);
  });

  it('an enemy no weapon touched counts as a kill but for no weapon', () => {
    const world = emptyWorld();
    addClient(world, 300, 0).hp = 0;
    deathSystem(world);
    expect(world.kills).toBe(1);
    expect(Array.from(world.killsByWeapon).every((n) => n === 0)).toBe(true);
  });
});
