import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { setVec } from '../src/core/math';
import { createRng } from '../src/core/rng';
import { EVOLUTIONS, EVOLUTION_RULES } from '../src/data/evolutions';
import { PROGRESSION } from '../src/data/progression';
import { PASSIVE_IDS, type PassiveId } from '../src/data/upgrades';
import { WEAPON_IDS, WEAPONS, type WeaponId } from '../src/data/weapons';
import {
  EVOLVED_LEVEL,
  evolveWeapon,
  isEvolved,
  readyEvolutions,
  recipeFor,
  recipeStatus,
  weaponIcon,
} from '../src/game/evolutions';
import {
  addManualWeapon,
  addPistolMod,
  entryOf,
  gunStats,
  manualWeaponSystem,
  selectManual,
} from '../src/game/manual';
import { addPassive, createPlayer, findOwnedWeapon, type Player } from '../src/game/player';
import {
  applyOffer,
  buildCandidates,
  rollChestOffers,
  rollOffers,
  type Offer,
} from '../src/game/progression';
import { projectileSystem, spawnProjectile } from '../src/game/projectiles';
import { spatialIndexSystem } from '../src/game/systems/collision';
import { chainLightning, createWeapon, statsAt, weaponSystem } from '../src/game/weapons';
import type { World } from '../src/game/world';
import { addClient, emptyWorld } from './helpers';

const labelDef = WEAPONS.labelGun;
const cansDef = WEAPONS.cans;
const iceDef = WEAPONS.ice;
if (labelDef.behavior !== 'gun' || cansDef.behavior !== 'projectile' || iceDef.behavior !== 'orbit')
  throw new Error('unexpected weapon behaviors');
const LASER = statsAt(labelDef.levels, EVOLVED_LEVEL);
const GRENADE = statsAt(cansDef.levels, EVOLVED_LEVEL);
const BLIZZARD = statsAt(iceDef.levels, EVOLVED_LEVEL);

const MAX = PROGRESSION.maxLevel;
const NEED = EVOLUTION_RULES.minPassiveLevel;

/** A player owning `weapon` at `weaponLevel` and its recipe passive at `passiveLevel` (0 = none). */
function playerWith(weapon: WeaponId, weaponLevel: number, passiveLevel: number): Player {
  const p = createPlayer();
  const owned = findOwnedWeapon(p, weapon);
  if (owned) owned.level = weaponLevel;
  else if (WEAPONS[weapon].behavior === 'gun') {
    addManualWeapon(p.manual, weapon);
    const e = entryOf(p.manual, weapon);
    if (e) e.weapon.level = weaponLevel;
  } else {
    const w = createWeapon(weapon);
    w.level = weaponLevel;
    p.weapons.push(w);
  }
  const passive = recipeFor(weapon)?.passive;
  if (passive && passiveLevel > 0) addPassive(p, passive).level = passiveLevel;
  return p;
}

const evolveOffer = (weaponId: WeaponId): Offer => ({ kind: 'evolveWeapon', weaponId });

/** Huge hp so nothing dies and damage can be measured. */
function tank(world: World, x: number, y: number) {
  const e = addClient(world, x, y);
  e.hp = e.maxHp = 10_000;
  return e;
}

describe('recipes (data)', () => {
  it('one recipe per weapon, each with a valid passive; the vest is shared by two', () => {
    expect(EVOLUTIONS).toHaveLength(WEAPON_IDS.length);
    expect(new Set(EVOLUTIONS.map((e) => e.weapon)).size).toBe(WEAPON_IDS.length);
    for (const e of EVOLUTIONS) {
      expect(WEAPON_IDS).toContain(e.weapon);
      expect(PASSIVE_IDS).toContain(e.passive);
    }
    const uses = (id: PassiveId): number => EVOLUTIONS.filter((e) => e.passive === id).length;
    expect(uses('vest')).toBe(2);
    for (const id of PASSIVE_IDS) expect(uses(id)).toBeGreaterThanOrEqual(1);
  });

  it('every weapon table has the regular levels plus the evolution', () => {
    for (const id of WEAPON_IDS) expect(WEAPONS[id].levels).toHaveLength(EVOLVED_LEVEL);
  });
});

