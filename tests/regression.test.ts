import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { SHIFT } from '../src/data/shift';
import { chooseOffer, rerollOffers } from '../src/game/progression';
import { createWorld, updateWorld, type World } from '../src/game/world';
import { botPickOffer, botWantsReroll, playerBot } from './helpers';

/**
 * Regression guard (Hito 11): the easy difficulty must play exactly like the game before
 * difficulties existed. The golden values below were captured with the code of Hito 10, before
 * any difficulty code was written. Floats are compared exactly, and `nextRandom` proves the
 * seeded RNG consumed the very same sequence.
 * To print a new fingerprint: `REGEN=1 npx vitest run tests/regression.test.ts`.
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;

interface Fingerprint {
  status: string;
  tick: number;
  time: number;
  kills: number;
  level: number;
  xp: number;
  hp: number;
  x: number;
  y: number;
  enemies: number;
  killsByWeapon: number[];
  loadout: string;
  ammo: string;
  nextRandom: number;
}

function fingerprint(world: World): Fingerprint {
  const p = world.player;
  return {
    status: world.status,
    tick: world.tick,
    time: world.time,
    kills: world.kills,
    level: p.level,
    xp: p.xp,
    hp: p.hp,
    x: p.pos.x,
    y: p.pos.y,
    enemies: world.enemies.count,
    killsByWeapon: [...world.killsByWeapon],
    loadout: [...p.weapons, ...p.passives, ...p.manual.owned.map((e) => e.weapon)]
      .map((w) => `${w.def.id}:${w.level}`)
      .join(','),
    ammo: p.manual.owned.map((e) => `${e.weapon.def.id}:${e.mag}/${e.reserve}`).join(','),
    nextRandom: world.rng.next(),
  };
}

/** Plays a whole run with the test bot, like the balance report does. */
function playToEnd(world: World, god: boolean): Fingerprint {
  world.player.invincible = god;
  const limit = SHIFT.durationSeconds + 1;
  while (world.status !== 'won' && world.status !== 'dead' && world.time < limit) {
    if (world.status === 'levelup') {
      if (botWantsReroll(world)) rerollOffers(world);
      chooseOffer(world, botPickOffer(world));
    }
    playerBot(world);
    updateWorld(world, FIXED_STEP);
    world.events.clear();
    world.hits.clear();
  }
  return fingerprint(world);
}

const CASES = [
  { name: 'seed 1, god mode, full shift', seed: 1, god: true },
  { name: 'seed 2, mortal', seed: 2, god: false },
] as const;

const GOLDEN: Record<string, Fingerprint> = {
  'seed 1, god mode, full shift': {
    status: 'won',
    tick: 36000,
    time: 600,
    kills: 2105,
    level: 54,
    xp: 26,
    hp: 100,
    x: 1311.2546384600755,
    y: 1096.0318865263123,
    enemies: 92,
    killsByWeapon: [23, 468, 316, 35, 338, 813, 112],
    loadout:
      'ice:5,cans:6,microwave:5,aerosol:5,magnet:5,coffee:4,soup:2,calculator:4,labelGun:6,shotgun:5,broom:6',
    ammo: 'labelGun:34/41,shotgun:0/0,broom:0/0',
    nextRandom: 0.8393627712503076,
  },
  'seed 2, mortal': {
    status: 'dead',
    tick: 22563,
    time: 376.04999999998665,
    kills: 755,
    level: 18,
    xp: 33,
    hp: 0,
    x: -135.65647309300988,
    y: 449.8663016831517,
    enemies: 155,
    killsByWeapon: [0, 135, 11, 58, 0, 504, 47],
    loadout: 'cans:2,aerosol:3,ice:3,labelGun:5,shotgun:3,broom:3',
    ammo: 'labelGun:7/112,shotgun:0/10,broom:0/0',
    nextRandom: 0.7961218825075775,
  },
};

describe('easy difficulty = the game before difficulties', () => {
  for (const c of CASES) {
    it(`${c.name} (default world)`, () => {
      const result = playToEnd(createWorld(c.seed), c.god);
      if (env?.REGEN) console.log(c.name, JSON.stringify(result));
      expect(result).toEqual(GOLDEN[c.name]);
    }, 120_000);

    it(`${c.name} (easy chosen explicitly)`, () => {
      expect(playToEnd(createWorld(c.seed, 'easy'), c.god)).toEqual(GOLDEN[c.name]);
    }, 120_000);
  }

  it('normal and hard play differently from the golden run', () => {
    for (const id of ['normal', 'hard'] as const) {
      expect(playToEnd(createWorld(2, id), false)).not.toEqual(GOLDEN['seed 2, mortal']);
    }
  }, 120_000);
});
