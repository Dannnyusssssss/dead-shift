import { COMBAT } from '../data/combat';
import type { World } from './world';

/** One segment of an electric discharge (electric broom); purely for the render. */
export interface Arc {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Seconds since it appeared. */
  age: number;
}

export function createArcObject(): Arc {
  return { x1: 0, y1: 0, x2: 0, y2: 0, age: 0 };
}

/** Drops the segment silently if the pool is full (cosmetic). */
export function spawnArc(world: World, x1: number, y1: number, x2: number, y2: number): void {
  const a = world.arcs.acquire();
  if (!a) return;
  a.x1 = x1;
  a.y1 = y1;
  a.x2 = x2;
  a.y2 = y2;
  a.age = 0;
}

export function arcSystem(world: World, dt: number): void {
  const pool = world.arcs;
  for (let i = pool.count - 1; i >= 0; i--) {
    const a = pool.items[i] as Arc;
    a.age += dt;
    if (a.age >= COMBAT.arcLifetime) pool.releaseAt(i);
  }
}