describe('recipe conditions', () => {
  it('weapon at max level + passive at the required level = ready', () => {
    const p = playerWith('cans', MAX, NEED);
    expect(recipeStatus(p, 'cans')?.ready).toBe(true);
    expect(readyEvolutions(p)).toEqual(['cans']);
  });

  it('is not ready with the passive one level short, the weapon below max or no passive', () => {
    expect(recipeStatus(playerWith('cans', MAX, NEED - 1), 'cans')?.ready).toBe(false);
    expect(recipeStatus(playerWith('cans', MAX - 1, MAX), 'cans')?.ready).toBe(false);
    expect(recipeStatus(playerWith('cans', MAX, 0), 'cans')?.ready).toBe(false);
  });

  it('reports what is missing', () => {
    const s = recipeStatus(playerWith('labelGun', 3, 1), 'labelGun');
    expect(s).toMatchObject({ weaponLevel: 3, passiveLevel: 1, weaponReady: false });
    expect(s?.passiveReady).toBe(false);
    const none = recipeStatus(createPlayer(), 'shotgun');
    expect(none).toMatchObject({ weaponLevel: 0, passiveLevel: 0, ready: false });
  });

  it('an evolved weapon is no longer ready, nor offered as an upgrade', () => {
    const p = playerWith('cans', MAX, NEED);
    expect(evolveWeapon(p, 'cans')).toBe(true);
    expect(recipeStatus(p, 'cans')).toMatchObject({ evolved: true, ready: false });
    expect(evolveWeapon(p, 'cans')).toBe(false);
    expect(buildCandidates(p).some((o) => 'weaponId' in o && o.weaponId === 'cans')).toBe(false);
  });
});

describe('slots', () => {
  it('an automatic evolution keeps its slot, its place and the slot count', () => {
    const p = createPlayer();
    p.weapons = (['ice', 'cans', 'aerosol', 'microwave'] as const).map((id) => {
      const w = createWeapon(id);
      w.level = MAX;
      return w;
    });
    addPassive(p, 'coffee').level = NEED;
    const before = p.weapons[1];
    applyOffer(p, evolveOffer('cans'));
    expect(p.weapons).toHaveLength(PROGRESSION.maxWeapons);
    expect(p.weapons[1]).toBe(before);
    expect(before && isEvolved(before)).toBe(true);
    expect(before && weaponIcon(before)).toBe(recipeFor('cans')?.icon);
    // Full slots stay full: no new automatic weapon appears.
    expect(buildCandidates(p).some((o) => o.kind === 'newWeapon' && o.weaponId !== 'shotgun')).toBe(
      false,
    );
  });

  it('a manual evolution keeps its entry, ammo, key and pistol mods', () => {
    const p = playerWith('labelGun', MAX, NEED);
    const entry = entryOf(p.manual, 'labelGun');
    if (!entry) throw new Error('no pistol');
    entry.mag = 5;
    entry.reserve = 33;
    addPistolMod(p.manual, 'piercing');
    applyOffer(p, evolveOffer('labelGun'));
    expect(entryOf(p.manual, 'labelGun')).toBe(entry);
    expect(entry.weapon.level).toBe(EVOLVED_LEVEL);
    expect([entry.mag, entry.reserve]).toEqual([5, 33]);
    expect(p.manual.owned.map((e) => e.weapon.def.id)).toEqual(['labelGun', 'broom']);
    // The piercing mod still adds on top of the evolved stats.
    expect(gunStats(p.manual, 'labelGun').pierce).toBe(LASER.pierce + 1);
    expect(p.manual.mods).toEqual(['piercing']);
  });
});

