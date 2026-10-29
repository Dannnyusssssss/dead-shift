import { describe, expect, it } from 'vitest';
import { clamp, length, lerp, normalizeInPlace, vec2 } from '../src/core/math';

describe('math', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('lerps', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
  });

  it('normalizes in place and returns the old length', () => {
    const v = vec2(3, 4);
    expect(normalizeInPlace(v)).toBe(5);
    expect(v.x).toBeCloseTo(0.6);
    expect(v.y).toBeCloseTo(0.8);
    expect(length(v.x, v.y)).toBeCloseTo(1);
  });

  it('leaves the zero vector at zero (no NaN)', () => {
    const v = vec2(0, 0);
    expect(normalizeInPlace(v)).toBe(0);
    expect(v).toEqual({ x: 0, y: 0 });
  });
});
