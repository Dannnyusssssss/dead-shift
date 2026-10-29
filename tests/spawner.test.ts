import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { COMBAT } from '../src/data/combat';
import { SHIFT } from '../src/data/shift';
import { BOSSES, WAVES } from '../src/data/waves';
import { chooseOffer } from '../src/game/progression';
import { spawnHorde, spawnRadiusForView, spawnSystem } from '../src/game/spawner';
import { updateWorld } from '../src/game/world';
import { emptyWorld, playerBot } from './helpers';

function runSpawner(seed: number, seconds: number) {
  const world = emptyWorld(seed);
  const steps = Math.round(seconds / FIXED_STEP);
  for (let i = 0; i < steps; i++) {
    spawnSystem(world, FIXED_STEP);
    world.time += FIXED_STEP;
  }
  return world;
}

describe('spawner', () => {
  it('is deterministic for a given seed', () => {
    const a = runSpawner(42, 10);
    const b = runSpawner(42, 10);
    expect(a.enemies.count).toBe(b.enemies.count);
    for (let i = 0; i < a.enemies.count; i++) {
      expect(a.enemies.items[i]?.pos).toEqual(b.enemies.items[i]?.pos);
    }
    const c = runSpawner(43, 10);
    expect(c.enemies.items[0]?.pos).not.toEqual(a.enemies.items[0]?.pos);
  });

  it('follows the minute-0 rate from the wave table', () => {
    const rate = WAVES.filter((w) => w.minute === 0).reduce(
      (sum, w) => sum + w.spawnPerSecond * w.groupSize,
      0,
    );
    const world = runSpawner(1, 10);
    expect(world.enemies.count).toBeGreaterThanOrEqual(Math.floor(rate * 10) - 1);
    expect(world.enemies.count).toBeLessThanOrEqual(Math.ceil(rate * 10));
  });

  it('spawns on the ring around the player', () => {
    const world = runSpawner(5, 20);
    const { x, y } = world.player.pos;
    for (let i = 0; i < world.enemies.count; i++) {
      const e = world.enemies.items[i];
      if (!e) continue;
      const d = Math.hypot(e.pos.x - x, e.pos.y - y);
      expect(d).toBeGreaterThanOrEqual(world.spawnRadius - COMBAT.groupSpread * 1.5);
      expect(d).toBeLessThanOrEqual(
        world.spawnRadius + COMBAT.spawnRingThickness + COMBAT.groupSpread * 1.5,
      );
    }
  });

  it('never exceeds the enemy cap', () => {
    const world = emptyWorld();
    spawnHorde(world, COMBAT.maxEnemies + 100);
    expect(world.enemies.count).toBe(COMBAT.maxEnemies);
    spawnSystem(world, 5);
    expect(world.enemies.count).toBe(COMBAT.maxEnemies);
  });

  it('relocates enemies left far behind', () => {
    const world = emptyWorld();
    spawnHorde(world, 1);
    world.player.pos.x = 10_000;
    spawnSystem(world, 0);
    const e = world.enemies.items[0];
    expect(e).toBeDefined();
    const d = Math.hypot((e?.pos.x ?? 0) - 10_000, e?.pos.y ?? 0);
    expect(d).toBeLessThanOrEqual(world.spawnRadius * COMBAT.relocateFactor);
  });

  it('sizes the ring to stay off-screen', () => {
    expect(spawnRadiusForView(400, 300)).toBe(COMBAT.spawnRingMinRadius);
    expect(spawnRadiusForView(2560, 1440)).toBeGreaterThan(Math.hypot(2560, 1440) / 2);
  });
});

interface SpawnRecord {
  time: number;
  id: string;
  x: number;
  y: number;
  hp: number;
}

/**
 * Runs only the spawner for the whole shift, removing every enemy right after it appears
 * (so the cap never interferes) and recording each spawn.
 */
function recordShift(seed: number): SpawnRecord[] {
  const world = emptyWorld(seed);
  const out: SpawnRecord[] = [];
  const steps = Math.round(SHIFT.durationSeconds / FIXED_STEP);
  for (let i = 0; i < steps; i++) {
    spawnSystem(world, FIXED_STEP);
    for (let k = world.enemies.count - 1; k >= 0; k--) {
      const e = world.enemies.items[k];
      if (e) out.push({ time: world.time, id: e.def.id, x: e.pos.x, y: e.pos.y, hp: e.maxHp });
      world.enemies.releaseAt(k);
    }
    world.time += FIXED_STEP;
  }
  return out;
}

