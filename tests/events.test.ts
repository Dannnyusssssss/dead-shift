import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { setVec } from '../src/core/math';
import { ENEMIES } from '../src/data/enemies';
import { WEAPONS } from '../src/data/weapons';
import { spawnEnemy } from '../src/game/enemies';
import type { GameEventType } from '../src/game/events';
import { cycleManual, manualWeaponSystem } from '../src/game/manual';
import { pickupSystem } from '../src/game/pickups';
import { addXp, progressionSystem } from '../src/game/progression';
import { projectileSystem } from '../src/game/projectiles';
import { spatialIndexSystem } from '../src/game/systems/collision';
import { hitEnemy } from '../src/game/systems/damage';
import { deathSystem } from '../src/game/systems/death';
import { statusSystem } from '../src/game/systems/status';
import type { World } from '../src/game/world';
import { addClient, emptyWorld, pistolOf } from './helpers';

const gunDef = WEAPONS.labelGun;
if (gunDef.behavior !== 'gun') throw new Error('labelGun must be a gun');
const L1 = gunDef.levels[0];
if (!L1) throw new Error('gun level 1 missing');

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

/** Event types currently queued, in order. */
function types(world: World): GameEventType[] {
  const out: GameEventType[] = [];
  for (let i = 0; i < world.events.count; i++) {
    const ev = world.events.items[i];
    if (ev) out.push(ev.type);
  }
  return out;
}

const count = (world: World, type: GameEventType): number =>
  types(world).filter((t) => t === type).length;

describe('manual weapon events', () => {
  it('each shot emits gunFire', () => {
    const world = aiming();
    run(world, L1.cooldown * 2.5);
    expect(count(world, 'gunFire')).toBe(L1.magazine - pistolOf(world).mag);
    expect(count(world, 'gunFire')).toBeGreaterThan(1);
  });

  it('the last round clicks (dryFire) and starts a reload, which then finishes', () => {
    const world = aiming();
    const m = pistolOf(world);
    m.mag = 1;
    run(world, 0.1);
    expect(types(world)).toEqual(['gunFire', 'dryFire', 'reloadStart']);
    world.events.clear();
    world.triggerHeld = false;
    run(world, L1.reloadTime + 0.05);
    expect(types(world)).toEqual(['reloadDone']);
  });

  it('pulling the trigger again while reloading clicks once per press', () => {
    const world = aiming();
    const m = pistolOf(world);
    m.mag = 0;
    run(world, 0.05);
    world.events.clear();
    world.triggerHeld = false;
    run(world, 0.05);
    world.triggerHeld = true;
    run(world, 0.2);
    expect(count(world, 'dryFire')).toBe(1);
  });

  it('R emits reloadStart only when a reload actually starts', () => {
    const world = emptyWorld();
    world.reloadRequested = true;
    manualWeaponSystem(world, FIXED_STEP);
    expect(count(world, 'reloadStart')).toBe(0); // full magazine
    pistolOf(world).mag = 3;
    world.reloadRequested = true;
    manualWeaponSystem(world, FIXED_STEP);
    expect(count(world, 'reloadStart')).toBe(1);
  });

  it('Q emits weaponSwap; a refused swap does not', () => {
    const world = emptyWorld();
    world.swapRequested = true;
    manualWeaponSystem(world, FIXED_STEP);
    expect(types(world)).toEqual(['weaponSwap']);
    world.events.clear();
    const m = pistolOf(world);
    m.mag = m.reserve = 0;
    world.swapRequested = true;
    manualWeaponSystem(world, FIXED_STEP);
    expect(count(world, 'weaponSwap')).toBe(0);
  });

  it('running dry switches to the broom with weaponSwap, and the broom swings with meleeSwing', () => {
    const world = aiming();
    const m = pistolOf(world);
    m.mag = 0;
    m.reserve = 0;
    run(world, 0.05);
    expect(world.player.manual.active).toBe('broom');
    expect(types(world)).toContain('weaponSwap');
    expect(types(world)).toContain('meleeSwing');
  });

  it('picking up ammo emits ammoPickup, plus weaponSwap and reloadStart after an automatic switch', () => {
    const world = aiming();
    const m = pistolOf(world);
    m.mag = m.reserve = 0;
    run(world, 0.05);
    world.events.clear();
    const box = world.ammoBoxes.acquire();
    if (!box) throw new Error('no box');
    setVec(box.pos, world.player.pos.x, world.player.pos.y);
    pickupSystem(world, FIXED_STEP);
    expect(types(world)).toEqual(['ammoPickup', 'weaponSwap', 'reloadStart']);
    expect(world.player.manual.active).toBe('labelGun');
  });

  it('picking up ammo with the broom chosen by hand only emits ammoPickup', () => {
    const world = emptyWorld();
    cycleManual(world.player.manual);
    const box = world.ammoBoxes.acquire();
    if (!box) throw new Error('no box');
    setVec(box.pos, world.player.pos.x, world.player.pos.y);
    pickupSystem(world, FIXED_STEP);
    expect(types(world)).toEqual(['ammoPickup']);
  });
});

describe('damage numbers', () => {
  it('every weapon hit is queued with its amount', () => {
    const world = emptyWorld();
    const e = addClient(world, 50, 0);
    hitEnemy(world, e, 7, 0, 0);
    expect(world.hits.count).toBe(1);
    expect(world.hits.items[0]?.amount).toBe(7);
  });

  it('bullets produce hits; poison ticks do not', () => {
    const world = aiming();
    const e = addClient(world, 40, 0);
    run(world, 0.2);
    expect(world.hits.count).toBeGreaterThan(0);
    world.hits.clear();
    e.poisonDps = 10;
    e.poisonTimer = 1;
    const hp = e.hp;
    statusSystem(world, 0.5);
    expect(e.hp).toBeLessThan(hp);
    expect(world.hits.count).toBe(0);
  });

  it('a full hit queue drops extra hits without throwing', () => {
    const world = emptyWorld();
    const e = addClient(world, 50, 0);
    for (let i = 0; i < world.hits.capacity + 10; i++) hitEnemy(world, e, 1, 0, 0);
    expect(world.hits.count).toBe(world.hits.capacity);
  });
});

describe('run events', () => {
  it('a dead boss emits bossDeath; a dead client does not', () => {
    const world = emptyWorld();
    const boss = spawnEnemy(world, ENEMIES.manager, 100, 0);
    const client = addClient(world, -100, 0);
    if (!boss) throw new Error('no boss');
    boss.hp = 0;
    client.hp = 0;
    deathSystem(world);
    expect(count(world, 'bossDeath')).toBe(1);
    expect(count(world, 'enemyDeath')).toBe(2);
  });

  it('a level-up emits levelUp once, even with several levels queued', () => {
    const world = emptyWorld();
    addXp(world.player, 500);
    expect(world.player.pendingLevelUps).toBeGreaterThan(1);
    progressionSystem(world);
    expect(world.status).toBe('levelup');
    expect(count(world, 'levelUp')).toBe(1);
  });
});
