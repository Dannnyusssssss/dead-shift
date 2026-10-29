import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { COMBAT } from '../src/data/combat';
import { WAVES } from '../src/data/waves';
import { chooseOffer } from '../src/game/progression';
import { spawnHorde, spawnRadiusForView, spawnSystem } from '../src/game/spawner';
import { updateWorld } from '../src/game/world';
import { emptyWorld } from './helpers';

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

describe('full simulation', () => {
  it('a standing player eventually dies and the world freezes', () => {
    const world = emptyWorld(7);
    let steps = 0;
    while (world.status !== 'dead' && steps < 60 * 600) {
      if (world.status === 'levelup') chooseOffer(world, 0);
      updateWorld(world, FIXED_STEP);
      steps++;
    }
    expect(world.status).toBe('dead');
    expect(world.kills).toBeGreaterThan(0);
    const t = world.time;
    updateWorld(world, FIXED_STEP);
    expect(world.time).toBe(t);
  });
});
