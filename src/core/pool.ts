/**
 * Fixed-capacity object pool. Active objects are the dense prefix `items[0..count)`.
 * Objects are created once up front; nothing is allocated afterwards.
 */
export interface Pool<T> {
  readonly items: readonly T[];
  readonly count: number;
  readonly capacity: number;
  /** Next free object (its fields hold stale data: reset them), or undefined if full. */
  acquire(): T | undefined;
  /** Frees the object at `index` by swapping it with the last active one. Iterate backwards when removing. */
  releaseAt(index: number): void;
  clear(): void;
}

export function createPool<T>(capacity: number, factory: () => T): Pool<T> {
  const items: T[] = Array.from({ length: capacity }, factory);
  let count = 0;
  return {
    items,
    capacity,
    get count() {
      return count;
    },
    acquire() {
      if (count >= capacity) return undefined;
      return items[count++];
    },
    releaseAt(index) {
      if (index < 0 || index >= count) return;
      const last = count - 1;
      if (index !== last) {
        const freed = items[index] as T;
        items[index] = items[last] as T;
        items[last] = freed;
      }
      count--;
    },
    clear() {
      count = 0;
    },
  };
}
