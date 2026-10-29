import { ENEMIES } from '../src/data/enemies';
import { spawnEnemy, type Enemy } from '../src/game/enemies';
import { createWorld, type World } from '../src/game/world';

/** Fresh world with no enemies; tests call individual systems on it. */
export function emptyWorld(seed = 1): World {
  return createWorld(seed);
}

export function addClient(world: World, x: number, y: number): Enemy {
  const e = spawnEnemy(world, ENEMIES.client, x, y);
  if (!e) throw new Error('pool full');
  return e;
}
