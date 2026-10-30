import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { setVec } from '../src/core/math';
import { AMMO, PISTOL_MODS, WEAPONS, type GunLevel } from '../src/data/weapons';
import {
  addAmmo,
  addManualWeapon,
  addPistolMod,
  applyPistolMods,
  createManualState,
  cycleManual,
  entryOf,
  gunStats,
  hasAmmo,
  isReloading,
  manualWeaponSystem,
  maxReserve,
  meleeStats,
  selectManual,
  selectManualByKey,
  startReload,
} from '../src/game/manual';
import { pickupSystem } from '../src/game/pickups';
import { projectileSystem } from '../src/game/projectiles';
import { spatialIndexSystem } from '../src/game/systems/collision';
import { statusSystem } from '../src/game/systems/status';
import type { World } from '../src/game/world';
import { addClient, emptyWorld, pistolOf, shotgunOf } from './helpers';

const gunDef = WEAPONS.labelGun;
if (gunDef.behavior !== 'gun') throw new Error('labelGun must be a gun');
const L1 = gunDef.levels[0] as GunLevel;
const shotgunDef = WEAPONS.shotgun;
if (shotgunDef.behavior !== 'gun') throw new Error('shotgun must be a gun');
const S1 = shotgunDef.levels[0] as GunLevel;

/** World aiming right with the trigger held. */
function aiming(): World {
  const world = emptyWorld();
  world.aimActive = true;
  setVec(world.aim, 1, 0);
  world.triggerHeld = true;
  return world;
}

/** Same, with the shotgun owned and in hand. */
function withShotgun(): World {
  const world = aiming();
  addManualWeapon(world.player.manual, 'shotgun');
  selectManual(world.player.manual, 'shotgun');
  return world;
}

function run(world: World, seconds: number): void {
  const steps = Math.round(seconds / FIXED_STEP);
  for (let i = 0; i < steps; i++) {
    spatialIndexSystem(world);
    manualWeaponSystem(world, FIXED_STEP);
    projectileSystem(world, FIXED_STEP);
    statusSystem(world, FIXED_STEP);
    world.time += FIXED_STEP;
  }
}

describe('starting state', () => {
  it('starts with the pistol in hand, a full magazine, the starting reserve, and the broom', () => {
    const m = createManualState();
    expect(m.active).toBe('labelGun');
    expect(m.owned.map((e) => e.weapon.def.id)).toEqual(['labelGun', 'broom']);
    const pistol = entryOf(m, 'labelGun');
    expect(pistol?.mag).toBe(L1.magazine);
    expect(pistol?.reserve).toBe(gunDef.ammo.startReserve);
    expect(m.mods).toEqual([]);
  });

  it('a new manual weapon joins in cycle order with a full magazine and its starting reserve', () => {
    const m = createManualState();
    expect(addManualWeapon(m, 'shotgun')).toBe(true);
    expect(addManualWeapon(m, 'shotgun')).toBe(false);
    expect(m.owned.map((e) => e.weapon.def.id)).toEqual(['labelGun', 'shotgun', 'broom']);
    const sg = entryOf(m, 'shotgun');
    expect(sg?.mag).toBe(S1.magazine);
    expect(sg?.reserve).toBe(shotgunDef.ammo.startReserve);
  });
});

describe('firing', () => {
  it('spends one round per shot and respects the fire interval', () => {
    const world = aiming();
    const pistol = pistolOf(world);
    run(world, FIXED_STEP);
    expect(pistol.mag).toBe(L1.magazine - 1);
    expect(world.projectiles.count).toBe(1);
    // In 1 s at most 1 + 1 / cooldown shots, and never more than the magazine.
    run(world, 1);
    const shots = L1.magazine - pistol.mag;
    expect(shots).toBeLessThanOrEqual(Math.min(L1.magazine, 1 + Math.floor(1 / L1.cooldown) + 1));
    expect(shots).toBeGreaterThanOrEqual(Math.min(L1.magazine, Math.floor(1 / L1.cooldown)));
  });

  it('does not fire without the trigger', () => {
    const world = aiming();
    world.triggerHeld = false;
    run(world, 1);
    expect(pistolOf(world).mag).toBe(L1.magazine);
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
    const used = (w: World) => L1.magazine - pistolOf(w).mag;
    expect(used(fast)).toBeGreaterThan(used(slow));
  });
});

