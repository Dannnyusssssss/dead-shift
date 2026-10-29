import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { COMBAT } from '../src/data/combat';
import { ENEMIES } from '../src/data/enemies';
import { SHELF_COLLISION, SHELF_LAYOUT, TILE_SIZE } from '../src/data/map';
import { COUPONS } from '../src/data/progression';
import { WEAPONS, type GunLevel, type TurretLevel } from '../src/data/weapons';
import {
  CHARGE_STATE,
  enemyBehaviorSystem,
  enemyMovementSystem,
  spawnEnemy,
  type Enemy,
} from '../src/game/enemies';
import { hazardSystem, throwReceipt } from '../src/game/hazards';
import { manualWeaponSystem, selectManual } from '../src/game/manual';
import { dropChest } from '../src/game/pickups';
import { chooseOffer } from '../src/game/progression';
import { projectileSystem, spawnProjectile } from '../src/game/projectiles';
import {
  BLOCK_H,
  BLOCK_W,
  circleHitsShelf,
  circleRectPush,
  createPush,
  createRect,
  shelfInBlock,
  type Rect,
} from '../src/game/shelves';
import { separationSystem, spatialIndexSystem } from '../src/game/systems/collision';
import { shelfCollisionSystem } from '../src/game/systems/shelves';
import { placeTurret } from '../src/game/turrets';
import { updateWorld, type World } from '../src/game/world';
import { addClient, botPickOffer, emptyWorld, playerBot } from './helpers';

/** Overlap below this counts as touching, not inside (float noise), px. */
const EPS = 0.01;

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

/** First shelf at least `minTiles` long, searching blocks around the origin. */
function findShelf(seed: number, minTiles = 4): Rect {
  const r = createRect();
  for (let by = 0; by < 20; by++) {
    for (let bx = 0; bx < 20; bx++) {
      if (shelfInBlock(bx, by, seed, r) && r.w >= minTiles * TILE_SIZE) return r;
    }
  }
  throw new Error('no shelf found');
}

function shelvesIn(seed: number, radius: number): Rect[] {
  const out: Rect[] = [];
  for (let by = -radius; by <= radius; by++) {
    for (let bx = -radius; bx <= radius; bx++) {
      const r = createRect();
      if (shelfInBlock(bx, by, seed, r)) out.push(r);
    }
  }
  return out;
}

function gapBetween(a: Rect, b: Rect): number {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h));
  return Math.hypot(dx, dy);
}

const insideShelf = (world: World, x: number, y: number, r: number): boolean =>
  circleHitsShelf(x, y, r - EPS, world.seed);

/** The systems that move enemies and resolve shelves, without spawns or weapons. */
function stepCrowd(world: World): void {
  enemyBehaviorSystem(world, FIXED_STEP);
  enemyMovementSystem(world, FIXED_STEP);
  spatialIndexSystem(world);
  separationSystem(world);
  shelfCollisionSystem(world, FIXED_STEP);
  world.time += FIXED_STEP;
}

describe('circleRectPush', () => {
  const r = rect(0, 0, 100, 40);
  const out = createPush();

  it('ignores a circle that does not reach the rectangle (or only touches it)', () => {
    expect(circleRectPush(50, -20, 10, r, out)).toBe(false);
    expect(circleRectPush(50, -10, 10, r, out)).toBe(false);
    expect(circleRectPush(130, 60, 10, r, out)).toBe(false);
  });

  it('pushes out along the face it overlaps', () => {
    expect(circleRectPush(50, -6, 10, r, out)).toBe(true);
    expect(out).toMatchObject({ x: 50, y: -10, nx: 0, ny: -1 });
    expect(out.depth).toBeCloseTo(4);
    expect(circleRectPush(105, 20, 10, r, out)).toBe(true);
    expect(out).toMatchObject({ x: 110, y: 20, nx: 1, ny: 0 });
    expect(circleRectPush(-5, 20, 10, r, out)).toBe(true);
    expect(out).toMatchObject({ x: -10, nx: -1 });
    expect(circleRectPush(50, 45, 10, r, out)).toBe(true);
    expect(out).toMatchObject({ y: 50, ny: 1 });
  });

  it('pushes diagonally away from a corner', () => {
    expect(circleRectPush(105, 45, 10, r, out)).toBe(true);
    expect(out.nx).toBeCloseTo(Math.SQRT1_2);
    expect(out.ny).toBeCloseTo(Math.SQRT1_2);
    expect(Math.hypot(out.x - 100, out.y - 40)).toBeCloseTo(10);
  });

  it('a center inside leaves through the nearest edge', () => {
    expect(circleRectPush(50, 5, 10, r, out)).toBe(true);
    expect(out).toMatchObject({ x: 50, y: -10, nx: 0, ny: -1 });
    expect(circleRectPush(97, 20, 10, r, out)).toBe(true);
    expect(out).toMatchObject({ x: 110, y: 20, nx: 1, ny: 0 });
    expect(circleRectPush(50, 38, 10, r, out)).toBe(true);
    expect(out.y).toBe(50);
  });
});

