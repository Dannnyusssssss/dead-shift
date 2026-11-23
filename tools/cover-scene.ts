import { createRng } from '../src/core/rng';
import { COVER } from '../src/data/cover';
import { ENEMIES, type EnemyId } from '../src/data/enemies';
import { PLAYER_BASE } from '../src/data/player';
import { circleRectPush, createPush, nearShelves, queryShelves } from '../src/game/shelves';

export interface CoverZombie {
  x: number;
  y: number;
  /** Facing, radians (toward the player). */
  angle: number;
  id: EnemyId;
  /** Distance to the player, px. */
  dist: number;
}

export interface CoverScene {
  player: { x: number; y: number };
  /** Unit vector the player faces (toward the horde). */
  facing: { x: number; y: number };
  /** Sorted by y, so lower zombies are drawn on top. */
  zombies: CoverZombie[];
  labels: { x: number; y: number; angle: number }[];
}

const push = createPush();

/** True if a circle at (x, y) overlaps any shelf of the map. */
export function hitsShelf(x: number, y: number, r: number, seed: number): boolean {
  const n = queryShelves(x - r, y - r, x + r, y + r, seed);
  for (let i = 0; i < n; i++) {
    const rect = nearShelves[i];
    if (rect && circleRectPush(x, y, r, rect, push)) return true;
  }
  return false;
}

/** The free spot (no shelf within `r`) closest to (x, y), searched on rings of a grid. */
export function nearestFree(
  x: number,
  y: number,
  r: number,
  seed: number,
): { x: number; y: number } {
  const step = COVER.freeSearchStep;
  for (let d = 0; d <= COVER.freeSearchRadius; d += step) {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const px = x + Math.cos(ang) * d;
      const py = y + Math.sin(ang) * d;
      if (!hitsShelf(px, py, r, seed)) return { x: px, y: py };
    }
  }
  return { x, y };
}

/**
 * Lays out the cover: the player in an aisle, the horde fanned out toward him (never inside a
 * shelf or overlapping another zombie) and a few price labels flying at the closest ones.
 * Deterministic for a given pair of seeds.
 */
export function buildCoverScene(
  mapSeed: number = COVER.mapSeed,
  sceneSeed: number = COVER.sceneSeed,
): CoverScene {
  const rng = createRng(sceneSeed);
  const pr = PLAYER_BASE.radius;
  const player = nearestFree(COVER.playerTarget.x, COVER.playerTarget.y, pr * 2, mapSeed);
  const facing = { x: Math.cos(COVER.hordeAngle), y: Math.sin(COVER.hordeAngle) };

  const zombies: CoverZombie[] = [];
  const fits = (x: number, y: number, r: number): boolean => {
    if (hitsShelf(x, y, r, mapSeed)) return false;
    if (Math.hypot(x - player.x, y - player.y) < pr + r + COVER.hordeMinDist / 2) return false;
    for (const z of zombies) {
      const zr = ENEMIES[z.id].radius;
      if (Math.hypot(x - z.x, y - z.y) < r + zr + COVER.zombieGap) return false;
    }
    return true;
  };
  const add = (id: EnemyId, x: number, y: number): void => {
    const dist = Math.hypot(x - player.x, y - player.y);
    zombies.push({ x, y, id, dist, angle: Math.atan2(player.y - y, player.x - x) });
  };

  const boss = COVER.boss;
  const bossAng = COVER.hordeAngle + boss.angleOffset;
  const bossSpot = nearestFree(
    player.x + Math.cos(bossAng) * boss.dist,
    player.y + Math.sin(bossAng) * boss.dist,
    ENEMIES[boss.id].radius,
    mapSeed,
  );
  add(boss.id, bossSpot.x, bossSpot.y);

  const mix = COVER.hordeMix;
  for (let i = 0; i < COVER.hordeCount; i++) {
    const id = mix[rng.int(0, mix.length - 1)] ?? 'client';
    const r = ENEMIES[id].radius;
    for (let tries = 0; tries < COVER.placeAttempts; tries++) {
      const ang = COVER.hordeAngle + rng.range(-COVER.hordeSpread / 2, COVER.hordeSpread / 2);
      // Square root spreads them evenly over the fan instead of bunching them near the player.
      const t = Math.sqrt(rng.next());
      const d = COVER.hordeMinDist + t * (COVER.hordeMaxDist - COVER.hordeMinDist);
      const x = player.x + Math.cos(ang) * d;
      const y = player.y + Math.sin(ang) * d;
      if (fits(x, y, r)) {
        add(id, x, y);
        break;
      }
    }
  }

  const closest = [...zombies].sort((a, b) => a.dist - b.dist).slice(0, COVER.labelCount);
  const labels = closest.map((z, i) => {
    const angle = Math.atan2(z.y - player.y, z.x - player.x);
    const along = Math.min(
      z.dist - ENEMIES[z.id].radius - 6,
      pr * 2 + COVER.labelSpacing * (i + 1),
    );
    return {
      x: player.x + Math.cos(angle) * along,
      y: player.y + Math.sin(angle) * along,
      angle,
    };
  });

  zombies.sort((a, b) => a.y - b.y);
  return { player, facing, zombies, labels };
}
