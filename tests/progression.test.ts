import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import { PROGRESSION } from '../src/data/progression';
import { PASSIVE_IDS } from '../src/data/upgrades';
import { WEAPON_IDS, WEAPONS, isManual } from '../src/data/weapons';
import { addPassive, createPlayer } from '../src/game/player';
import {
  addXp,
  applyOffer,
  buildCandidates,
  chooseOffer,
  levelBeingChosen,
  progressionSystem,
  rerollOffers,
  rollOffers,
  xpForLevel,
  type Offer,
} from '../src/game/progression';
import { createWeapon } from '../src/game/weapons';
import { emptyWorld } from './helpers';

const targetOf = (o: Offer): string =>
  o.kind === 'newWeapon' || o.kind === 'upgradeWeapon'
    ? `w:${o.weaponId}`
    : o.kind === 'newPassive' || o.kind === 'upgradePassive'
      ? `p:${o.passiveId}`
      : 'heal';

const AUTO_IDS = WEAPON_IDS.filter((id) => !isManual(WEAPONS[id]));
const MANUAL_IDS = WEAPON_IDS.filter((id) => isManual(WEAPONS[id]));

function maxedPlayer() {
  const p = createPlayer();
  p.weapons = AUTO_IDS.slice(0, PROGRESSION.maxWeapons).map((id) => {
    const w = createWeapon(id);
    w.level = PROGRESSION.maxLevel;
    return w;
  });
  p.manual.gun.level = p.manual.melee.level = PROGRESSION.maxLevel;
  for (const id of PASSIVE_IDS.slice(0, PROGRESSION.maxPassives)) {
    addPassive(p, id).level = PROGRESSION.maxLevel;
  }
  return p;
}

describe('xp curve', () => {
  it('matches 5 + N*4 + floor(N^1.5)', () => {
    expect(xpForLevel(2)).toBe(5 + 8 + 2);
    expect(xpForLevel(3)).toBe(5 + 12 + 5);
    expect(xpForLevel(10)).toBe(5 + 40 + 31);
  });

  it('is strictly increasing', () => {
    for (let n = 2; n < 60; n++) expect(xpForLevel(n + 1)).toBeGreaterThan(xpForLevel(n));
  });
});

describe('addXp', () => {
  it('levels up and keeps the remainder', () => {
    const p = createPlayer();
    expect(addXp(p, xpForLevel(2) - 1)).toBe(0);
    expect(p.level).toBe(1);
    expect(addXp(p, 3)).toBe(1);
    expect(p.level).toBe(2);
    expect(p.xp).toBe(2);
    expect(p.pendingLevelUps).toBe(1);
  });

  it('can gain several levels at once', () => {
    const p = createPlayer();
    const amount = xpForLevel(2) + xpForLevel(3) + xpForLevel(4) + 1;
    expect(addXp(p, amount)).toBe(3);
    expect(p.level).toBe(4);
    expect(p.xp).toBe(1);
    expect(p.pendingLevelUps).toBe(3);
    expect(levelBeingChosen(p)).toBe(2);
  });
});