describe('spawner over the whole shift', () => {
  const a = recordShift(2024);

  it('is fully deterministic with the same seed', () => {
    expect(recordShift(2024)).toEqual(a);
    expect(recordShift(2025)).not.toEqual(a);
  });

  it('introduces each enemy type on schedule', () => {
    const first = (id: string) => a.find((r) => r.id === id)?.time ?? Infinity;
    expect(first('client')).toBeLessThan(2);
    expect(first('delivery')).toBeGreaterThanOrEqual(90);
    expect(first('delivery')).toBeLessThan(110);
    expect(first('frozen')).toBeGreaterThanOrEqual(180);
    expect(first('cart')).toBeGreaterThanOrEqual(270);
    expect(first('cashier')).toBeGreaterThanOrEqual(360);
    expect(first('cashier')).toBeLessThan(380);
  });

  it('spawns each boss exactly once, on time, the second one stronger', () => {
    const bosses = a.filter((r) => r.id === 'manager');
    expect(bosses.map((b) => Math.round(b.time))).toEqual(BOSSES.map((b) => b.time));
    const [b1, b2] = bosses;
    expect(b2?.hp ?? 0).toBeGreaterThan((b1?.hp ?? 0) * 1.5);
  });

  it('scales hp by 8% per minute', () => {
    const late = a.find((r) => r.id === 'client' && r.time >= 300);
    expect(late?.hp).toBeCloseTo(20 * (1 + 0.08 * ((late?.time ?? 0) / 60)));
  });

  it('respects the cap for the whole shift and still spawns bosses when full', () => {
    const world = emptyWorld(9);
    let max = 0;
    let bosses = 0;
    const steps = Math.round(SHIFT.durationSeconds / FIXED_STEP);
    for (let i = 0; i < steps; i++) {
      spawnSystem(world, FIXED_STEP);
      max = Math.max(max, world.enemies.count);
      world.time += FIXED_STEP;
    }
    for (let i = 0; i < world.enemies.count; i++) {
      if (world.enemies.items[i]?.def.id === 'manager') bosses++;
    }
    expect(max).toBe(COMBAT.maxEnemies);
    expect(bosses).toBe(BOSSES.length);
  });
});

describe('full simulation', () => {
  it('a full 10-minute shift with pistol and broom can be survived and won at 6:00 AM', () => {
    const world = emptyWorld(11);
    world.player.invincible = true;
    let maxEnemies = 0;
    let steps = 0;
    let autoSwitches = 0;
    let returnsToGun = 0;
    let prev = world.player.manual.active;
    const limit = Math.round(SHIFT.durationSeconds / FIXED_STEP) + 10;
    while (world.status !== 'won' && world.status !== 'dead' && steps < limit) {
      if (world.status === 'levelup') chooseOffer(world, 0);
      playerBot(world);
      updateWorld(world, FIXED_STEP);
      const m = world.player.manual;
      if (prev === 'gun' && m.active === 'melee' && m.autoSwitched) autoSwitches++;
      if (prev === 'melee' && m.active === 'gun') returnsToGun++;
      prev = m.active;
      maxEnemies = Math.max(maxEnemies, world.enemies.count);
      steps++;
    }
    expect(world.status).toBe('won');
    expect(world.time).toBe(SHIFT.durationSeconds);
    expect(steps).toBe(Math.round(SHIFT.durationSeconds / FIXED_STEP));
    expect(maxEnemies).toBeLessThanOrEqual(COMBAT.maxEnemies);
    expect(world.kills).toBeGreaterThan(500);
    expect(world.player.level).toBeGreaterThan(10);
    // The gun ran dry at least once, the broom took over and ammo brought the gun back.
    expect(autoSwitches).toBeGreaterThan(0);
    expect(returnsToGun).toBeGreaterThan(0);
  }, 120_000);

  it('a player who never pulls the trigger eventually dies and the world freezes', () => {
    const world = emptyWorld(7);
    let steps = 0;
    while (world.status !== 'dead' && steps < 60 * 600) {
      if (world.status === 'levelup') chooseOffer(world, 0);
      updateWorld(world, FIXED_STEP);
      steps++;
    }
    expect(world.status).toBe('dead');
    const t = world.time;
    updateWorld(world, FIXED_STEP);
    expect(world.time).toBe(t);
  });
});
