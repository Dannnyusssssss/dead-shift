import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { ENEMIES } from '../src/data/enemies';
import { SHIFT } from '../src/data/shift';
import { WEAPON_IDS } from '../src/data/weapons';
import { giveAllWeapons } from '../src/game/debug';
import { scaleAt } from '../src/game/enemies';
import { gunStats, hasAmmo, maxReserve, selectManual } from '../src/game/manual';
import { pistolOf } from './helpers';
import { chooseOffer, xpForLevel } from '../src/game/progression';
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
 *
 * Then the power curve (Hito 9.5), cut at minutes 2, 4, 6, 8 and 10:
 * - `mixed` as above (only the runs still alive count at each minute).
 * - `curve`: `mixed` with god mode, so every run reaches dawn and the whole XP curve is measured.
 * - `weaponsAll`: every weapon at level 5 (`?weapons=all`) and god mode: the ceiling of player
 *   power. If the horde still outgrows it, the wall is enemy scaling, not the upgrades.
 * Plus the level each candidate XP curve would give with the XP `curve` earned.
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;

type Scenario = 'mixed' | 'broomOnly' | 'gunOnly';
const SCENARIOS: readonly Scenario[] = ['mixed', 'broomOnly', 'gunOnly'];
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
/** Minutes where the power-curve table is cut. */
const CHECKPOINTS = [2, 4, 6, 8, 10];
/** Minutes where the level is compared with the curve targets (~10 / ~18 / 35-40). */
const LEVEL_MARKS = [3, 5, 10];

/** XP curves under test: XP to go from level N-1 to N. */
const CANDIDATE_CURVES: readonly (readonly [string, (n: number) => number])[] = [
  ['5+4N+N^1.5 (Hito 3)', (n) => 5 + 4 * n + Math.floor(n ** 1.5)],
  ['4+2N', (n) => 4 + 2 * n],
  ['5+3N+N^1.2', (n) => 5 + 3 * n + Math.floor(n ** 1.2)],
];

interface MinuteStats {
  level: number;
  /** Level-ups plus chests opened. */
  upgrades: number;
  totalXp: number;
  /** Mean max hp of the zombies alive at the cut, boss excluded. */
  enemyHp: number;
  /** Mean enemy count over the window. */
  onScreen: number;
  /** Direct damage per second over the window (poison and burn emit no hits). */
  dps: number;
  /** Seconds the pistol (sustained, reloads included) needs for one Client spawned now. */
  clientTtk: number;
  killRate: number;
  spawnRate: number;
}

interface RunResult {
  time: number;
  kills: number;
  broomShare: number;
  row: string;
  /** Indexed like CHECKPOINTS; undefined once the run died. */
  minutes: (MinuteStats | undefined)[];
  /** Indexed like LEVEL_MARKS. */
  levelAt: (number | undefined)[];
  xpAt: (number | undefined)[];
}

interface RunOptions {
  newWeapons?: boolean;
  god?: boolean;
  allWeapons?: boolean;
}