describe('shelf layout', () => {
  it('is deterministic per seed and changes with the seed', () => {
    const a = shelvesIn(7, 6);
    expect(shelvesIn(7, 6)).toEqual(a);
    expect(shelvesIn(8, 6)).not.toEqual(a);
    expect(a.length).toBeGreaterThan(0);
  });

  it('keeps every shelf inside its block, clear of the side margins', () => {
    const margin = SHELF_LAYOUT.marginTiles * TILE_SIZE;
    const r = createRect();
    for (let by = -10; by <= 10; by++) {
      for (let bx = -10; bx <= 10; bx++) {
        if (!shelfInBlock(bx, by, 3, r)) continue;
        expect(r.x).toBeGreaterThanOrEqual(bx * BLOCK_W + margin);
        expect(r.x + r.w).toBeLessThanOrEqual((bx + 1) * BLOCK_W - margin);
        expect(r.y).toBeGreaterThan(by * BLOCK_H);
        expect(r.y + r.h).toBeLessThan((by + 1) * BLOCK_H);
        expect(r.h).toBe(SHELF_LAYOUT.depth);
      }
    }
  });

  it('leaves aisles of at least 80 px between shelves', () => {
    let minGap = Infinity;
    for (const seed of [1, 2, 3, 99, 2024]) {
      const all = shelvesIn(seed, 12);
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          minGap = Math.min(minGap, gapBetween(all[i] as Rect, all[j] as Rect));
        }
      }
    }
    expect(minGap).toBeGreaterThanOrEqual(80);
  });

  it('never covers the player start, whatever the seed', () => {
    const player = emptyWorld().player;
    for (let seed = 0; seed < 500; seed++) {
      expect(circleHitsShelf(0, 0, player.radius, seed)).toBe(false);
    }
  });
});

describe('player against shelves', () => {
  it('cannot walk through a shelf', () => {
    const world = emptyWorld(1);
    const s = findShelf(1);
    const p = world.player;
    p.pos.x = s.x + s.w / 2;
    p.pos.y = s.y - 40;
    world.moveInput.y = 1;
    for (let i = 0; i < 120; i++) updateWorld(world, FIXED_STEP);
    expect(p.pos.y).toBeCloseTo(s.y - p.radius, 5);
  });

  it('one left overlapping a shelf is pushed to the nearest free edge', () => {
    const world = emptyWorld(1);
    const s = findShelf(1);
    const p = world.player;
    p.pos.x = s.x + 30;
    p.pos.y = s.y + s.h - 5;
    shelfCollisionSystem(world, FIXED_STEP);
    expect(p.pos.x).toBe(s.x + 30);
    expect(p.pos.y).toBeCloseTo(s.y + s.h + p.radius);
  });
});

