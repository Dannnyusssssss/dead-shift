import { describe, expect, it } from 'vitest';
import { PROGRESSION } from '../src/data/progression';
import { MANUAL_ORDER, WEAPON_IDS, WEAPONS, isManual } from '../src/data/weapons';
import { giveAllWeapons, setPistolAmmo } from '../src/game/debug';
import { gunStats, maxReserve } from '../src/game/manual';
import { emptyWorld, pistolOf, shotgunOf } from './helpers';

describe('debug loadouts', () => {
  it('?weapons=all gives every weapon, the shotgun included, at max level and full ammo', () => {
    const world = emptyWorld();
    giveAllWeapons(world);
    const p = world.player;
    expect(p.weapons.map((w) => w.def.id)).toEqual(
      WEAPON_IDS.filter((id) => !isManual(WEAPONS[id])),
    );
    expect(p.manual.owned.map((e) => e.weapon.def.id)).toEqual([...MANUAL_ORDER]);
    for (const e of p.manual.owned) expect(e.weapon.level).toBe(PROGRESSION.maxLevel);
    const sg = shotgunOf(world);
    expect(sg.mag).toBe(gunStats(p.manual, 'shotgun').magazine);
    expect(sg.reserve).toBe(maxReserve('shotgun'));
    expect(pistolOf(world).reserve).toBe(maxReserve('labelGun'));
  });

  it('?ammo=N empties the pistol magazine and sets its reserve (capped)', () => {
    const world = emptyWorld();
    setPistolAmmo(world, 7);
    expect(pistolOf(world).mag).toBe(0);
    expect(pistolOf(world).reserve).toBe(7);
    setPistolAmmo(world, 10_000);
    expect(pistolOf(world).reserve).toBe(maxReserve('labelGun'));
  });
});