function weaponKills(world: World): string {
  return WEAPON_IDS.map((id, i) => [id, world.killsByWeapon[i] ?? 0] as const)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${id}:${n}`)
    .join(' ');
}

/** Every XP point earned so far (levels already spent plus the current remainder). */
function totalXp(world: World): number {
  let sum = world.player.xp;
  for (let n = 2; n <= world.player.level; n++) sum += xpForLevel(n);
  return sum;
}

/** Sustained single-target DPS of the pistol: a full magazine plus its reload. */
function pistolDps(world: World): number {
  const s = gunStats(world.player.manual, 'labelGun');
  const mods = world.player.mods;
  const perMag = s.magazine * s.damage * s.count * mods.damage;
  return perMag / (s.magazine * s.cooldown * mods.cooldown + s.reloadTime);
}

function meanEnemyHp(world: World): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < world.enemies.count; i++) {
    const e = world.enemies.items[i];
    if (!e || e.def.behavior.kind === 'boss') continue;
    sum += e.maxHp;
    n++;
  }
  return n > 0 ? sum / n : 0;
}

/** Accumulates one window between checkpoints. */
class MinuteTracker {
  private damage = 0;
  private spawns = 0;
  private countSum = 0;
  private steps = 0;
  private startTime = 0;
  private startKills = 0;
  private prevCount = 0;
  private prevKills = 0;

  /** Call after every simulated step. */
  step(world: World): void {
    for (let i = 0; i < world.hits.count; i++) this.damage += world.hits.items[i]?.amount ?? 0;
    world.hits.clear();
    // Relocations keep the count; a spawn adds one, a kill removes one.
    this.spawns += world.enemies.count - this.prevCount + (world.kills - this.prevKills);
    this.prevCount = world.enemies.count;
    this.prevKills = world.kills;
    this.countSum += world.enemies.count;
    this.steps++;
  }

  cut(world: World): MinuteStats {
    const span = Math.max(FIXED_STEP, world.time - this.startTime);
    const p = world.player;
    const stats: MinuteStats = {
      level: p.level,
      upgrades: p.level - 1 + p.chestsOpened,
      totalXp: totalXp(world),
      enemyHp: meanEnemyHp(world),
      onScreen: this.countSum / Math.max(1, this.steps),
      dps: this.damage / span,
      clientTtk: (ENEMIES.client.hp * scaleAt(world.time)) / pistolDps(world),
      killRate: (world.kills - this.startKills) / span,
      spawnRate: this.spawns / span,
    };
    this.damage = this.spawns = this.countSum = this.steps = 0;
    this.startTime = world.time;
    this.startKills = world.kills;
    return stats;
  }
}

function playRun(scenario: Scenario, seed: number, opts: RunOptions = {}): RunResult {
  const { newWeapons = true, god = false, allWeapons = false } = opts;
  const world = emptyWorld(seed);
  const m = world.player.manual;
  const pistol = pistolOf(world);
  world.player.invincible = god;
  if (allWeapons) giveAllWeapons(world);
  if (scenario === 'broomOnly') {
    pistol.mag = pistol.reserve = 0;
    selectManual(m, 'broom');
  }
  const tracker = new MinuteTracker();
  const minutes: (MinuteStats | undefined)[] = CHECKPOINTS.map(() => undefined);
  const levelAt: (number | undefined)[] = LEVEL_MARKS.map(() => undefined);
  const xpAt: (number | undefined)[] = LEVEL_MARKS.map(() => undefined);
  let nextCut = 0;
  let nextMark = 0;
  let steps = 0;
  let meleeSteps = 0;
  let dryShots = 0;
  const limit = Math.round(SHIFT.durationSeconds / FIXED_STEP) + 10;
  while (world.status !== 'won' && world.status !== 'dead' && steps < limit) {
    if (world.status === 'levelup') chooseOffer(world, botPickOffer(world, newWeapons));
    playerBot(world, scenario !== 'gunOnly');
    updateWorld(world, FIXED_STEP);
    if (scenario === 'broomOnly') {
      world.ammoBoxes.clear();
      world.shellBoxes.clear();
      // No shotgun shells either: the broom alone.
      for (const e of m.owned) if (e.weapon.def.id !== 'broom') e.mag = e.reserve = 0;
    }
    if (scenario === 'gunOnly') {
      for (const e of m.owned)
        if (e.weapon.def.id !== 'broom') e.reserve = maxReserve(e.weapon.def.id);
    }
    tracker.step(world);
    const minute = world.time / 60 + 1e-9;
    if (world.player.hp > 0) {
      for (; nextCut < CHECKPOINTS.length && minute >= (CHECKPOINTS[nextCut] ?? 0); nextCut++)
        minutes[nextCut] = tracker.cut(world);
      for (; nextMark < LEVEL_MARKS.length && minute >= (LEVEL_MARKS[nextMark] ?? 0); nextMark++) {
        levelAt[nextMark] = world.player.level;
        xpAt[nextMark] = totalXp(world);
      }
    }
    if (m.active === 'broom') meleeSteps++;
    if (!hasAmmo(m, 'labelGun')) dryShots++;
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
    `stuck=${world.stuckRelocations}`,
    weaponKills(world),
  ].join('  ');
  return { time: world.time, kills: world.kills, broomShare, row, minutes, levelAt, xpAt };
}

const avg = (xs: readonly number[]): number =>
  xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

const defined = <T>(xs: readonly (T | undefined)[]): T[] =>
  xs.filter((x): x is T => x !== undefined);

/** Level reached with `xp` total under the curve `cost` (XP from level N-1 to N). */
function levelWith(xp: number, cost: (n: number) => number): number {
  let level = 1;
  for (let left = xp - cost(2); left >= 0; left -= cost(level + 1)) level++;
  return level;
}

/** Per-minute averages over the runs still alive at each cut. */
function minuteTable(title: string, runs: readonly RunResult[]): string[] {
  const head = '  min  alive  level  upgrds    xp  zombHp  onScrn    dps  cliTtk  kills/s  spwn/s';
  const rows = CHECKPOINTS.map((min, i) => {
    const cuts = defined(runs.map((r) => r.minutes[i]));
    const col = (f: (s: MinuteStats) => number, digits = 0, width = 6): string =>
      (cuts.length > 0 ? avg(cuts.map(f)).toFixed(digits) : '-').padStart(width);
    return [
      `  ${String(min).padStart(3)}`,
      `${cuts.length}/${runs.length}`.padStart(6),
      col((s) => s.level, 1),
      col((s) => s.upgrades, 1, 8),
      col((s) => s.totalXp, 0),
      col((s) => s.enemyHp, 1, 7),
      col((s) => s.onScreen, 0, 7),
      col((s) => s.dps, 0),
      col((s) => s.clientTtk, 2, 7),
      col((s) => s.killRate, 2, 8),
      col((s) => s.spawnRate, 2, 7),
    ].join(' ');
  });
  const marks = LEVEL_MARKS.map((min, i) => {
    const lv = defined(runs.map((r) => r.levelAt[i]));
    return `min ${min}: lv ${lv.length > 0 ? avg(lv).toFixed(1) : '-'} (${lv.length} alive)`;
  }).join('  ');
  return [`${title}  (${marks})`, head, ...rows];
}

/** Level each candidate curve would give with the XP measured at each mark. */
function curveProjection(runs: readonly RunResult[]): string[] {
  const xp = LEVEL_MARKS.map((_, i) => avg(defined(runs.map((r) => r.xpAt[i]))));
  return [
    `projection with the XP earned by \`curve\` (${LEVEL_MARKS.map((m, i) => `min ${m}: ${xp[i]?.toFixed(0)} xp`).join(', ')})`,
    ...CANDIDATE_CURVES.map(
      ([name, cost]) =>
        `  ${name.padEnd(22)} ${LEVEL_MARKS.map((m, i) => `min ${m}: lv ${levelWith(xp[i] ?? 0, cost)}`).join('  ')}`,
    ),
  ];
}

