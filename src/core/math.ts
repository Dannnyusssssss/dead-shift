export interface Vec2 {
  x: number;
  y: number;
}

export function vec2(x = 0, y = 0): Vec2 {
  return { x, y };
}

export function setVec(out: Vec2, x: number, y: number): Vec2 {
  out.x = x;
  out.y = y;
  return out;
}

export function copyVec(out: Vec2, from: Vec2): Vec2 {
  out.x = from.x;
  out.y = from.y;
  return out;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** Normalizes `v` in place. A zero vector stays zero. Returns the original length. */
export function normalizeInPlace(v: Vec2): number {
  const len = length(v.x, v.y);
  if (len > 0) {
    v.x /= len;
    v.y /= len;
  }
  return len;
}
