import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { ENEMIES, type EnemyId } from '../src/data/enemies';
import {
  CHARGE_STATE,
  enemyBehaviorSystem,
  enemyMovementSystem,
  spawnEnemy,
} from '../src/game/enemies';
import { hazardSystem } from '../src/game/hazards';
import { pickupSystem } from '../src/game/pickups';
import { chooseOffer, progressionSystem } from '../src/game/progression';
import { createWeapon } from '../src/game/weapons';
import { damageEnemy, timersSystem } from '../src/game/systems/damage';
import { deathSystem } from '../src/game/systems/death';
import { movementSystem } from '../src/game/systems/movement';
import type { World } from '../src/game/world';
import { emptyWorld } from './helpers';

function add(world: World, id: EnemyId, x: number, y: number) {
  const e = spawnEnemy(world, ENEMIES[id], x, y);
  if (!e) throw new Error('pool full');
  return e;
}

/** Behavior + movement + hazards + timers for `seconds` (no weapons, no spawner). */
function run(world: World, seconds: number, each?: () => void): void {
  const steps = Math.round(seconds / FIXED_STEP);
  for (let i = 0; i < steps; i++) {
    movementSystem(world, FIXED_STEP);
    enemyBehaviorSystem(world, FIXED_STEP);
    enemyMovementSystem(world, FIXED_STEP);
    hazardSystem(world, FIXED_STEP);
    timersSystem(world, FIXED_STEP);
    world.time += FIXED_STEP;
    each?.();
  }
}

describe('Repartidor (zigzag)', () => {
  it('advances toward the player while weaving sideways', () => {
    const world = emptyWorld();
    const e = add(world, 'delivery', 600, 0);
    let minY = 0;
    let maxY = 0;
    run(world, 1.5, () => {
      minY = Math.min(minY, e.pos.y);
      maxY = Math.max(maxY, e.pos.y);
    });
    expect(e.pos.x).toBeLessThan(600 - 100);
    expect(maxY - minY).toBeGreaterThan(20);
  });
});

describe('Carrito (charge)', () => {
  it('stops to aim, then rams in a straight, locked direction', () => {
    const world = emptyWorld();
    const e = add(world, 'cart', 200, 0);
    run(world, FIXED_STEP);
    expect(e.aiState).toBe(CHARGE_STATE.windup);
    const aimed = { x: e.aiDir.x, y: e.aiDir.y };
    const held = { x: e.pos.x, y: e.pos.y };
    // During the 0.6 s wind-up it does not move, even if the player does.
    world.player.pos.y = 150;
    run(world, 0.5);
    expect(e.pos.x).toBeCloseTo(held.x);
    expect(e.pos.y).toBeCloseTo(held.y);
    run(world, 0.2);
    expect(e.aiState).toBe(CHARGE_STATE.charging);
    // The direction stays the one chosen before the player moved.
    expect(e.aiDir).toEqual(aimed);
    const before = e.pos.x;
    run(world, 0.3);
    expect(before - e.pos.x).toBeGreaterThan(300 * 0.3 * 0.9);
    expect(e.pos.y).toBeCloseTo(held.y);
  });

  it('recovers before charging again', () => {
    const world = emptyWorld();
    const e = add(world, 'cart', 200, 0);
    run(world, 0.6 + 0.8 + 0.1);
    expect(e.aiState).toBe(CHARGE_STATE.recover);
  });
});

describe('Cajero (ranged)', () => {
  it('backs away when too close and keeps its distance', () => {
    const world = emptyWorld();
    const e = add(world, 'cashier', 100, 0);
    run(world, 2);
    expect(Math.hypot(e.pos.x, e.pos.y)).toBeGreaterThan(180);
  });

  it('throws a receipt that explodes where the player stood and hurts in the radius', () => {
    const world = emptyWorld();
    add(world, 'cashier', 260, 0);
    let thrown = false;
    run(world, 1.4, () => {
      if (world.hazards.items.slice(0, world.hazards.count).some((h) => h.kind === 'receipt')) {
        thrown = true;
      }
    });
    expect(thrown).toBe(true);
    run(world, 1.5);
    expect(world.player.hp).toBeLessThan(world.player.maxHp);
  });

  it('a dodged receipt does no damage', () => {
    const world = emptyWorld();
    add(world, 'cashier', 260, 0);
    run(world, 1.3);
    world.player.pos.y = 400;
    run(world, 1.5);
    expect(world.player.hp).toBe(world.player.maxHp);
  });
});

