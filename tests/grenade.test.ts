import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { WEAPONS } from '../src/data/weapons';
import { EVOLVED_LEVEL } from '../src/game/evolutions';
import type { Enemy } from '../src/game/enemies';
import type { GameEventType } from '../src/game/events';
import { projectileSystem, spawnProjectile } from '../src/game/projectiles';
import { queryShelves } from '../src/game/shelves';
import { spatialIndexSystem } from '../src/game/systems/collision';
import { createWeapon, statsAt, weaponSystem } from '../src/game/weapons';
import type { World } from '../src/game/world';
import { addClient, emptyWorld } from './helpers';

const cansDef = WEAPONS.cans;
if (cansDef.behavior !== 'projectile') throw new Error('unexpected cans behavior');
const GRENADE = statsAt(cansDef.levels, EVOLVED_LEVEL);
const RADIUS = GRENADE.explosionRadius ?? 0;
const BLAST = GRENADE.explosionDamage ?? 0;
const HP = 10_000;
/** Flight time of a can, in fixed steps, plus some slack. */
const FLIGHT_STEPS = Math.ceil(GRENADE.lifetime / FIXED_STEP) + 10;

/** First seed whose shelves leave the box completely free (an open floor for the test). */
function openSeed(minX: number, minY: number, maxX: number, maxY: number): number {
  for (let seed = 1; seed < 10_000; seed++) {
    if (queryShelves(minX, minY, maxX, maxY, seed) === 0) return seed;
  }
  throw new Error('no open seed');
}

/** Huge hp so nothing dies and damage can be measured. */
function tank(world: World, x: number, y: number): Enemy {
  const e = addClient(world, x, y);
  e.hp = e.maxHp = HP;
  return e;
}

function countEvents(world: World, type: GameEventType): number {
  let n = 0;
  for (let i = 0; i < world.events.count; i++) if (world.events.items[i]?.type === type) n++;
  return n;
}

function fly(world: World, steps = FLIGHT_STEPS): void {
  for (let i = 0; i < steps && world.projectiles.count > 0; i++) {
    spatialIndexSystem(world);
    projectileSystem(world, FIXED_STEP);
  }
}