describe('shotgun', () => {
  it('fires 5 pellets in a ±15° cone per shell', () => {
    const world = withShotgun();
    run(world, FIXED_STEP);
    expect(shotgunOf(world).mag).toBe(S1.magazine - 1);
    expect(world.projectiles.count).toBe(5);
    const angles: number[] = [];
    for (let i = 0; i < world.projectiles.count; i++) {
      const p = world.projectiles.items[i];
      if (p) angles.push((Math.atan2(p.vel.y, p.vel.x) * 180) / Math.PI);
    }
    expect(Math.max(...angles)).toBeCloseTo(15);
    expect(Math.min(...angles)).toBeCloseTo(-15);
    for (let i = 0; i < world.projectiles.count; i++) {
      expect(world.projectiles.items[i]?.damage).toBe(S1.damage);
    }
  });

  it('has an effective reach of about 220 px', () => {
    expect(S1.speed * S1.lifetime).toBeGreaterThan(200);
    expect(S1.speed * S1.lifetime).toBeLessThan(240);
    const world = withShotgun();
    const near = addClient(world, 180, 0);
    const far = addClient(world, 300, 0);
    run(world, FIXED_STEP);
    world.triggerHeld = false;
    run(world, 1);
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(far.hp).toBe(far.maxHp);
  });

  it('fires every 0.9 s, holds 6 shells, reloads in 2 s and caps its reserve at 36', () => {
    expect(S1.cooldown).toBe(0.9);
    expect(S1.magazine).toBe(6);
    expect(S1.reloadTime).toBe(2);
    expect(maxReserve('shotgun')).toBe(36);
    const world = withShotgun();
    run(world, 1.9);
    // Shots at 0, 0.9 and 1.8 s.
    expect(shotgunOf(world).mag).toBe(S1.magazine - 3);
    addAmmo(world.player, 'shotgun', 10_000);
    expect(shotgunOf(world).reserve).toBe(36);
  });

  it('its ammo is separate from the pistol and reloads on its own', () => {
    const world = withShotgun();
    const sg = shotgunOf(world);
    const pistol = pistolOf(world);
    sg.mag = 1;
    sg.reserve = 4;
    run(world, 0.1);
    expect(isReloading(world.player.manual)).toBe(true);
    world.triggerHeld = false;
    run(world, S1.reloadTime + 0.05);
    expect(sg.mag).toBe(4);
    expect(sg.reserve).toBe(0);
    expect(pistol.mag).toBe(L1.magazine);
    expect(pistol.reserve).toBe(gunDef.ammo.startReserve);
  });

  it('pushes zombies back hard', () => {
    const world = withShotgun();
    const e = addClient(world, 60, 0);
    e.hp = e.maxHp = 1000;
    // Pellets cover the 60 px in a few steps; nothing decays the knockback in this harness.
    run(world, FIXED_STEP * 8);
    expect(e.hp).toBeLessThan(1000);
    expect(e.knockback.x).toBeGreaterThan(S1.knockback * 0.5);
  });
});

