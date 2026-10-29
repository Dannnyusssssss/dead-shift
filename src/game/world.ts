import { copyVec, vec2, type Vec2 } from '../core/math';
import { createRng, type Rng } from '../core/rng';
import { createPlayer, type Player } from './player';
import { movementSystem } from './systems/movement';

export interface World {
  seed: number;
  rng: Rng;
  /** Seconds of simulated game time. */
  time: number;
  tick: number;
  player: Player;
  /** Desired movement this step, magnitude <= 1. Written by the host from input. */
  moveInput: Vec2;
}

export type System = (world: World, dt: number) => void;

/** The one place that declares system execution order. */
const SYSTEMS: readonly System[] = [movementSystem];

export function createWorld(seed: number): World {
  return {
    seed,
    rng: createRng(seed),
    time: 0,
    tick: 0,
    player: createPlayer(),
    moveInput: vec2(0, 0),
  };
}

export function updateWorld(world: World, dt: number): void {
  copyVec(world.player.prevPos, world.player.pos);
  for (const system of SYSTEMS) system(world, dt);
  world.time += dt;
  world.tick++;
}
