import { describe, expect, it } from 'vitest';
import { PLAYER_BASE } from '../src/data/player';
import { damageEnemy, damagePlayer, deathSystem, timersSystem } from '../src/game/systems/damage';
import { addClient, emptyWorld } from './helpers';

describe('damageEnemy', () => {
  it('reduces hp, flashes, sets knockback and reports lethal hits', () => {
    const world = emptyWorld();
    const e = addClient(world, 0, 0);
    expect(damageEnemy(e, 10, 50, -20)).toBe(false);
    expect(e.hp).toBe(10);
    expect(e.hitTimer).toBeGreaterThan(0);
    expect(e.knockback).toEqual({ x: 50, y: -20 });
    expect(damageEnemy(e, 10, 0, 0)).toBe(true);
  });
});

describe('damagePlayer', () => {
  it('blocks a second hit during invulnerability', () => {
    const world = emptyWorld();
    const p = world.player;
    expect(damagePlayer(p, 6)).toBe(true);
    expect(p.hp).toBe(PLAYER_BASE.maxHp - 6);
    expect(damagePlayer(p, 6)).toBe(false);
    expect(p.hp).toBe(PLAYER_BASE.maxHp - 6);
  });

  it('allows another hit once invulnerability expires', () => {
    const world = emptyWorld();
    const p = world.player;
    damagePlayer(p, 6);
    timersSystem(world, PLAYER_BASE.invulnTime + 0.01);
    expect(damagePlayer(p, 6)).toBe(true);
    expect(p.hp).toBe(PLAYER_BASE.maxHp - 12);
  });

  it('never drops below 0 and ignores zero damage', () => {
    const world = emptyWorld();
    expect(damagePlayer(world.player, 0)).toBe(false);
    damagePlayer(world.player, 9999);
    expect(world.player.hp).toBe(0);
  });

  it('keeps hp in invincible (debug) mode', () => {
    const world = emptyWorld();
    world.player.invincible = true;
    expect(damagePlayer(world.player, 50)).toBe(true);
    expect(world.player.hp).toBe(PLAYER_BASE.maxHp);
  });
});

describe('deathSystem', () => {
  it('removes dead enemies, counts kills and emits death events', () => {
    const world = emptyWorld();
    const a = addClient(world, 0, 0);
    addClient(world, 10, 0);
    const c = addClient(world, 20, 0);
    a.hp = 0;
    c.hp = -5;
    deathSystem(world);
    expect(world.enemies.count).toBe(1);
    expect(world.kills).toBe(2);
    expect(world.events.count).toBe(2);
    expect(world.events.items[0]?.type).toBe('enemyDeath');
    expect(world.enemies.items[0]?.pos.x).toBe(10);
  });

  it('ends the run when the player reaches 0 hp', () => {
    const world = emptyWorld();
    deathSystem(world);
    expect(world.status).toBe('playing');
    world.player.hp = 0;
    deathSystem(world);
    expect(world.status).toBe('dead');
  });
});