describe('reloading', () => {
  it('reloads by itself when the magazine runs dry, moving min(missing, reserve)', () => {
    const world = aiming();
    const m = world.player.manual;
    const pistol = pistolOf(world);
    pistol.mag = 1;
    pistol.reserve = 5;
    run(world, 0.1);
    expect(pistol.mag).toBe(0);
    expect(isReloading(m)).toBe(true);
    world.triggerHeld = false;
    run(world, L1.reloadTime + 0.05);
    expect(isReloading(m)).toBe(false);
    expect(pistol.mag).toBe(5);
    expect(pistol.reserve).toBe(0);
  });

  it('cannot fire while reloading', () => {
    const world = aiming();
    const m = world.player.manual;
    const pistol = pistolOf(world);
    pistol.mag = 3;
    world.triggerHeld = false;
    world.reloadRequested = true;
    run(world, FIXED_STEP);
    expect(isReloading(m)).toBe(true);
    world.triggerHeld = true;
    run(world, L1.reloadTime * 0.5);
    expect(pistol.mag).toBe(3);
    expect(world.projectiles.count).toBe(0);
    run(world, L1.reloadTime);
    expect(pistol.mag).toBeLessThan(L1.magazine);
    expect(world.projectiles.count).toBeGreaterThan(0);
  });

  it('R does nothing with a full magazine or an empty reserve', () => {
    const m = createManualState();
    const pistol = entryOf(m, 'labelGun');
    if (!pistol) throw new Error('no pistol');
    expect(startReload(m)).toBe(false);
    pistol.mag = 2;
    pistol.reserve = 0;
    expect(startReload(m)).toBe(false);
    pistol.reserve = 10;
    expect(startReload(m)).toBe(true);
    expect(startReload(m)).toBe(false); // already reloading
  });

  it('switching weapons cancels the reload', () => {
    const m = createManualState();
    const pistol = entryOf(m, 'labelGun');
    if (!pistol) throw new Error('no pistol');
    pistol.mag = 0;
    startReload(m);
    expect(cycleManual(m)).toBe(true);
    expect(m.active).toBe('broom');
    expect(isReloading(m)).toBe(false);
    expect(pistol.mag).toBe(0);
  });
});

