import { length, setVec } from '../../core/math';
import type { World } from '../world';

/** Moves the player along `world.moveInput` (magnitude <= 1) and updates facing. */
export function movementSystem(world: World, dt: number): void {
  const player = world.player;
  const input = world.moveInput;
  const mag = length(input.x, input.y);
  if (mag === 0) return;
  // Guard against callers passing an unnormalized vector.
  const scale = mag > 1 ? 1 / mag : 1;
  player.pos.x += input.x * scale * player.speed * dt;
  player.pos.y += input.y * scale * player.speed * dt;
  setVec(player.facing, input.x / mag, input.y / mag);
}
