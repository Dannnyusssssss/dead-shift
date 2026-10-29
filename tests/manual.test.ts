import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { setVec } from '../src/core/math';
import { WEAPONS } from '../src/data/weapons';
import {
  addAmmo,
  createManualState,
  gunStats,
  hasAmmo,
  isReloading,
  manualWeaponSystem,
  maxReserve,
  meleeStats,
  selectManual,
  startReload,
  swapManual,
} from '../src/game/manual';
import { projectileSystem } from '../src/game/projectiles';
import { spatialIndexSystem } from '../src/game/systems/collision';
import type { World } from '../src/game/world';
import { addClient, emptyWorld } from './helpers';

const gunDef = WEAPONS.labelGun;
if (gunDef.behavior !== 'gun') throw new Error('labelGun must be a gun');
const L1 = gunDef.levels[0];
if (!L1) throw new Error('gun level 1 missing');

/** World aiming right with the trigger held. */
function aiming(): World {
  const world = emptyWorld();
  world.aimActive = true;
  setVec(world.aim, 1, 0);
  world.triggerHeld = true;
  return world;
}

function run(world: World, seconds: number): void {
  const steps = Math.round(seconds / FIXED_STEP);
  for (let i = 0; i < steps; i++) {
    spatialIndexSystem(world);
    manualWeaponSystem(world, FIXED_STEP);
    projectileSystem(world, FIXED_STEP);
    world.time += FIXED_STEP;
  }
}

describe('starting state', () => {
  it('starts with the gun active, a full magazine and the starting reserve', () => {
    const m = createManualState();
    expect(m.active).toBe('gun');
    expect(m.mag).toBe(L1.magazine);
    expect(m.reserve).toBe(gunDef.ammo.startReserve);
    expect(m.gun.def.id).toBe('labelGun');
    expect(m.melee.def.id).toBe('broom');
  });
});

describe('firing', () => {
  it('spends one round per shot and respects the fire interval', () => {
    const world = aiming();
    run(world, FIXED_STEP);
    expect(world.player.manual.mag).toBe(L1.magazine - 1);
    expect(world.projectiles.count).toBe(1);
    // In 1 s at most 1 + 1 / cooldown shots, and never more than the magazine.
    run(world, 1);
    const shots = L1.magazine - world.player.manual.mag;
    expect(shots).toBeLessThanOrEqual(Math.min(L1.magazine, 1 + Math.floor(1 / L1.cooldown) + 1));
    expect(shots).toBeGreaterThanOrEqual(Math.min(L1.magazine, Math.floor(1 / L1.cooldown)));
  });

  it('does not fire without the trigger', () => {
    const world = aiming();
    world.triggerHeld = false;
    run(world, 1);
    expect(world.player.manual.mag).toBe(L1.magazine);
    expect(world.projectiles.count).toBe(0);
  });

  it('shoots toward the aim, not toward the movement', () => {
    const world = aiming();
    setVec(world.aim, 0, -1);
    world.moveInput.x = 1;
    run(world, FIXED_STEP);
    const p = world.projectiles.items[0];
    expect(p?.vel.y).toBeLessThan(0);
    expect(Math.abs(p?.vel.x ?? 1)).toBeLessThan(1e-6);
    // The character turns to face the aim.
    expect(world.player.facing).toEqual({ x: 0, y: -1 });
  });

  it('hurts zombies with gun damage times the damage modifier', () => {
    const world = aiming();
    world.player.mods.damage = 2;
    const e = addClient(world, 120, 0);
    e.hp = e.maxHp = 1000;
    run(world, 0.3);
    expect((1000 - e.hp) % (L1.damage * 2)).toBe(0);
    expect(e.hp).toBeLessThan(1000);
  });

  it('Café makes it fire faster', () => {
    const slow = aiming();
    const fast = aiming();
    fast.player.mods.cooldown = 0.5;
    run(slow, 1);
    run(fast, 1);
    const used = (w: World) => L1.magazine - w.player.manual.mag;
    expect(used(fast)).toBeGreaterThan(used(slow));
  });
});

