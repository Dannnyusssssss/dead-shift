import { describe, expect, it } from 'vitest';
import { PLAYER_BASE } from '../src/data/player';
import { PROGRESSION } from '../src/data/progression';
import type { PASSIVES } from '../src/data/upgrades';
import { addPassive, createPlayer, recomputeStats } from '../src/game/player';
import { damagePlayer } from '../src/game/systems/damage';
import { statusSystem } from '../src/game/systems/status';
import { emptyWorld } from './helpers';

function withPassive(id: keyof typeof PASSIVES, level: number) {
  const p = createPlayer();
  addPassive(p, id).level = level;
  recomputeStats(p);
  return p;
}

describe('passives', () => {
  it('Zapatillas: +8% move speed per level', () => {
    expect(withPassive('shoes', 3).speed).toBeCloseTo(PLAYER_BASE.speed * 1.24);
  });

  it('Café: -8% cooldown per level', () => {
    expect(withPassive('coffee', 5).mods.cooldown).toBeCloseTo(0.6);
  });

  it('Imán: +20% pickup radius per level', () => {
    expect(withPassive('magnet', 2).pickupRadius).toBeCloseTo(PLAYER_BASE.pickupRadius * 1.4);
  });

  it('Calculadora: +10% damage per level', () => {
    expect(withPassive('calculator', 4).mods.damage).toBeCloseTo(1.4);
  });

  it('Chaleco: -1 damage per hit, never below 1', () => {
    const p = withPassive('vest', 3);
    damagePlayer(p, 6);
    expect(p.hp).toBe(PLAYER_BASE.maxHp - 3);
    p.invulnTimer = 0;
    damagePlayer(p, 2);
    expect(p.hp).toBe(PLAYER_BASE.maxHp - 4);
  });

  it('Termo: +0.5 hp/s regen, capped at max hp', () => {
    const world = emptyWorld();
    addPassive(world.player, 'soup').level = 2;
    recomputeStats(world.player);
    world.player.hp = 50;
    for (let i = 0; i < 60; i++) statusSystem(world, 1 / 60);
    expect(world.player.hp).toBeCloseTo(51);
    world.player.hp = world.player.maxHp - 0.1;
    statusSystem(world, 1);
    expect(world.player.hp).toBe(world.player.maxHp);
  });

  it('keeps the cooldown multiplier above the floor', () => {
    const p = createPlayer();
    addPassive(p, 'coffee').level = 50;
    recomputeStats(p);
    expect(p.mods.cooldown).toBe(PROGRESSION.minCooldownMultiplier);
  });

  it('a fresh player has neutral modifiers', () => {
    const p = createPlayer();
    expect(p.mods).toEqual({ cooldown: 1, damage: 1, armor: 0, regen: 0 });
    expect(p.speed).toBe(PLAYER_BASE.speed);
  });
});