describe('spawns never land inside a shelf', () => {
  it('wave spawns over a long stretch of the shift', () => {
    const world = emptyWorld(5);
    world.player.invincible = true;
    // Late enough for every enemy type, and the boss.
    world.time = 290;
    let checked = 0;
    for (let i = 0; i < 60 * 90; i++) {
      if (world.status === 'levelup') chooseOffer(world, 0);
      // Walk in a wide circle so spawns sample many blocks.
      const a = i / 600;
      world.moveInput.x = Math.cos(a);
      world.moveInput.y = Math.sin(a);
      updateWorld(world, FIXED_STEP);
      for (let k = 0; k < world.enemies.count; k++) {
        const e = world.enemies.items[k] as Enemy;
        expect(insideShelf(world, e.pos.x, e.pos.y, e.radius)).toBe(false);
        checked++;
      }
      expect(insideShelf(world, world.player.pos.x, world.player.pos.y, world.player.radius)).toBe(
        false,
      );
    }
    expect(checked).toBeGreaterThan(10_000);
  }, 60_000);

  it('an enemy spawned on top of a shelf is moved out', () => {
    const world = emptyWorld(1);
    const s = findShelf(1);
    const e = spawnEnemy(world, ENEMIES.frozen, s.x + s.w / 2, s.y + s.h / 2);
    if (!e) throw new Error('no enemy');
    expect(insideShelf(world, e.pos.x, e.pos.y, e.radius)).toBe(false);
    expect(e.prevPos).toEqual(e.pos);
  });

  it('boss minions, microwaves and chests', () => {
    const world = emptyWorld(1);
    const s = findShelf(1, 6);
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const boss = spawnEnemy(world, ENEMIES.manager, cx, s.y - 60);
    if (!boss || boss.def.behavior.kind !== 'boss') throw new Error('no boss');
    boss.aiTimer = 0;
    enemyBehaviorSystem(world, FIXED_STEP);
    expect(world.enemies.count).toBe(1 + boss.def.behavior.summonCount);
    for (let k = 0; k < world.enemies.count; k++) {
      const e = world.enemies.items[k] as Enemy;
      expect(insideShelf(world, e.pos.x, e.pos.y, e.radius)).toBe(false);
    }

    const stats = WEAPONS.microwave.levels[0] as TurretLevel;
    const t = placeTurret(world, cx, cy, stats, 0);
    if (!t) throw new Error('no turret');
    expect(insideShelf(world, t.pos.x, t.pos.y, COMBAT.turretRadius)).toBe(false);

    dropChest(world, cx, cy);
    const c = world.chests.items[0];
    if (!c) throw new Error('no chest');
    expect(insideShelf(world, c.pos.x, c.pos.y, COUPONS.chestRadius)).toBe(false);
  });
});

describe('zombies get around shelves', () => {
  it('a zombie with the player right behind a shelf slides around it and reaches him', () => {
    const world = emptyWorld(1);
    world.player.invincible = true;
    const s = findShelf(1, 5);
    const p = world.player;
    p.pos.x = s.x + s.w / 2;
    p.pos.y = s.y + s.h + 40;
    const e = addClient(world, p.pos.x, s.y - 30);
    let reached = false;
    let maxStuck = 0;
    // The way around a 5+ tile shelf is ~470 px at 55 px/s.
    for (let i = 0; i < 60 * 12 && !reached; i++) {
      stepCrowd(world);
      maxStuck = Math.max(maxStuck, e.stuckTimer);
      expect(insideShelf(world, e.pos.x, e.pos.y, e.radius)).toBe(false);
      reached = Math.hypot(p.pos.x - e.pos.x, p.pos.y - e.pos.y) <= e.radius + p.radius + 2;
    }
    expect(reached).toBe(true);
    expect(world.stuckRelocations).toBe(0);
    expect(maxStuck).toBeLessThan(SHELF_COLLISION.stuckTime);
  });

  it('one pinned against a shelf without progress is moved back to the ring', () => {
    const world = emptyWorld(1);
    const s = findShelf(1);
    const p = world.player;
    p.pos.x = s.x + s.w / 2;
    p.pos.y = s.y + s.h + SHELF_COLLISION.engagedDistance + 20;
    const e = addClient(world, p.pos.x, s.y - 30);
    // Held in place (as if wedged in by the crowd) while it keeps trying to walk to the player.
    let relocatedAfter = -1;
    for (let i = 0; i < 60 * 3 && relocatedAfter < 0; i++) {
      e.pos.x = p.pos.x;
      e.pos.y = s.y - e.radius + 1;
      e.vel.x = 0;
      e.vel.y = e.speed;
      e.approaching = true;
      shelfCollisionSystem(world, FIXED_STEP);
      if (world.stuckRelocations > 0) relocatedAfter = (i + 1) * FIXED_STEP;
    }
    expect(relocatedAfter).toBeGreaterThanOrEqual(SHELF_COLLISION.stuckTime - FIXED_STEP);
    expect(relocatedAfter).toBeLessThan(SHELF_COLLISION.stuckTime + 0.1);
    const d = Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y);
    expect(d).toBeGreaterThan(COMBAT.spawnRingMinRadius - 50);
    expect(e.stuckTimer).toBe(0);
  });

  it('a charging cart stops when it hits a shelf', () => {
    const world = emptyWorld(1);
    const s = findShelf(1);
    world.player.pos.x = s.x + s.w / 2;
    world.player.pos.y = s.y + s.h + 60;
    const cart = spawnEnemy(world, ENEMIES.cart, s.x + s.w / 2, s.y - 120);
    if (!cart) throw new Error('no cart');
    cart.aiState = CHARGE_STATE.charging;
    cart.aiTimer = 10;
    cart.aiDir.x = 0;
    cart.aiDir.y = 1;
    for (let i = 0; i < 60 && cart.aiState === CHARGE_STATE.charging; i++) stepCrowd(world);
    expect(cart.aiState).toBe(CHARGE_STATE.recover);
    expect(cart.pos.y).toBeLessThanOrEqual(s.y - cart.radius + EPS);
  });
});