describe('reloading', () => {
  it('reloads by itself when the magazine runs dry, moving min(missing, reserve)', () => {
    const world = aiming();
    const m = world.player.manual;
    m.mag = 1;
    m.reserve = 5;
    run(world, 0.1);
    expect(m.mag).toBe(0);
    expect(isReloading(m)).toBe(true);
    world.triggerHeld = false;
    run(world, L1.reloadTime + 0.05);
    expect(isReloading(m)).toBe(false);
    expect(m.mag).toBe(5);
    expect(m.reserve).toBe(0);
  });

  it('cannot fire while reloading', () => {
    const world = aiming();
    const m = world.player.manual;
    m.mag = 3;
    world.triggerHeld = false;
    world.reloadRequested = true;
    run(world, FIXED_STEP);
    expect(isReloading(m)).toBe(true);
    world.triggerHeld = true;
    run(world, L1.reloadTime * 0.5);
    expect(m.mag).toBe(3);
    expect(world.projectiles.count).toBe(0);
    run(world, L1.reloadTime);
    expect(m.mag).toBeLessThan(L1.magazine);
    expect(world.projectiles.count).toBeGreaterThan(0);
  });

  it('R does nothing with a full magazine or an empty reserve', () => {
    const m = createManualState();
    expect(startReload(m)).toBe(false);
    m.mag = 2;
    m.reserve = 0;
    expect(startReload(m)).toBe(false);
    m.reserve = 10;
    expect(startReload(m)).toBe(true);
    expect(startReload(m)).toBe(false); // already reloading
  });

  it('switching weapons cancels the reload', () => {
    const m = createManualState();
    m.mag = 0;
    startReload(m);
    expect(swapManual(m)).toBe(true);
    expect(m.active).toBe('melee');
    expect(isReloading(m)).toBe(false);
    expect(m.mag).toBe(0);
  });
});

describe('weapon switching', () => {
  it('falls back to the broom at 0/0 and returns to the gun when picking up ammo', () => {
    const world = aiming();
    const m = world.player.manual;
    m.mag = 1;
    m.reserve = 0;
    run(world, 0.2);
    expect(m.active).toBe('melee');
    expect(m.autoSwitched).toBe(true);
    addAmmo(world.player, 15);
    expect(m.active).toBe('gun');
    expect(m.autoSwitched).toBe(false);
    // Empty magazine + new reserve: it reloads right away.
    expect(isReloading(m)).toBe(true);
    world.triggerHeld = false;
    run(world, L1.reloadTime + 0.05);
    expect(m.mag).toBe(Math.min(15, L1.magazine));
  });

  it('a manual switch to the broom is kept when picking up ammo', () => {
    const world = aiming();
    const m = world.player.manual;
    swapManual(m);
    expect(m.active).toBe('melee');
    addAmmo(world.player, 15);
    expect(m.active).toBe('melee');
  });

  it('Q toggles between weapons but refuses the gun with no rounds at all', () => {
    const m = createManualState();
    expect(swapManual(m)).toBe(true);
    expect(m.active).toBe('melee');
    expect(swapManual(m)).toBe(true);
    expect(m.active).toBe('gun');
    selectManual(m, 'melee');
    m.mag = 0;
    m.reserve = 0;
    expect(hasAmmo(m)).toBe(false);
    expect(swapManual(m)).toBe(false);
    expect(m.active).toBe('melee');
  });

  it('swap and reload requests from the host are consumed once', () => {
    const world = aiming();
    world.triggerHeld = false;
    world.swapRequested = true;
    run(world, FIXED_STEP);
    expect(world.player.manual.active).toBe('melee');
    expect(world.swapRequested).toBe(false);
    run(world, FIXED_STEP);
    expect(world.player.manual.active).toBe('melee');
  });

  it('the broom swings toward the aim, not toward the movement', () => {
    const world = aiming();
    selectManual(world.player.manual, 'melee');
    setVec(world.aim, -1, 0);
    world.moveInput.x = 1;
    const behindMovement = addClient(world, -40, 0);
    const ahead = addClient(world, 40, 0);
    run(world, FIXED_STEP);
    expect(behindMovement.hp).toBeLessThan(behindMovement.maxHp);
    expect(ahead.hp).toBe(ahead.maxHp);
    expect(meleeStats(world.player.manual).damage).toBeGreaterThan(0);
  });
});

describe('ammo', () => {
  it('reserve is capped', () => {
    const world = emptyWorld();
    addAmmo(world.player, 10_000);
    expect(world.player.manual.reserve).toBe(maxReserve());
  });

  it('a bigger magazine from a level-up fills on the next reload', () => {
    const world = aiming();
    const m = world.player.manual;
    m.gun.level = 3;
    m.mag = 0;
    world.triggerHeld = false;
    run(world, gunStats(m).reloadTime + 0.1);
    expect(m.mag).toBe(gunStats(m).magazine);
    expect(gunStats(m).magazine).toBeGreaterThan(L1.magazine);
  });

  it('keyboard-only play: the aim follows the movement direction', () => {
    const world = emptyWorld();
    world.aimActive = false;
    world.moveInput.y = 1;
    // Movement updates facing, then the manual system copies it into the aim.
    world.player.facing.x = 0;
    world.player.facing.y = 1;
    manualWeaponSystem(world, FIXED_STEP);
    expect(world.aim).toEqual({ x: 0, y: 1 });
  });
});
