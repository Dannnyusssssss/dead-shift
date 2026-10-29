/**
 * Uniform grid over an unbounded plane, stored as a fixed hash table of buckets.
 * Entries are points (ids in [0, capacity)); queries return candidate ids that the
 * caller must still filter by real distance. No allocations after creation.
 */
export interface SpatialHash {
  readonly cellSize: number;
  clear(): void;
  insert(id: number, x: number, y: number): void;
  /** Writes ids of entries in cells overlapping the circle's bounding box into `out`; returns how many. */
  query(x: number, y: number, radius: number, out: Int32Array): number;
}

const EMPTY = -1;

export function createSpatialHash(
  cellSize: number,
  capacity: number,
  bucketCount = 4096,
): SpatialHash {
  if ((bucketCount & (bucketCount - 1)) !== 0) throw new Error('bucketCount must be a power of 2');
  const mask = bucketCount - 1;
  const heads = new Int32Array(bucketCount).fill(EMPTY);
  const next = new Int32Array(capacity);
  const ids = new Int32Array(capacity);
  // Each entry remembers its cell, so cells sharing a bucket never leak into each other
  // and every entry is returned at most once per query.
  const cellX = new Int32Array(capacity);
  const cellY = new Int32Array(capacity);
  let size = 0;

  const bucketOf = (cx: number, cy: number): number =>
    (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) & mask;

  return {
    cellSize,
    clear() {
      heads.fill(EMPTY);
      size = 0;
    },
    insert(id, x, y) {
      if (size >= capacity) return;
      const cx = Math.floor(x / cellSize);
      const cy = Math.floor(y / cellSize);
      const b = bucketOf(cx, cy);
      const slot = size++;
      ids[slot] = id;
      cellX[slot] = cx;
      cellY[slot] = cy;
      next[slot] = heads[b] ?? EMPTY;
      heads[b] = slot;
    },
    query(x, y, radius, out) {
      const cx0 = Math.floor((x - radius) / cellSize);
      const cy0 = Math.floor((y - radius) / cellSize);
      const cx1 = Math.floor((x + radius) / cellSize);
      const cy1 = Math.floor((y + radius) / cellSize);
      let n = 0;
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          let slot = heads[bucketOf(cx, cy)] ?? EMPTY;
          while (slot !== EMPTY) {
            if (cellX[slot] === cx && cellY[slot] === cy) {
              if (n >= out.length) return n;
              out[n++] = ids[slot] ?? 0;
            }
            slot = next[slot] ?? EMPTY;
          }
        }
      }
      return n;
    },
  };
}