describe('what shelves block', () => {
  it('stop the player shots', () => {
    const world = emptyWorld(1);
    const s = findShelf(1);
    const x = s.x + s.w / 2;
    const target = addClient(world, x, s.y + s.h + 30);
    const stats = WEAPONS.labelGun.levels[0] as GunLevel;
    spawnProjectile(world, x, s.y - 40, Math.PI / 2, stats, 'label', 0);
    for (let i = 0; i < 60; i++) {
      spatialIndexSystem(world);
      projectileSystem(world, FIXED_STEP);
    }
    expect(world.projectiles.count).toBe(0);
    expect(target.hp).toBe(target.maxHp);
    const types = world.events.items.slice(0, world.events.count).map((ev) => ev.type);
    expect(types).toContain('shelfHit');
  });

  it('make receipts explode against them', () => {
    const world = emptyWorld(1);
    const s = findShelf(1);
    const x = s.x + s.w / 2;
    throwReceipt(world, x, s.y - 100, x, s.y + s.h + 100, 260, 45, 8);
    const receipt = world.hazards.items[0];
    if (!receipt) throw new Error('no receipt');
    for (let i = 0; i < 60 && world.hazards.count > 0; i++) hazardSystem(world, FIXED_STEP);
    expect(world.hazards.count).toBe(0);
    expect(receipt.pos.y).toBeLessThan(s.y);
    expect(receipt.pos.y).toBeGreaterThan(s.y - 10);
  });

  it('do not block a broom swing', () => {
    const world = emptyWorld(1);
    const s = findShelf(1);
    const p = world.player;
    p.pos.x = s.x + s.w / 2;
    p.pos.y = s.y - p.radius;
    const e = addClient(world, p.pos.x, s.y + s.h + 12);
    selectManual(p.manual, 'melee');
    world.aimActive = true;
    world.aim.x = 0;
    world.aim.y = 1;
    world.triggerHeld = true;
    spatialIndexSystem(world);
    manualWeaponSystem(world, FIXED_STEP);
    expect(e.hp).toBeLessThan(e.maxHp);
  });
});

describe('a full simulated shift', () => {
  it('no zombie stays stuck against a shelf and none ends up inside one', () => {
    const world = emptyWorld(11);
    world.player.invincible = true;
    let maxStuck = 0;
    const limit = Math.round(600 / FIXED_STEP) + 10;
    for (let i = 0; i < limit && world.status !== 'won'; i++) {
      if (world.status === 'levelup') chooseOffer(world, botPickOffer(world));
      playerBot(world);
      updateWorld(world, FIXED_STEP);
      for (let k = 0; k < world.enemies.count; k++) {
        const e = world.enemies.items[k] as Enemy;
        maxStuck = Math.max(maxStuck, e.stuckTimer);
        if (insideShelf(world, e.pos.x, e.pos.y, e.radius)) throw new Error('enemy inside a shelf');
      }
    }
    expect(world.status).toBe('won');
    expect(maxStuck).toBeLessThan(SHELF_COLLISION.stuckTime);
    // Relocations are a rare fallback: far fewer than the zombies that appear in a shift.
    expect(world.stuckRelocations).toBeLessThan(world.kills / 10);
  }, 60_000);
});
