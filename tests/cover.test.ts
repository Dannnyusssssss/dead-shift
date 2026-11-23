import { describe, expect, it } from 'vitest';
import { COVER } from '../src/data/cover';
import { ENEMIES } from '../src/data/enemies';
import { PLAYER_BASE } from '../src/data/player';
import { buildCoverScene, hitsShelf } from '../tools/cover-scene';

describe('cover scene', () => {
  const scene = buildCoverScene();

  it('is deterministic for the same seeds', () => {
    expect(buildCoverScene()).toEqual(scene);
  });

  it('places the player in an aisle, never inside a shelf', () => {
    expect(hitsShelf(scene.player.x, scene.player.y, PLAYER_BASE.radius, COVER.mapSeed)).toBe(
      false,
    );
  });

  it('places the boss and most of the horde, none inside a shelf or overlapping', () => {
    expect(scene.zombies.some((z) => z.id === COVER.boss.id)).toBe(true);
    expect(scene.zombies.length).toBeGreaterThan(COVER.hordeCount * 0.6);
    for (const z of scene.zombies) {
      expect(hitsShelf(z.x, z.y, ENEMIES[z.id].radius, COVER.mapSeed)).toBe(false);
    }
    const horde = scene.zombies.filter((z) => z.id !== COVER.boss.id);
    for (let i = 0; i < horde.length; i++) {
      for (let j = i + 1; j < horde.length; j++) {
        const a = horde[i]!;
        const b = horde[j]!;
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - ENEMIES[a.id].radius - ENEMIES[b.id].radius;
        expect(gap).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('turns every zombie toward the player', () => {
    for (const z of scene.zombies) {
      const toPlayer = Math.atan2(scene.player.y - z.y, scene.player.x - z.x);
      expect(Math.abs(Math.cos(z.angle - toPlayer) - 1)).toBeLessThan(1e-9);
    }
  });

  it('sends the labels from the player toward the horde', () => {
    expect(scene.labels).toHaveLength(COVER.labelCount);
    for (const l of scene.labels) {
      const d = Math.hypot(l.x - scene.player.x, l.y - scene.player.y);
      expect(d).toBeGreaterThan(PLAYER_BASE.radius);
    }
  });
});