describe('grenade cans', () => {
  it('a can that touches nothing still explodes at the end of its flight', () => {
    const reach = GRENADE.speed * GRENADE.lifetime;
    const world = emptyWorld(openSeed(-100, -150, reach + 150, 150));
    // A zombie waiting where the can comes down, off its straight path.
    const waiting = tank(world, reach, RADIUS - 20);
    spawnProjectile(world, 0, 0, 0, GRENADE, 'can', 1);
    fly(world);
    expect(world.projectiles.count).toBe(0);
    expect(countEvents(world, 'canExplosion')).toBe(1);
    expect(waiting.hp).toBeLessThan(HP);
  });

  it('every can of a volley explodes', () => {
    // Shelves are fine here: a can that hits one explodes too.
    const world = emptyWorld();
    const w = createWeapon('cans');
    w.level = EVOLVED_LEVEL;
    world.player.weapons = [w];
    tank(world, 250, 0);
    spatialIndexSystem(world);
    weaponSystem(world, FIXED_STEP);
    expect(world.projectiles.count).toBe(GRENADE.count);
    fly(world);
    expect(countEvents(world, 'canExplosion')).toBe(GRENADE.count);
  });

  it('a volley lands around its target instead of flying past it', () => {
    const world = emptyWorld(openSeed(-20, -120, 380, 120));
    const w = createWeapon('cans');
    w.level = EVOLVED_LEVEL;
    world.player.weapons = [w];
    const target = tank(world, 300, 0);
    spatialIndexSystem(world);
    weaponSystem(world, FIXED_STEP);
    fly(world);
    let blasts = 0;
    for (let i = 0; i < world.events.count; i++) {
      const ev = world.events.items[i];
      if (ev?.type !== 'canExplosion') continue;
      blasts++;
      expect(Math.hypot(ev.x - target.pos.x, ev.y - target.pos.y)).toBeLessThanOrEqual(
        RADIUS * 1.5,
      );
    }
    expect(blasts).toBe(GRENADE.count);
  });

  it('the blast hits exactly the zombies inside its radius, even in a packed crowd', () => {
    const world = emptyWorld(openSeed(-200, -200, 400, 200));
    const crowd: Enemy[] = [];
    // A 20×20 grid with 8 px spacing around the impact point: 400 zombies (the hard cap).
    for (let gy = 0; gy < 20; gy++) {
      for (let gx = 0; gx < 20; gx++) crowd.push(tank(world, 30 + gx * 8, -76 + gy * 8));
    }
    const target = crowd.reduce((a, b) =>
      Math.hypot(a.pos.x - 106, a.pos.y) < Math.hypot(b.pos.x - 106, b.pos.y) ? a : b,
    );
    spawnProjectile(world, 0, target.pos.y, 0, GRENADE, 'can', 1);
    fly(world);
    expect(countEvents(world, 'canExplosion')).toBe(1);
    const blast = world.events.items.find((ev) => ev.type === 'canExplosion');
    if (!blast) throw new Error('no blast');
    for (const e of crowd) {
      const inside = Math.hypot(e.pos.x - blast.x, e.pos.y - blast.y) <= RADIUS + e.radius;
      if (inside) expect(e.hp).toBeLessThan(HP);
      else if (e !== target) expect(e.hp).toBe(HP);
    }
  });

  it('reaches zombies pushed after the spatial index was built', () => {
    const world = emptyWorld(openSeed(-100, -150, 300, 150));
    const target = tank(world, 100, 0);
    const pushed = tank(world, 100, RADIUS + 10);
    spawnProjectile(world, 0, 0, 0, GRENADE, 'can', 1);
    for (let i = 0; i < FLIGHT_STEPS && world.projectiles.count > 0; i++) {
      spatialIndexSystem(world);
      // Separation and shelves move zombies after the index: here, 20 px into the blast.
      pushed.pos.y = RADIUS - 10;
      projectileSystem(world, FIXED_STEP);
    }
    expect(target.hp).toBeLessThan(HP);
    expect(pushed.hp).toBe(HP - BLAST);
  });

  it('damage at the edge of the radius, nothing beyond', () => {
    const world = emptyWorld(openSeed(-100, -200, 300, 200));
    const target = tank(world, 100, 0);
    // Blast center is where the can touches the target, a little short of it.
    const edge = tank(world, 100, RADIUS + 5);
    const beyond = tank(world, 100, -(RADIUS + 60));
    spawnProjectile(world, 0, 0, 0, GRENADE, 'can', 1);
    fly(world);
    expect(target.hp).toBe(HP - GRENADE.damage - BLAST);
    expect(edge.hp).toBe(HP - BLAST);
    expect(beyond.hp).toBe(HP);
  });

  it('explodes against a shelf and hurts the zombies next to it', () => {
    // Find a shelf right of the origin of some seed and throw the can into it.
    let seed = 1;
    for (; seed < 10_000; seed++) {
      if (queryShelves(-40, -40, 40, 40, seed) !== 0) continue;
      if (queryShelves(200, -5, 260, 5, seed) !== 0 && queryShelves(-40, -5, 199, 5, seed) === 0)
        break;
    }
    const world = emptyWorld(seed);
    spawnProjectile(world, 0, 0, 0, GRENADE, 'can', 1);
    fly(world, 1);
    const near = tank(world, 160, 0);
    fly(world);
    expect(countEvents(world, 'canExplosion')).toBe(1);
    expect(near.hp).toBeLessThan(HP);
  });

  it('kills in the blast are credited to the cans', () => {
    const world = emptyWorld(openSeed(-100, -150, 300, 150));
    const slot = WEAPONS_INDEX_CANS;
    const target = tank(world, 100, 0);
    const victim = addClient(world, 100, 30);
    victim.hp = 1;
    spawnProjectile(world, 0, 0, 0, GRENADE, 'can', slot);
    fly(world);
    expect(target.hp).toBeLessThan(HP);
    expect(victim.hp).toBeLessThanOrEqual(0);
    expect(victim.lastHitBy).toBe(slot);
  });
});

const WEAPONS_INDEX_CANS = 1;