describe('Congelado (trail)', () => {
  it('leaves puddles that slow the player', () => {
    const world = emptyWorld();
    const e = add(world, 'frozen', 0, 0);
    e.speed = 0;
    run(world, 0.9);
    expect(world.hazards.count).toBeGreaterThan(0);
    expect(world.player.slowTimer).toBeGreaterThan(0);
    world.moveInput.x = 1;
    const x0 = world.player.pos.x;
    run(world, 0.1);
    const slowed = world.player.pos.x - x0;
    expect(slowed).toBeLessThan(world.player.speed * 0.1 * 0.7);
  });
});

describe('Gerente Zombi (boss)', () => {
  it('summons 6 clients every 10 s', () => {
    const world = emptyWorld();
    add(world, 'manager', 900, 0);
    run(world, 9.9);
    expect(world.enemies.count).toBe(1);
    run(world, 0.2);
    expect(world.enemies.count).toBe(7);
    const minions = world.enemies.items.slice(1, 7).map((e) => e.def.id);
    expect(new Set(minions)).toEqual(new Set(['client']));
  });

  it('its shockwave hits the player once when the ring passes', () => {
    const world = emptyWorld();
    const boss = add(world, 'manager', 150, 0);
    boss.speed = 0;
    world.player.invulnTime = 0;
    run(world, 6 + 0.5 + 0.7);
    const shockDamage = ENEMIES.manager.behavior.kind === 'boss' ? 15 : 0;
    expect(world.player.maxHp - world.player.hp).toBeCloseTo(shockDamage);
  });

  it('drops a chest that opens free weapon upgrades only', () => {
    const world = emptyWorld();
    world.player.weapons.push(createWeapon('cans'));
    const boss = add(world, 'manager', 0, 0);
    boss.hp = 0;
    deathSystem(world);
    expect(world.chests.count).toBe(1);
    pickupSystem(world, FIXED_STEP);
    expect(world.player.pendingChests).toBe(1);
    progressionSystem(world);
    expect(world.status).toBe('levelup');
    expect(world.offerSource).toBe('chest');
    expect(world.offers.every((o) => o.kind === 'upgradeWeapon')).toBe(true);
    // The chest may upgrade an automatic or a manual weapon.
    const levels = (): number => {
      const { weapons, manual } = world.player;
      return weapons.reduce((sum, w) => sum + w.level, manual.gun.level + manual.melee.level);
    };
    const before = levels();
    chooseOffer(world, 0);
    const after = levels();
    expect(after).toBe(before + 1);
    expect(world.player.pendingChests).toBe(0);
    // The boss's 20-xp coupon was collected too, so a normal level-up follows the chest.
    expect(world.offerSource).toBe('level');
  });

  it('opens the chest before pending level-ups', () => {
    const world = emptyWorld();
    world.player.pendingLevelUps = 1;
    world.player.pendingChests = 1;
    progressionSystem(world);
    expect(world.offerSource).toBe('chest');
    chooseOffer(world, 0);
    expect(world.offerSource).toBe('level');
    chooseOffer(world, 0);
    expect(world.status).toBe('playing');
  });
});

describe('scaling', () => {
  it('enemies spawned later have more hp and damage (+8%/min)', () => {
    const world = emptyWorld();
    world.time = 300;
    const e = add(world, 'client', 500, 0);
    expect(e.maxHp).toBeCloseTo(20 * 1.4);
    expect(e.damage).toBeCloseTo(6 * 1.4);
  });

  it('knockback resistance reduces the push', () => {
    const world = emptyWorld();
    const boss = add(world, 'manager', 500, 0);
    const client = add(world, 'client', -500, 0);
    damageEnemy(boss, 1, 100, 0);
    damageEnemy(client, 1, 100, 0);
    expect(boss.knockback.x).toBeCloseTo(100 * (1 - ENEMIES.manager.knockbackResist));
    expect(client.knockback.x).toBe(100);
  });
});
