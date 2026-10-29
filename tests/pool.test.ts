import { describe, expect, it } from 'vitest';
import { createPool } from '../src/core/pool';

const make = (capacity: number) => {
  let next = 0;
  return createPool(capacity, () => ({ id: next++, value: 0 }));
};

describe('createPool', () => {
  it('preallocates and hands out objects until full', () => {
    const pool = make(3);
    expect(pool.count).toBe(0);
    expect(pool.acquire()).toBeDefined();
    expect(pool.acquire()).toBeDefined();
    expect(pool.acquire()).toBeDefined();
    expect(pool.acquire()).toBeUndefined();
    expect(pool.count).toBe(3);
  });

  it('reuses the same objects (no new allocations)', () => {
    const pool = make(2);
    const a = pool.acquire();
    pool.releaseAt(0);
    expect(pool.acquire()).toBe(a);
  });

  it('releaseAt swaps the last active object into the hole', () => {
    const pool = make(4);
    const objs = [pool.acquire(), pool.acquire(), pool.acquire()];
    pool.releaseAt(0);
    expect(pool.count).toBe(2);
    expect(pool.items[0]).toBe(objs[2]);
    expect(pool.items[1]).toBe(objs[1]);
    // The freed object is the next one acquired.
    expect(pool.acquire()).toBe(objs[0]);
  });

  it('supports removing while iterating backwards', () => {
    const pool = make(10);
    for (let i = 0; i < 10; i++) {
      const o = pool.acquire();
      if (o) o.value = i;
    }
    for (let i = pool.count - 1; i >= 0; i--) {
      if ((pool.items[i]?.value ?? 0) % 2 === 0) pool.releaseAt(i);
    }
    const left = pool.items.slice(0, pool.count).map((o) => o.value);
    expect(left.sort((a, b) => a - b)).toEqual([1, 3, 5, 7, 9]);
  });

  it('ignores out-of-range releases and clears', () => {
    const pool = make(2);
    pool.acquire();
    pool.releaseAt(5);
    expect(pool.count).toBe(1);
    pool.clear();
    expect(pool.count).toBe(0);
  });
});
