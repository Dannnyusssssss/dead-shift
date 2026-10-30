import { PROGRESSION } from '../data/progression';
import { MANUAL_ORDER, WEAPON_IDS, WEAPONS, isManual } from '../data/weapons';
import { addManualWeapon, entryOf, gunDefOf, gunStats, isGun, maxReserve } from './manual';
import { createWeapon } from './weapons';
import type { World } from './world';

/**
 * Debug `?weapons=all`: every automatic weapon and every manual one (the shotgun included) at
 * max level, guns with a full magazine and reserve. Ignores the automatic slot limit.
 */
export function giveAllWeapons(world: World): void {
  const p = world.player;
  p.weapons = WEAPON_IDS.filter((id) => !isManual(WEAPONS[id])).map((id) => {
    const weapon = createWeapon(id);
    weapon.level = PROGRESSION.maxLevel;
    return weapon;
  });
  const m = p.manual;
  for (const id of MANUAL_ORDER) addManualWeapon(m, id);
  for (const e of m.owned) {
    e.weapon.level = PROGRESSION.maxLevel;
    if (!isGun(e)) continue;
    e.mag = gunStats(m, e.weapon.def.id).magazine;
    e.reserve = maxReserve(e.weapon.def.id);
  }
}

/** Debug `?ammo=N`: the pistol starts with an empty magazine and N rounds in reserve. */
export function setPistolAmmo(world: World, reserve: number): void {
  const e = entryOf(world.player.manual, 'labelGun');
  if (!e || !gunDefOf('labelGun')) return;
  e.mag = 0;
  e.reserve = Math.min(Math.max(0, reserve), maxReserve('labelGun'));
}
