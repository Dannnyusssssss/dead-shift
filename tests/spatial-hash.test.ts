import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import { createSpatialHash } from '../src/core/spatial-hash';

const out = new Int32Array(1024);

function ids(n: number): number[] {
  return Array.from(out.subarray(0, n)).sort((a, b) => a - b);
}

describe('createSpatialHash', () => {
  it('returns every point within the radius, including negative coordinates', () => {
    const rng = createRng(3);
    const hash = createSpatialHash(64, 500);
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 500; i++) {
      const p = { x: rng.range(-2000, 2000), y: rng.range(-2000, 2000) };
      pts.push(p);
      hash.insert(i, p.x, p.y);
    }
    for (let q = 0; q < 50; q++) {
      const qx = rng.range(-2000, 2000);
      const qy = rng.range(-2000, 2000);
      const r = rng.range(10, 300);
      const found = new Set(ids(hash.query(qx, qy, r, out)));
      pts.forEach((p, i) => {
        if (Math.hypot(p.x - qx, p.y - qy) <= r) expect(found.has(i)).toBe(true);
      });
    }
  });

  it('never returns the same id twice, even with heavy bucket collisions', () => {
    // 2 buckets: almost every cell collides.
    const hash = createSpatialHash(10, 100, 2);
    for (let i = 0; i < 100; i++) hash.insert(i, (i % 10) * 10 + 5, Math.floor(i / 10) * 10 + 5);
    const n = hash.query(50, 50, 200, out);
    const list = ids(n);
    expect(new Set(list).size).toBe(list.length);
    expect(list.length).toBe(100);
  });

  it('excludes entries from cells that only share a bucket', () => {
    const hash = createSpatialHash(10, 10, 2);
    hash.insert(0, 5, 5);
    hash.insert(1, 1005, 1005);
    expect(ids(hash.query(5, 5, 1, out))).toEqual([0]);
  });

  it('is empty after clear', () => {
    const hash = createSpatialHash(64, 10);
    hash.insert(0, 0, 0);
    hash.clear();
    expect(hash.query(0, 0, 100, out)).toBe(0);
  });

  it('stops at the output buffer size', () => {
    const hash = createSpatialHash(64, 10);
    for (let i = 0; i < 10; i++) hash.insert(i, 1, 1);
    expect(hash.query(0, 0, 10, new Int32Array(4))).toBe(4);
  });
});
