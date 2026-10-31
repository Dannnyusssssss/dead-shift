import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { ENEMIES } from '../src/data/enemies';
import { SHELF_COLLISION, TILE_SIZE } from '../src/data/map';
import { WAVES } from '../src/data/waves';
import { WEAPON_IDS, type WeaponId } from '../src/data/weapons';
import {
  enemyBehaviorSystem,
  enemyMovementSystem,
  spawnEnemy,
  type Enemy,
} from '../src/game/enemies';
import { wavesFor } from '../src/game/difficulty';
import { chooseOffer } from '../src/game/progression';
import { projectileSystem, spawnProjectile } from '../src/game/projectiles';
import { circleHitsShelf, createRect, shelfInBlock, type Rect } from '../src/game/shelves';
import { separationSystem, spatialIndexSystem } from '../src/game/systems/collision';
import { damageTakenFrom, hitEnemy } from '../src/game/systems/damage';
import { shelfCollisionSystem } from '../src/game/systems/shelves';
import { statusSystem } from '../src/game/systems/status';
import { hitSector } from '../src/game/weapons';
import { updateWorld, type World } from '../src/game/world';
import { addClient, botPickOffer, emptyWorld, playerBot } from './helpers';

const GUARD = ENEMIES.guard;
const ARMOR = GUARD.autoDamageTaken ?? 1;
const src = (id: WeaponId): number => WEAPON_IDS.indexOf(id);

function guard(world: World, x: number, y: number): Enemy {
  const e = spawnEnemy(world, GUARD, x, y);
  if (!e) throw new Error('pool full');
  return e;
}

/** First shelf at least `minTiles` long, searching blocks around the origin. */
function findShelf(seed: number, minTiles: number): Rect {
  const r = createRect();
  for (let by = 0; by < 20; by++) {
    for (let bx = 0; bx < 20; bx++) {
      if (shelfInBlock(bx, by, seed, r) && r.w >= minTiles * TILE_SIZE) return r;
    }
  }
  throw new Error('no shelf found');
}

function stepCrowd(world: World): void {
  enemyBehaviorSystem(world, FIXED_STEP);
  enemyMovementSystem(world, FIXED_STEP);
  spatialIndexSystem(world);
  separationSystem(world);
  shelfCollisionSystem(world, FIXED_STEP);
  world.time += FIXED_STEP;
}

describe('guard: data', () => {
  it('is immune to knockback, armored against automatic weapons and plows through', () => {
    expect(GUARD.knockbackResist).toBe(1);
    expect(ARMOR).toBeGreaterThan(0);
    expect(ARMOR).toBeLessThan(1);
    expect(GUARD.plowsThrough).toBe(true);
  });

  it('only comes in the last minutes of the shift', () => {
    const first = Math.min(
      ...WAVES.filter((w) => w.enemyId === 'guard').map((w) => w.minute * 60 + (w.offset ?? 0)),
    );
    expect(first).toBe(420);
    // Hard brings every enemy in 20 % earlier, the guard too.
    const hard = wavesFor(WAVES, 0.2).filter((w) => w.enemyId === 'guard');
    expect(Math.min(...hard.map((w) => w.minute * 60 + (w.offset ?? 0)))).toBe(336);
  });
});

describe('guard: armor', () => {
  it('manual weapons do full damage, automatic ones a fraction', () => {
    const world = emptyWorld();
    const g = guard(world, 100, 0);
    for (const id of ['labelGun', 'broom', 'shotgun'] as const)
      expect(damageTakenFrom(g, src(id))).toBe(1);
    for (const id of ['cans', 'ice', 'aerosol', 'microwave'] as const)
      expect(damageTakenFrom(g, src(id))).toBe(ARMOR);
    // Unknown sources (debug, tests) do full damage.
    expect(damageTakenFrom(g, -1)).toBe(1);
  });

  it('other zombies take full damage from everything', () => {
    const world = emptyWorld();
    const c = addClient(world, 100, 0);
    expect(damageTakenFrom(c, src('cans'))).toBe(1);
  });

  it('hits are reduced and flagged in the damage numbers', () => {
    const world = emptyWorld();
    const g = guard(world, 100, 0);
    const hp = g.hp;
    hitEnemy(world, g, 10, 0, 0, src('microwave'));
    expect(g.hp).toBeCloseTo(hp - 10 * ARMOR);
    hitEnemy(world, g, 10, 0, 0, src('labelGun'));
    expect(g.hp).toBeCloseTo(hp - 10 * ARMOR - 10);
    expect(world.hits.items[0]?.armored).toBe(true);
    expect(world.hits.items[0]?.amount).toBeCloseTo(10 * ARMOR);
    expect(world.hits.items[1]?.armored).toBe(false);
  });

  it('aerosol poison is reduced, the incendiary pistol burn is not', () => {
    const world = emptyWorld();
    const g = guard(world, 50, 0);
    spatialIndexSystem(world);
    hitSector(world, 0, 0, 0, 1, 100, 0, 0, src('aerosol'), 10, 1);
    expect(g.poisonDps).toBeCloseTo(10 * ARMOR);

    const world2 = emptyWorld();
    const g2 = guard(world2, 60, 0);
    spawnProjectile(
      world2,
      0,
      0,
      0,
      {
        damage: 1,
        cooldown: 1,
        count: 1,
        pierce: 0,
        spreadDegrees: 0,
        speed: 600,
        radius: 4,
        lifetime: 1,
        knockback: 0,
        burnDps: 10,
        burnTime: 1,
      },
      'label',
      src('labelGun'),
    );
    for (let i = 0; i < 20; i++) {
      spatialIndexSystem(world2);
      projectileSystem(world2, FIXED_STEP);
    }
    expect(g2.poisonDps).toBe(10);
    statusSystem(world2, 0.5);
    expect(g2.hp).toBeCloseTo(g2.maxHp - 1 - 5);
  });

  it('knockback never moves it', () => {
    const world = emptyWorld();
    const g = guard(world, 100, 0);
    hitEnemy(world, g, 1, 900, 900, src('shotgun'));
    expect(g.knockback.x).toBe(0);
    expect(g.knockback.y).toBe(0);
  });
});

