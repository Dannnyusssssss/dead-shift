import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { DIFFICULTIES, DIFFICULTY_IDS, type DifficultyDef } from '../src/data/difficulty';
import { ENEMIES, type EnemyId } from '../src/data/enemies';
import { AMMO } from '../src/data/weapons';
import { FLOOR_ITEMS } from '../src/data/progression';
import { WAVES, type WaveEntry } from '../src/data/waves';
import { initialDifficulty, parseDifficulty, wavesFor } from '../src/game/difficulty';
import { scaleAt, spawnEnemy } from '../src/game/enemies';
import { ammoDropChance, medkitDropChance } from '../src/game/pickups';
import { spawnSystem } from '../src/game/spawner';
import { deathSystem } from '../src/game/systems/death';
import { createWorld } from '../src/game/world';
import { addClient, emptyWorld } from './helpers';

type Multiplier = Exclude<keyof DifficultyDef, 'id' | 'nameKey' | 'introLead'>;
const MULTIPLIERS: readonly Multiplier[] = [
  'spawnRate',
  'enemyHp',
  'enemyDamage',
  'bossHp',
  'xp',
  'drops',
];
/** Multipliers that make the game harder when they grow (the rest when they shrink). */
const HARDER_UP: readonly Multiplier[] = ['spawnRate', 'enemyHp', 'enemyDamage', 'bossHp'];

describe('difficulty data', () => {
  it('easy is the plain game: every multiplier 1, nothing early', () => {
    const easy = DIFFICULTIES.easy;
    for (const k of MULTIPLIERS) expect(easy[k]).toBe(1);
    expect(easy.introLead).toBe(0);
  });

  it('each difficulty is at least as hard as the previous one in every parameter', () => {
    for (let i = 1; i < DIFFICULTY_IDS.length; i++) {
      const prev = DIFFICULTIES[DIFFICULTY_IDS[i - 1] ?? 'easy'];
      const cur = DIFFICULTIES[DIFFICULTY_IDS[i] ?? 'easy'];
      for (const k of MULTIPLIERS) {
        if (HARDER_UP.includes(k)) expect(cur[k]).toBeGreaterThanOrEqual(prev[k]);
        else expect(cur[k]).toBeLessThanOrEqual(prev[k]);
      }
      expect(cur.introLead).toBeGreaterThanOrEqual(prev.introLead);
    }
  });

  it('ids match their keys', () => {
    for (const id of DIFFICULTY_IDS) expect(DIFFICULTIES[id].id).toBe(id);
  });
});

describe('difficulty selection (menu and ?difficulty=)', () => {
  it('parses only known ids', () => {
    expect(parseDifficulty('hard')).toBe('hard');
    for (const raw of ['HARD', 'medio', '', null, undefined, 3, {}]) {
      expect(parseDifficulty(raw)).toBeUndefined();
    }
  });

  it('the URL parameter wins over the saved choice; an invalid one is ignored', () => {
    expect(initialDifficulty(null, 'normal')).toBe('normal');
    expect(initialDifficulty('hard', 'normal')).toBe('hard');
    expect(initialDifficulty('impossible', 'normal')).toBe('normal');
  });

  it('the world keeps the difficulty it was created with', () => {
    expect(createWorld(1).difficulty.id).toBe('easy');
    expect(createWorld(1, 'hard').difficulty).toBe(DIFFICULTIES.hard);
  });
});

