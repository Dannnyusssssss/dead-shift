import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { setVec } from '../src/core/math';
import { AIM_ASSIST } from '../src/data/controls';
import { WEAPONS, type GunLevel } from '../src/data/weapons';
import { assistAim, assistRange, manualWeaponSystem, selectManual } from '../src/game/manual';
import { updateWorld, type World } from '../src/game/world';
import { addClient, emptyWorld } from './helpers';

const gunDef = WEAPONS.labelGun;
if (gunDef.behavior !== 'gun') throw new Error('labelGun must be a gun');
const L1 = gunDef.levels[0] as GunLevel;

/** World with the assist on, no mouse or stick aiming, Mati facing right. */
function assisted(): World {
  const world = emptyWorld();
  world.aimAssist = true;
  world.aimActive = false;
  setVec(world.player.facing, 1, 0);
  return world;
}

describe('assistRange', () => {
  it('is how far the pistol shots fly, capped by the search range', () => {
    const world = emptyWorld();
    expect(assistRange(world.player.manual)).toBe(
      Math.min(L1.speed * L1.lifetime, AIM_ASSIST.maxRange),
    );
  });
});

describe('aim assist', () => {
  it('aims the pistol at the nearest zombie in reach and turns Mati toward it', () => {
    const world = assisted();
    const p = world.player.pos;
    addClient(world, p.x, p.y - 200);
    addClient(world, p.x - 100, p.y);
    manualWeaponSystem(world, FIXED_STEP);
    expect(world.aim.x).toBeCloseTo(-1);
    expect(world.aim.y).toBeCloseTo(0);
    expect(world.player.facing.x).toBeCloseTo(-1);
    expect(world.aimAssistUsed).toBe(true);
  });

  it('wins over the mouse while a zombie is in reach, and gives it back otherwise', () => {
    const world = assisted();
    world.aimActive = true;
    setVec(world.aim, 0, 1);
    const p = world.player.pos;
    manualWeaponSystem(world, FIXED_STEP);
    expect(world.aim).toEqual({ x: 0, y: 1 });
    addClient(world, p.x - 100, p.y);
    manualWeaponSystem(world, FIXED_STEP);
    expect(world.aim.x).toBeCloseTo(-1);
  });

  it('ignores zombies out of reach and keeps aiming where Mati faces', () => {
    const world = assisted();
    const p = world.player.pos;
    addClient(world, p.x, p.y + assistRange(world.player.manual) + 50);
    expect(assistAim(world)).toBe(false);
    manualWeaponSystem(world, FIXED_STEP);
    expect(world.aim).toEqual({ x: 1, y: 0 });
    expect(world.aimAssistUsed).toBe(false);
  });

  it('does nothing for the Broom', () => {
    const world = assisted();
    selectManual(world.player.manual, 'broom');
    const p = world.player.pos;
    addClient(world, p.x, p.y + 50);
    manualWeaponSystem(world, FIXED_STEP);
    expect(world.aim).toEqual({ x: 1, y: 0 });
    expect(world.aimAssistUsed).toBe(false);
  });

  it('turned off by the host (stick aiming), the stick aim is used', () => {
    const world = assisted();
    world.aimAssist = false;
    world.aimActive = true;
    setVec(world.aim, 0, 1);
    const p = world.player.pos;
    addClient(world, p.x - 100, p.y);
    manualWeaponSystem(world, FIXED_STEP);
    expect(world.aim).toEqual({ x: 0, y: 1 });
    expect(world.aimAssistUsed).toBe(false);
  });

  it('off by default: a run plays exactly as before', () => {
    const a = emptyWorld(7);
    const b = emptyWorld(7);
    expect(a.aimAssist).toBe(false);
    for (let i = 0; i < 600; i++) {
      a.triggerHeld = b.triggerHeld = true;
      updateWorld(a, FIXED_STEP);
      updateWorld(b, FIXED_STEP);
    }
    expect(a.kills).toBe(b.kills);
    expect(a.player.pos).toEqual(b.player.pos);
  });

  it('assisted shots hit: kills come sooner than shooting where Mati faces', () => {
    const run = (assist: boolean): number => {
      const world = emptyWorld(3);
      world.aimAssist = assist;
      setVec(world.player.facing, 1, 0);
      for (let i = 0; i < 60 * 30; i++) {
        world.triggerHeld = true;
        world.reloadRequested = world.player.manual.reloadTimer === 0;
        updateWorld(world, FIXED_STEP);
        if (world.status !== 'playing') break;
      }
      return world.kills;
    };
    expect(run(true)).toBeGreaterThan(run(false));
  });
});