describe('weapon switching', () => {
  it('falls back to the broom at 0/0 and returns to the gun when picking up ammo', () => {
    const world = aiming();
    const m = world.player.manual;
    const pistol = pistolOf(world);
    pistol.mag = 1;
    pistol.reserve = 0;
    run(world, 0.2);
    expect(m.active).toBe('broom');
    expect(m.autoSwitched).toBe(true);
    addAmmo(world.player, 'labelGun', 15);
    expect(m.active).toBe('labelGun');
    expect(m.autoSwitched).toBe(false);
    // Empty magazine + new reserve: it reloads right away.
    expect(isReloading(m)).toBe(true);
    world.triggerHeld = false;
    run(world, L1.reloadTime + 0.05);
    expect(pistol.mag).toBe(Math.min(15, L1.magazine));
  });

  it('a manual switch to the broom is kept when picking up ammo', () => {
    const world = aiming();
    const m = world.player.manual;
    cycleManual(m);
    expect(m.active).toBe('broom');
    addAmmo(world.player, 'labelGun', 15);
    expect(m.active).toBe('broom');
  });

  it('Q cycles through the owned weapons and skips guns with no rounds at all', () => {
    const m = createManualState();
    expect(cycleManual(m)).toBe(true);
    expect(m.active).toBe('broom');
    expect(cycleManual(m)).toBe(true);
    expect(m.active).toBe('labelGun');
    addManualWeapon(m, 'shotgun');
    const order: string[] = [];
    for (let i = 0; i < 3; i++) {
      cycleManual(m);
      order.push(m.active);
    }
    expect(order).toEqual(['shotgun', 'broom', 'labelGun']);
    const pistol = entryOf(m, 'labelGun');
    if (!pistol) throw new Error('no pistol');
    pistol.mag = pistol.reserve = 0;
    selectManual(m, 'broom');
    expect(cycleManual(m)).toBe(true);
    expect(m.active).toBe('shotgun');
    const sg = entryOf(m, 'shotgun');
    if (!sg) throw new Error('no shotgun');
    sg.mag = sg.reserve = 0;
    expect(cycleManual(m)).toBe(true);
    expect(m.active).toBe('broom');
    expect(hasAmmo(m, 'labelGun')).toBe(false);
    expect(cycleManual(m)).toBe(false);
  });

  it('keys 1 / 2 / 3 pick the pistol, the broom and the shotgun', () => {
    const m = createManualState();
    expect(selectManualByKey(m, 2)).toBe(true);
    expect(m.active).toBe('broom');
    // Not owned yet, or already in hand: nothing happens.
    expect(selectManualByKey(m, 3)).toBe(false);
    expect(selectManualByKey(m, 2)).toBe(false);
    expect(selectManualByKey(m, 1)).toBe(true);
    expect(m.active).toBe('labelGun');
    addManualWeapon(m, 'shotgun');
    expect(selectManualByKey(m, 3)).toBe(true);
    expect(m.active).toBe('shotgun');
    // A dry gun can't be picked.
    const pistol = entryOf(m, 'labelGun');
    if (!pistol) throw new Error('no pistol');
    pistol.mag = pistol.reserve = 0;
    expect(selectManualByKey(m, 1)).toBe(false);
    expect(m.active).toBe('shotgun');
    expect(selectManualByKey(m, 7)).toBe(false);
  });

  it('a number key from the host is consumed once and emits weaponSwap', () => {
    const world = aiming();
    world.triggerHeld = false;
    world.selectRequested = 2;
    run(world, FIXED_STEP);
    expect(world.player.manual.active).toBe('broom');
    expect(world.selectRequested).toBe(0);
    expect(world.events.items.slice(0, world.events.count).map((e) => e.type)).toContain(
      'weaponSwap',
    );
  });

  it('a dry pistol hands over to the shotgun, then the broom, and ammo brings them back', () => {
    const world = aiming();
    const m = world.player.manual;
    addManualWeapon(m, 'shotgun');
    const pistol = pistolOf(world);
    const sg = shotgunOf(world);
    pistol.mag = 1;
    pistol.reserve = 0;
    run(world, 0.1);
    expect(m.active).toBe('shotgun');
    expect(m.autoSwitched).toBe(true);
    sg.mag = 1;
    sg.reserve = 0;
    run(world, 1);
    expect(m.active).toBe('broom');
    expect(m.autoSwitched).toBe(true);
    // Shells first: back to the shotgun (it comes before the broom).
    expect(addAmmo(world.player, 'shotgun', AMMO.shellAmount)).toBe(true);
    expect(m.active).toBe('shotgun');
    expect(m.autoSwitched).toBe(false);
    // The shotgun was picked automatically before? No longer: a pistol box doesn't move it.
    expect(addAmmo(world.player, 'labelGun', AMMO.boxAmount)).toBe(false);
    expect(m.active).toBe('shotgun');
  });

  it('pistol rounds bring the pistol back over an automatic shotgun', () => {
    const world = aiming();
    const m = world.player.manual;
    addManualWeapon(m, 'shotgun');
    const pistol = pistolOf(world);
    pistol.mag = 1;
    pistol.reserve = 0;
    run(world, 0.1);
    expect(m.active).toBe('shotgun');
    expect(addAmmo(world.player, 'labelGun', AMMO.boxAmount)).toBe(true);
    expect(m.active).toBe('labelGun');
  });

  it('shell boxes only fill the shotgun and are collected like ammo boxes', () => {
    const world = withShotgun();
    const sg = shotgunOf(world);
    sg.reserve = 0;
    const box = world.shellBoxes.acquire();
    if (!box) throw new Error('no box');
    setVec(box.pos, world.player.pos.x, world.player.pos.y);
    box.attracted = false;
    box.speed = 0;
    const pistolBefore = pistolOf(world).reserve;
    pickupSystem(world, FIXED_STEP);
    expect(world.shellBoxes.count).toBe(0);
    expect(sg.reserve).toBe(AMMO.shellAmount);
    expect(pistolOf(world).reserve).toBe(pistolBefore);
  });

  it('the broom swings toward the aim, not toward the movement', () => {
    const world = aiming();
    selectManual(world.player.manual, 'broom');
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
  it('reserve is capped per gun', () => {
    const world = emptyWorld();
    addAmmo(world.player, 'labelGun', 10_000);
    expect(pistolOf(world).reserve).toBe(maxReserve('labelGun'));
    // Shells for a shotgun you don't have are ignored.
    expect(addAmmo(world.player, 'shotgun', 6)).toBe(false);
    expect(entryOf(world.player.manual, 'shotgun')).toBeUndefined();
  });

  it('a bigger magazine from a level-up fills on the next reload', () => {
    const world = aiming();
    const m = world.player.manual;
    const pistol = pistolOf(world);
    pistol.weapon.level = 3;
    pistol.mag = 0;
    world.triggerHeld = false;
    run(world, gunStats(m).reloadTime + 0.1);
    expect(pistol.mag).toBe(gunStats(m).magazine);
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

describe('pistol mods', () => {
  it('can be added once each, at most two per run', () => {
    const m = createManualState();
    expect(addPistolMod(m, 'piercing')).toBe(true);
    expect(addPistolMod(m, 'piercing')).toBe(false);
    expect(addPistolMod(m, 'incendiary')).toBe(true);
    expect(addPistolMod(m, 'ricochet')).toBe(false);
    expect(m.mods).toEqual(['piercing', 'incendiary']);
  });

  it('change only the pistol stats', () => {
    const m = createManualState();
    addManualWeapon(m, 'shotgun');
    addPistolMod(m, 'piercing');
    addPistolMod(m, 'extendedMag');
    expect(gunStats(m, 'labelGun').pierce).toBe(L1.pierce + 1);
    expect(gunStats(m, 'labelGun').magazine).toBe(Math.round(L1.magazine * 1.5));
    expect(gunStats(m, 'shotgun')).toBe(S1);
    // The base level table is untouched.
    expect(L1.pierce).toBe(0);
    expect(applyPistolMods(L1, ['ricochet']).bounces).toBe(PISTOL_MODS.ricochet.bounces);
  });

  it('piercing labels go through one more zombie', () => {
    const world = aiming();
    addPistolMod(world.player.manual, 'piercing');
    const a = addClient(world, 60, 0);
    const b = addClient(world, 100, 0);
    a.hp = a.maxHp = b.hp = b.maxHp = 1000;
    run(world, FIXED_STEP * 12);
    expect(a.hp).toBeLessThan(1000);
    expect(b.hp).toBeLessThan(1000);
  });

  it('incendiary labels set zombies on fire through the poison status', () => {
    const world = aiming();
    addPistolMod(world.player.manual, 'incendiary');
    const e = addClient(world, 60, 0);
    e.hp = e.maxHp = 1000;
    run(world, FIXED_STEP * 6);
    world.triggerHeld = false;
    expect(e.poisonTimer).toBeGreaterThan(0);
    expect(e.poisonDps).toBe(PISTOL_MODS.incendiary.burnDps);
    const before = e.hp;
    run(world, 1);
    expect(before - e.hp).toBeCloseTo(PISTOL_MODS.incendiary.burnDps ?? 0, 0);
  });

  it('ricochet labels jump to the nearest zombie they have not hit', () => {
    const world = aiming();
    addPistolMod(world.player.manual, 'ricochet');
    const first = addClient(world, 60, 0);
    const second = addClient(world, 60, 120);
    first.hp = first.maxHp = second.hp = second.maxHp = 1000;
    run(world, FIXED_STEP);
    world.triggerHeld = false;
    run(world, 0.6);
    expect(first.hp).toBe(1000 - L1.damage);
    expect(second.hp).toBe(1000 - L1.damage);
  });

  it('without the mod a label stops at the first zombie', () => {
    const world = aiming();
    const first = addClient(world, 60, 0);
    const second = addClient(world, 60, 120);
    first.hp = first.maxHp = second.hp = second.maxHp = 1000;
    run(world, FIXED_STEP);
    world.triggerHeld = false;
    run(world, 0.6);
    expect(first.hp).toBe(1000 - L1.damage);
    expect(second.hp).toBe(1000);
  });
});