describe('multipliers in play', () => {
  it('enemy hp and damage, with receipts and shockwaves through `scale`', () => {
    for (const id of DIFFICULTY_IDS) {
      const d = DIFFICULTIES[id];
      const e = addClient(emptyWorld(1, id), 0, 0);
      expect(e.maxHp).toBe(ENEMIES.client.hp * d.enemyHp);
      expect(e.hp).toBe(e.maxHp);
      expect(e.damage).toBe(ENEMIES.client.damage * d.enemyDamage);
      expect(e.scale).toBe(d.enemyDamage);
    }
  });

  it('bosses use bossHp instead of enemyHp, on top of the boss entry multipliers', () => {
    for (const id of DIFFICULTY_IDS) {
      const d = DIFFICULTIES[id];
      const boss = spawnEnemy(emptyWorld(1, id), ENEMIES.manager, 0, 0, 1.5, 1.25);
      expect(boss?.maxHp).toBeCloseTo(ENEMIES.manager.hp * 1.5 * d.bossHp, 9);
      expect(boss?.damage).toBeCloseTo(ENEMIES.manager.damage * 1.25 * d.enemyDamage, 9);
    }
  });

  it('per-minute scaling still applies on top', () => {
    const w = emptyWorld(1, 'hard');
    w.time = 300;
    const e = addClient(w, 0, 0);
    expect(e.maxHp).toBeCloseTo(ENEMIES.client.hp * scaleAt(300) * DIFFICULTIES.hard.enemyHp, 9);
  });

  it('spawn rate: more groups in the same minute', () => {
    const seconds = 40;
    const spawned = (id: (typeof DIFFICULTY_IDS)[number]): number => {
      const w = emptyWorld(1, id);
      for (let t = 0; t < seconds; t += FIXED_STEP) {
        spawnSystem(w, FIXED_STEP);
        w.time += FIXED_STEP;
      }
      return w.enemies.count;
    };
    const base = spawned('easy');
    expect(base).toBeCloseTo(seconds * 1.0, -1);
    for (const id of ['normal', 'hard'] as const) {
      expect(spawned(id)).toBeCloseTo(base * DIFFICULTIES[id].spawnRate, -1);
    }
  });

  it('XP: each kill drops a coupon worth xp times the multiplier', () => {
    for (const id of DIFFICULTY_IDS) {
      const w = emptyWorld(1, id);
      const e = addClient(w, 500, 500);
      e.hp = 0;
      deathSystem(w);
      expect(w.coupons.count).toBe(1);
      expect(w.coupons.items[0]?.value).toBe(ENEMIES.client.xp * DIFFICULTIES[id].xp);
    }
  });

  it('ammo and medkit drop chances scale; the tier still comes from the base XP', () => {
    for (const id of DIFFICULTY_IDS) {
      const m = DIFFICULTIES[id].drops;
      for (const tier of AMMO.dropTiers)
        expect(ammoDropChance(tier.minXp, m)).toBe(tier.chance * m);
      for (const tier of FLOOR_ITEMS.medkit.dropTiers) {
        expect(medkitDropChance(tier.minXp, m)).toBe(tier.chance * m);
      }
    }
    expect(ammoDropChance(1)).toBe(ammoDropChance(1, 1));
  });
});

describe('wavesFor (enemies arriving early)', () => {
  const firstStart = (waves: readonly Readonly<WaveEntry>[], id: EnemyId): number =>
    Math.min(...waves.filter((e) => e.enemyId === id).map((e) => e.minute * 60 + (e.offset ?? 0)));

  it('with no lead it is the very same table', () => {
    expect(wavesFor(WAVES, 0)).toBe(WAVES);
    expect(createWorld(1, 'easy').waves).toBe(WAVES);
    expect(createWorld(1, 'normal').waves).toBe(WAVES);
  });

  it('hard brings each new enemy type 20 % earlier', () => {
    const waves = createWorld(1, 'hard').waves;
    const lead = DIFFICULTIES.hard.introLead;
    for (const id of ['delivery', 'frozen', 'cart', 'cashier'] as const) {
      expect(firstStart(waves, id)).toBeCloseTo(firstStart(WAVES, id) * (1 - lead), 9);
    }
    expect(firstStart(waves, 'client')).toBe(0);
    expect(firstStart(waves, 'frozen')).toBeCloseTo(144, 9);
  });

  it('leaves no gap: every minute from the early start to the original one has a row', () => {
    const waves = wavesFor(WAVES, 0.2);
    for (const id of ['delivery', 'frozen', 'cart', 'cashier'] as const) {
      const from = Math.floor(firstStart(waves, id) / 60);
      for (let m = from; m < 10; m++) {
        expect(waves.some((e) => e.enemyId === id && e.minute === m)).toBe(true);
      }
    }
  });

  it('keeps the rest of the table and does not touch WAVES', () => {
    const before = JSON.stringify(WAVES);
    const waves = wavesFor(WAVES, 0.2);
    expect(JSON.stringify(WAVES)).toBe(before);
    expect(waves.length).toBeGreaterThan(WAVES.length);
    // Later rows of the same enemy are unchanged.
    expect(waves.filter((e) => e.enemyId === 'cashier' && e.minute === 8)).toEqual(
      WAVES.filter((e) => e.enemyId === 'cashier' && e.minute === 8),
    );
  });

  it('the spawner uses the early rows: a Frozen appears before 3:00 on hard', () => {
    const w = emptyWorld(1, 'hard');
    w.time = 150;
    for (let t = 0; t < 20; t += FIXED_STEP) {
      spawnSystem(w, FIXED_STEP);
      w.time += FIXED_STEP;
    }
    let frozen = 0;
    for (let i = 0; i < w.enemies.count; i++) if (w.enemies.items[i]?.def.id === 'frozen') frozen++;
    expect(frozen).toBeGreaterThan(0);
  });
});