describe('guard: plows through the horde', () => {
  it('overlapping zombies get pushed aside and the guard keeps its place', () => {
    const world = emptyWorld();
    const g = guard(world, 0, 300);
    const c = addClient(world, 10, 300);
    spatialIndexSystem(world);
    separationSystem(world);
    expect(g.pos.x).toBe(0);
    expect(g.pos.y).toBe(300);
    expect(c.pos.x).toBeGreaterThan(10);
  });

  it('two guards share the push like any other pair', () => {
    const world = emptyWorld();
    const a = guard(world, 0, 300);
    const b = guard(world, 10, 300);
    spatialIndexSystem(world);
    separationSystem(world);
    expect(a.pos.x).toBeLessThan(0);
    expect(b.pos.x).toBeGreaterThan(10);
    expect(a.pos.x + b.pos.x).toBeCloseTo(10);
  });
});

describe('guard: shelves', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`with the player behind a long shelf it goes around and reaches him (seed ${seed})`, () => {
      const world = emptyWorld(seed);
      world.player.invincible = true;
      const s = findShelf(seed, 5);
      const p = world.player;
      p.pos.x = s.x + s.w / 2;
      p.pos.y = s.y + s.h + 40;
      const g = guard(world, p.pos.x, s.y - 30);
      let reached = false;
      let maxStuck = 0;
      // The way around a 5+ tile shelf is ~500 px at 50 px/s.
      for (let i = 0; i < 60 * 14 && !reached; i++) {
        stepCrowd(world);
        maxStuck = Math.max(maxStuck, g.stuckTimer);
        expect(circleHitsShelf(g.pos.x, g.pos.y, g.radius - 0.01, world.seed)).toBe(false);
        reached = Math.hypot(p.pos.x - g.pos.x, p.pos.y - g.pos.y) <= g.radius + p.radius + 2;
      }
      expect(reached).toBe(true);
      expect(world.stuckRelocations).toBe(0);
      expect(maxStuck).toBeLessThan(SHELF_COLLISION.stuckTime);
    });
  }

  it('pushing a crowd against a shelf does not wedge it there', () => {
    const world = emptyWorld(1);
    world.player.invincible = true;
    const s = findShelf(1, 5);
    const p = world.player;
    p.pos.x = s.x + s.w / 2;
    p.pos.y = s.y + s.h + 40;
    // A wall of clients between the guard and the shelf.
    for (let k = -3; k <= 3; k++) addClient(world, p.pos.x + k * 22, s.y - 14);
    const g = guard(world, p.pos.x, s.y - 50);
    let maxStuck = 0;
    let reached = false;
    for (let i = 0; i < 60 * 16 && !reached; i++) {
      stepCrowd(world);
      maxStuck = Math.max(maxStuck, g.stuckTimer);
      reached = Math.hypot(p.pos.x - g.pos.x, p.pos.y - g.pos.y) <= g.radius + p.radius + 2;
    }
    expect(reached).toBe(true);
    expect(maxStuck).toBeLessThan(SHELF_COLLISION.stuckTime);
  });

  it('a full shift: guards never stay stuck nor end up inside a shelf', () => {
    const world = emptyWorld(11);
    world.player.invincible = true;
    let guards = 0;
    let maxStuck = 0;
    const seen = new Set<Enemy>();
    const limit = Math.round(600 / FIXED_STEP) + 10;
    for (let i = 0; i < limit && world.status !== 'won'; i++) {
      if (world.status === 'levelup') chooseOffer(world, botPickOffer(world));
      playerBot(world);
      updateWorld(world, FIXED_STEP);
      for (let k = 0; k < world.enemies.count; k++) {
        const e = world.enemies.items[k] as Enemy;
        if (e.def.id !== 'guard') continue;
        if (!seen.has(e)) {
          seen.add(e);
          guards++;
        }
        maxStuck = Math.max(maxStuck, e.stuckTimer);
        if (circleHitsShelf(e.pos.x, e.pos.y, e.radius - 0.01, world.seed))
          throw new Error('guard inside a shelf');
      }
    }
    expect(world.status).toBe('won');
    expect(guards).toBeGreaterThan(0);
    expect(maxStuck).toBeLessThan(SHELF_COLLISION.stuckTime);
  }, 60_000);
});
