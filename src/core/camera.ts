import type { Vec2 } from './math';

export interface Camera {
  x: number;
  y: number;
  /** Follow stiffness (1/s). Higher = tighter. */
  followRate: number;
}

export function createCamera(start: Vec2, followRate: number): Camera {
  return { x: start.x, y: start.y, followRate };
}

/** Frame-rate independent exponential follow. */
export function updateCamera(cam: Camera, targetX: number, targetY: number, dt: number): void {
  const t = 1 - Math.exp(-cam.followRate * dt);
  cam.x += (targetX - cam.x) * t;
  cam.y += (targetY - cam.y) * t;
}
