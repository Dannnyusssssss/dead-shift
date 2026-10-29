import { describe, expect, it } from 'vitest';
import { createRng, hash2 } from '../src/core/rng';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const same = Array.from({ length: 20 }, () => a.next() === b.next()).every(Boolean);
    expect(same).toBe(false);
  });

  it('keeps next/range/int within bounds', () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      const r = rng.range(-5, 5);
      expect(r).toBeGreaterThanOrEqual(-5);
      expect(r).toBeLessThan(5);
      const k = rng.int(1, 6);
      expect(Number.isInteger(k)).toBe(true);
      expect(k).toBeGreaterThanOrEqual(1);
      expect(k).toBeLessThanOrEqual(6);
    }
  });

  it('hits every value of int over many draws', () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rng.int(0, 3));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe('hash2', () => {
  it('is stable and in [0, 1)', () => {
    for (let x = -20; x < 20; x++) {
      for (let y = -20; y < 20; y++) {
        const h = hash2(x, y, 42);
        expect(h).toBe(hash2(x, y, 42));
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(1);
      }
    }
  });

  it('varies with coordinates and seed', () => {
    expect(hash2(1, 2, 0)).not.toBe(hash2(2, 1, 0));
    expect(hash2(1, 2, 0)).not.toBe(hash2(1, 2, 1));
  });
});