describe('offers', () => {
  it('never repeats a target and has the requested size', () => {
    const p = createPlayer();
    for (let seed = 0; seed < 200; seed++) {
      const offers = rollOffers(p, createRng(seed));
      expect(offers).toHaveLength(PROGRESSION.offerCount);
      const targets = offers.map(targetOf);
      expect(new Set(targets).size).toBe(targets.length);
    }
  });

  it('manual weapons are only ever upgrades; automatic ones start as new', () => {
    const candidates = buildCandidates(createPlayer());
    for (const id of MANUAL_IDS) {
      expect(candidates).toContainEqual({ kind: 'upgradeWeapon', weaponId: id });
      expect(candidates).not.toContainEqual({ kind: 'newWeapon', weaponId: id });
    }
    for (const id of AUTO_IDS)
      expect(candidates).toContainEqual({ kind: 'newWeapon', weaponId: id });
  });

  it('the four automatic weapons all fit in the slots', () => {
    expect(AUTO_IDS.length).toBeLessThanOrEqual(PROGRESSION.maxWeapons);
    const p = createPlayer();
    for (const id of AUTO_IDS) applyOffer(p, { kind: 'newWeapon', weaponId: id });
    expect(p.weapons).toHaveLength(AUTO_IDS.length);
  });

  it('respects slot limits and max levels', () => {
    const p = createPlayer();
    p.weapons = AUTO_IDS.slice(0, PROGRESSION.maxWeapons).map((id) => createWeapon(id));
    const owned = new Set([...p.weapons.map((w) => w.def.id), ...MANUAL_IDS]);
    const first = p.weapons[0];
    if (first) first.level = PROGRESSION.maxLevel;
    p.manual.melee.level = PROGRESSION.maxLevel;
    for (const o of buildCandidates(p)) {
      if (o.kind === 'newWeapon') throw new Error('offered a weapon with full slots');
      if (o.kind === 'upgradeWeapon') {
        expect(owned.has(o.weaponId)).toBe(true);
        expect(o.weaponId).not.toBe(first?.def.id);
        expect(o.weaponId).not.toBe(p.manual.melee.def.id);
      }
    }
  });

  it('upgrading a manual weapon raises its level', () => {
    const p = createPlayer();
    applyOffer(p, { kind: 'upgradeWeapon', weaponId: p.manual.gun.def.id });
    expect(p.manual.gun.level).toBe(2);
    applyOffer(p, { kind: 'newWeapon', weaponId: p.manual.melee.def.id });
    expect(p.weapons).toHaveLength(0);
  });

  it('falls back to a single heal when nothing is left', () => {
    const p = maxedPlayer();
    expect(buildCandidates(p)).toEqual([]);
    expect(rollOffers(p, createRng(1))).toEqual([{ kind: 'heal' }]);
  });

  it('shows fewer cards when fewer candidates exist', () => {
    const p = maxedPlayer();
    const w = p.weapons[1];
    if (w) w.level = PROGRESSION.maxLevel - 1;
    expect(rollOffers(p, createRng(1))).toEqual([{ kind: 'upgradeWeapon', weaponId: w?.def.id }]);
  });

  it('is deterministic for a given seed and varies across seeds', () => {
    const p = createPlayer();
    expect(rollOffers(p, createRng(9))).toEqual(rollOffers(p, createRng(9)));
    const distinct = new Set(
      Array.from({ length: 30 }, (_, s) => JSON.stringify(rollOffers(p, createRng(s)))),
    );
    expect(distinct.size).toBeGreaterThan(5);
  });
});

describe('applyOffer', () => {
  it('adds and upgrades weapons and passives, recomputing stats', () => {
    const p = createPlayer();
    applyOffer(p, { kind: 'newWeapon', weaponId: 'cans' });
    expect(p.weapons.map((w) => w.def.id)).toEqual(['cans']);
    applyOffer(p, { kind: 'upgradeWeapon', weaponId: 'cans' });
    expect(p.weapons[0]?.level).toBe(2);
    applyOffer(p, { kind: 'newPassive', passiveId: 'shoes' });
    const speed1 = p.speed;
    expect(speed1).toBeCloseTo(p.base.speed * 1.08);
    applyOffer(p, { kind: 'upgradePassive', passiveId: 'shoes' });
    expect(p.speed).toBeCloseTo(p.base.speed * 1.16);
  });

  it('heals 30% without exceeding max hp', () => {
    const p = createPlayer();
    p.hp = 50;
    applyOffer(p, { kind: 'heal' });
    expect(p.hp).toBe(80);
    applyOffer(p, { kind: 'heal' });
    expect(p.hp).toBe(p.maxHp);
  });
});

describe('level-up flow', () => {
  it('pauses on level-up, applies the choice and resumes', () => {
    const world = emptyWorld(3);
    addXp(world.player, xpForLevel(2) + xpForLevel(3));
    progressionSystem(world);
    expect(world.status).toBe('levelup');
    expect(world.offers.length).toBeGreaterThan(0);
    expect(chooseOffer(world, 0)).toBe(true);
    // A second level is pending, so we stay on the screen with fresh offers.
    expect(world.status).toBe('levelup');
    expect(chooseOffer(world, 0)).toBe(true);
    expect(world.status).toBe('playing');
    expect(world.player.pendingLevelUps).toBe(0);
    expect(chooseOffer(world, 0)).toBe(false);
  });

  it('allows exactly one reroll per run', () => {
    const world = emptyWorld(4);
    addXp(world.player, xpForLevel(2));
    progressionSystem(world);
    expect(rerollOffers(world)).toBe(true);
    expect(rerollOffers(world)).toBe(false);
    expect(world.rerollsLeft).toBe(0);
  });
});
