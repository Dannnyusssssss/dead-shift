import type { Vec2 } from './math';

export interface Camera {
  x: number;
  y: number;
  /** Follow stiffness (1/s). Higher = tighter. */
  followRate: number;
  /** Shake strength, 0..1; decays over time. */
  trauma: number;
  /** Running clock of the shake wobble, s. */
  shakeTime: number;
  /** Current shake displacement, px (added when drawing, never to x/y). */
  offsetX: number;
  offsetY: number;
}

export interface ShakeConfig {
  /** Displacement at full trauma, px. */
  maxOffset: number;
  /** Trauma lost per second. */
  decay: number;
  /** Wobble speed, rad/s. */
  frequency: number;
}

export function createCamera(start: Vec2, followRate: number): Camera {
  return {
    x: start.x,
    y: start.y,
    followRate,
    trauma: 0,
    shakeTime: 0,
    offsetX: 0,
    offsetY: 0,
  };
}

/** Frame-rate independent exponential follow. */
export function updateCamera(cam: Camera, targetX: number, targetY: number, dt: number): void {
  const t = 1 - Math.exp(-cam.followRate * dt);
  cam.x += (targetX - cam.x) * t;
  cam.y += (targetY - cam.y) * t;
}

/** Adds shake (clamped to 1). Small hits stack up to a strong shake. */
export function addShake(cam: Camera, amount: number): void {
  cam.trauma = Math.min(1, cam.trauma + Math.max(0, amount));
}

/**
 * Decays the trauma and recomputes the offset. The displacement grows with trauma²
 * so light hits barely move the view; detuned sines avoid a visible back-and-forth pattern.
 */
export function updateShake(cam: Camera, cfg: Readonly<ShakeConfig>, dt: number): void {
  cam.trauma = Math.max(0, cam.trauma - cfg.decay * dt);
  if (cam.trauma === 0) {
    cam.offsetX = cam.offsetY = 0;
    return;
  }
  cam.shakeTime += dt;
  const amp = cfg.maxOffset * cam.trauma * cam.trauma;
  const t = cam.shakeTime * cfg.frequency;
  cam.offsetX = amp * (0.6 * Math.sin(t) + 0.4 * Math.sin(t * 2.3 + 1.7));
  cam.offsetY = amp * (0.6 * Math.sin(t * 1.3 + 0.5) + 0.4 * Math.sin(t * 2.9 + 4.1));
}