describe.skipIf(!env?.BALANCE)('balance report', () => {
  it('bot runs without god mode, then the power curve per minute', () => {
    const lines: string[] = [];
    let mixedRuns: RunResult[] = [];
    for (const newWeapons of [true, false])
      for (const scenario of SCENARIOS) {
        const runs = SEEDS.map((seed) => playRun(scenario, seed, { newWeapons }));
        if (scenario === 'mixed' && newWeapons) mixedRuns = runs;
        lines.push(
          `${scenario} (${newWeapons ? 'autos' : 'manual only'}): avg t=${avg(runs.map((r) => r.time)).toFixed(0)}s` +
            `  kpm=${avg(runs.map((r) => r.kills / (r.time / 60))).toFixed(0)}` +
            `  kills=${avg(runs.map((r) => r.kills)).toFixed(0)}` +
            `  broom/manual=${(avg(runs.map((r) => r.broomShare)) * 100).toFixed(0)}%`,
          ...runs.map((r) => r.row),
        );
      }
    const curveRuns = SEEDS.map((seed) => playRun('mixed', seed, { god: true }));
    const allRuns = SEEDS.map((seed) => playRun('mixed', seed, { god: true, allWeapons: true }));
    lines.push(
      '',
      '=== power curve (poison and burn are not counted in dps) ===',
      ...minuteTable('mixed (autos, mortal)', mixedRuns),
      ...minuteTable('curve (mixed, god mode)', curveRuns),
      ...minuteTable('weaponsAll (god mode)', allRuns),
      ...curveProjection(curveRuns),
    );
    console.log('\n' + lines.join('\n'));
    expect(lines.length).toBeGreaterThan(SCENARIOS.length);
  }, 1_800_000);
});
