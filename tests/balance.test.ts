import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { SHIFT } from '../src/data/shift';
import { hasAmmo } from '../src/game/manual';
import { chooseOffer } from '../src/game/progression';
import { shiftClock } from '../src/game/shift';
import { updateWorld } from '../src/game/world';
import { botPickOffer, emptyWorld, playerBot } from './helpers';

/**
 * Balance report (not part of the normal run): `BALANCE=1 npx vitest run tests/balance.test.ts`.
 * Plays several real (mortal) runs with the test bot and prints how they went.
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;

describe.skipIf(!env?.BALANCE)('balance report', () => {
  it('bot runs without god mode', () => {
    const rows: string[] = [];
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const world = emptyWorld(seed);
      const m = world.player.manual;
      let steps = 0;
      let meleeSteps = 0;
      let dryShots = 0;
      let reserveSum = 0;
      const limit = Math.round(SHIFT.durationSeconds / FIXED_STEP) + 10;
      while (world.status !== 'won' && world.status !== 'dead' && steps < limit) {
        if (world.status === 'levelup') chooseOffer(world, botPickOffer(world));
        playerBot(world);
        updateWorld(world, FIXED_STEP);
        if (m.active === 'melee') meleeSteps++;
        if (!hasAmmo(m)) dryShots++;
        reserveSum += m.reserve;
        steps++;
      }
      rows.push(
        [
          `seed ${seed}`,
          world.status.padEnd(4),
          `t=${world.time.toFixed(0).padStart(3)}s (${shiftClock(world.time)})`,
          `kills=${world.kills}`,
          `lv=${world.player.level}`,
          `melee=${((meleeSteps / steps) * 100).toFixed(0)}%`,
          `0/0=${((dryShots / steps) * 100).toFixed(0)}%`,
          `avgReserve=${(reserveSum / steps).toFixed(0)}`,
          `hp=${world.player.hp.toFixed(0)}`,
          `gun=Nv${m.gun.level} broom=Nv${m.melee.level}`,
        ].join('  '),
      );
    }
    console.log('\n' + rows.join('\n'));
    expect(rows).toHaveLength(6);
  }, 300_000);
});