describe('offers', () => {
  it('a ready evolution is always among the level-up cards, never twice', () => {
    const p = playerWith('ice', MAX, NEED);
    for (let seed = 0; seed < 100; seed++) {
      const offers = rollOffers(p, createRng(seed));
      expect(offers).toHaveLength(PROGRESSION.offerCount);
      expect(offers.filter((o) => o.kind === 'evolveWeapon')).toEqual([evolveOffer('ice')]);
    }
  });

  it('the boss chest offers it too; the first chest also keeps the shotgun', () => {
    const p = playerWith('ice', MAX, NEED);
    const first = rollChestOffers(p, createRng(3));
    expect(first.slice(0, 2)).toEqual([
      { kind: 'newWeapon', weaponId: 'shotgun' },
      evolveOffer('ice'),
    ]);
    p.chestsOpened = 1;
    expect(rollChestOffers(p, createRng(3))[0]).toEqual(evolveOffer('ice'));
  });

  it('never shows more cards than the screen holds, even with many evolutions ready', () => {
    const p = createPlayer();
    for (const e of p.manual.owned) e.weapon.level = MAX;
    addManualWeapon(p.manual, 'shotgun');
    const sg = entryOf(p.manual, 'shotgun');
    if (sg) sg.weapon.level = MAX;
    for (const id of ['magnet', 'calculator', 'vest'] as const) addPassive(p, id).level = NEED;
    expect(readyEvolutions(p)).toHaveLength(3);
    const offers = rollOffers(p, createRng(1));
    expect(offers).toHaveLength(PROGRESSION.offerCount);
    expect(offers.every((o) => o.kind === 'evolveWeapon')).toBe(true);
  });

  it('nothing changes while no recipe is ready (same draw as before)', () => {
    const p = playerWith('ice', MAX, NEED - 1);
    expect(rollOffers(p, createRng(5)).some((o) => o.kind === 'evolveWeapon')).toBe(false);
  });
});

describe('evolved mechanics', () => {
  it('electric broom discharge jumps to the configured number of distinct zombies in range', () => {
    const world = emptyWorld();
    const chain = [60, 140, 220, 300, 380, 460].map((x) => tank(world, x, 0));
    spatialIndexSystem(world);
    const [first] = chain;
    if (!first) throw new Error('no zombie');
    const struck = chainLightning(world, first, 4, 120, 10, 0);
    expect(struck).toBe(4);
    expect(chain.slice(1, 5).every((e) => e.hp < 10_000)).toBe(true);
    expect(chain[5]?.hp).toBe(10_000);
    expect(world.arcs.count).toBe(5);
  });

  it('the evolved broom swing triggers the discharge', () => {
    const world = emptyWorld();
    world.aimActive = true;
    setVec(world.aim, 1, 0);
    world.triggerHeld = true;
    const m = world.player.manual;
    const broom = entryOf(m, 'broom');
    if (!broom) throw new Error('no broom');
    broom.weapon.level = EVOLVED_LEVEL;
    selectManual(m, 'broom');
    tank(world, 40, 0);
    const beyondReach = tank(world, 130, 0);
    spatialIndexSystem(world);
    manualWeaponSystem(world, FIXED_STEP);
    expect(beyondReach.hp).toBeLessThan(10_000);
    expect(world.arcs.count).toBeGreaterThan(0);
  });

  it('grenade cans blast the zombies around the impact, not the ones beyond the radius', () => {
    const world = emptyWorld();
    const radius = GRENADE.explosionRadius ?? 0;
    expect(radius).toBeGreaterThan(0);
    const target = tank(world, 100, 0);
    const beside = tank(world, 100, radius - 10);
    const far = tank(world, 100, radius + 60);
    spawnProjectile(world, 0, 0, 0, GRENADE, 'can', 1);
    for (let i = 0; i < 30; i++) {
      spatialIndexSystem(world);
      projectileSystem(world, FIXED_STEP);
    }
    expect(target.hp).toBeLessThan(10_000);
    expect(beside.hp).toBeLessThan(10_000);
    expect(far.hp).toBe(10_000);
  });

  it('a laser shot pierces well past the old 4-enemy limit', () => {
    const world = emptyWorld();
    const row = Array.from({ length: 8 }, (_, i) => tank(world, 60 + i * 30, 0));
    spawnProjectile(world, 0, 0, 0, LASER, 'laser', 5);
    for (let i = 0; i < 30; i++) {
      spatialIndexSystem(world);
      projectileSystem(world, FIXED_STEP);
    }
    expect(row.every((e) => e.hp < 10_000)).toBe(true);
  });

  it('the blizzard freezes what it touches', () => {
    const world = emptyWorld();
    const w = createWeapon('ice');
    w.level = EVOLVED_LEVEL;
    world.player.weapons = [w];
    const e = tank(world, BLIZZARD.orbitRadius, 0);
    for (let i = 0; i < 20; i++) {
      spatialIndexSystem(world);
      weaponSystem(world, FIXED_STEP);
    }
    expect(e.slowTimer).toBeGreaterThan(0);
    expect(e.slowFactor).toBe(1);
  });
});
