import { describe, expect, it } from 'vitest';
import { FIXED_STEP } from '../src/core/loop';
import { length, setVec } from '../src/core/math';
import { PLAYER_BASE } from '../src/data/player';
import { createWorld, updateWorld } from '../src/game/world';

function simulate(seconds: number, x: number, y: number) {
  const world = createWorld(1);
  setVec(world.moveInput, x, y);
  const steps = Math.round(seconds / FIXED_STEP);
  for (let i = 0; i < steps; i++) updateWorld(world, FIXED_STEP);
  return world;
}

describe('movement system', () => {
  it('moves at base speed for one second', () => {
    const world = simulate(1, 1, 0);
    expect(world.player.pos.x).toBeCloseTo(PLAYER_BASE.speed);
    expect(world.player.pos.y).toBeCloseTo(0);
    expect(world.tick).toBe(60);
    expect(world.time).toBeCloseTo(1);
  });

  it('does not go faster diagonally even with an unnormalized input', () => {
    const world = simulate(1, 1, 1);
    const dist = length(world.player.pos.x, world.player.pos.y);
    expect(dist).toBeCloseTo(PLAYER_BASE.speed);
  });

  it('updates facing to the movement direction and keeps it when idle', () => {
    const world = simulate(0.5, 0, -1);
    expect(world.player.facing.x).toBeCloseTo(0);
    expect(world.player.facing.y).toBeCloseTo(-1);
    setVec(world.moveInput, 0, 0);
    updateWorld(world, FIXED_STEP);
    expect(world.player.facing.y).toBeCloseTo(-1);
  });

  it('records prevPos for interpolation', () => {
    const world = simulate(0.5, 1, 0);
    const before = world.player.pos.x;
    updateWorld(world, FIXED_STEP);
    expect(world.player.prevPos.x).toBe(before);
    expect(world.player.pos.x).toBeGreaterThan(before);
  });
});
