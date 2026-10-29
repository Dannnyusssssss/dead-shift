import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { SHIFT } from '../src/data/shift';
import { WEAPON_IDS } from '../src/data/weapons';
import { hasAmmo, maxReserve, selectManual } from '../src/game/manual';
import { chooseOffer } from '../src/game/progression';
import { shiftClock } from '../src/game/shift';
import { updateWorld, type World } from '../src/game/world';
import { botPickOffer, emptyWorld, playerBot } from './helpers';

/**
 * Balance report (not part of the normal run): `BALANCE=1 npx vitest run tests/balance.test.ts`.
 * Plays several real (mortal) runs with the test bot per scenario and prints how they went:
 * - `mixed`: gun first, broom as the fallback (normal play).
 * - `broomOnly`: no rounds and no ammo boxes, only the broom (and whatever automatic weapons it picks).
 * - `gunOnly`: the gun with endless reserve and never the broom (pure gun power, no ammo economy).
 * Each scenario runs twice: with automatic weapons and with manual weapons only (the bot never
 * takes a new automatic weapon unless nothing else is offered), which isolates gun vs. broom.
 * `kpm` = kills per minute survived.
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;

type Scenario = 'mixed' | 'broomOnly' | 'gunOnly';
const SCENARIOS: readonly Scenario[] = ['mixed', 'broomOnly', 'gunOnly'];
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface RunResult {
  time: number;
  kills: number;
  broomShare: number;
  row: string;
}

function weaponKills(world: World): string {
  return WEAPON_IDS.map((id, i) => [id, world.killsByWeapon[i] ?? 0] as const)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${id}:${n}`)
    .join(' ');
}

function playRun(scenario: Scenario, seed: number, newWeapons = true): RunResult {
  const world = emptyWorld(seed);
  const m = world.player.manual;
  if (scenario === 'broomOnly') {
    m.mag = m.reserve = 0;
    selectManual(m, 'melee');
  }
  let steps = 0;
  let meleeSteps = 0;
  let dryShots = 0;
  const limit = Math.round(SHIFT.durationSeconds / FIXED_STEP) + 10;
  while (world.status !== 'won' && world.status !== 'dead' && steps < limit) {
    if (world.status === 'levelup') chooseOffer(world, botPickOffer(world, newWeapons));
    playerBot(world, scenario !== 'gunOnly');
    updateWorld(world, FIXED_STEP);
    if (scenario === 'broomOnly') world.ammoBoxes.clear();
    if (scenario === 'gunOnly') m.reserve = maxReserve();
    if (m.active === 'melee') meleeSteps++;
    if (!hasAmmo(m)) dryShots++;
    steps++;
  }
  const broom = world.killsByWeapon[WEAPON_IDS.indexOf('broom')] ?? 0;
  const gun = world.killsByWeapon[WEAPON_IDS.indexOf('labelGun')] ?? 0;
  const broomShare = broom + gun > 0 ? broom / (broom + gun) : 0;
  const row = [
    `  seed ${seed}`,
    world.status.padEnd(4),
    `t=${world.time.toFixed(0).padStart(3)}s (${shiftClock(world.time)})`,
    `kills=${String(world.kills).padStart(4)}`,
    `lv=${String(world.player.level).padStart(2)}`,
    `melee=${((meleeSteps / steps) * 100).toFixed(0).padStart(3)}%`,
    `0/0=${((dryShots / steps) * 100).toFixed(0).padStart(3)}%`,
    `hp=${world.player.hp.toFixed(0).padStart(3)}`,
    `broom/manual=${(broomShare * 100).toFixed(0).padStart(3)}%`,
    weaponKills(world),
  ].join('  ');
  return { time: world.time, kills: world.kills, broomShare, row };
}

const avg = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

describe.skipIf(!env?.BALANCE)('balance report', () => {
  it('bot runs without god mode', () => {
    const lines: string[] = [];
    for (const newWeapons of [true, false])
      for (const scenario of SCENARIOS) {
        const runs = SEEDS.map((seed) => playRun(scenario, seed, newWeapons));
        lines.push(
          `${scenario} (${newWeapons ? 'autos' : 'manual only'}): avg t=${avg(runs.map((r) => r.time)).toFixed(0)}s` +
            `  kpm=${avg(runs.map((r) => r.kills / (r.time / 60))).toFixed(0)}` +
            `  kills=${avg(runs.map((r) => r.kills)).toFixed(0)}` +
            `  broom/manual=${(avg(runs.map((r) => r.broomShare)) * 100).toFixed(0)}%`,
          ...runs.map((r) => r.row),
        );
      }
    console.log('\n' + lines.join('\n'));
    expect(lines.length).toBeGreaterThan(SCENARIOS.length);
  }, 900_000);
});
