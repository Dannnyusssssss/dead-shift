import { clamp, type Vec2 } from '../core/math';
import { hash2 } from '../core/rng';
import { SHELF_LAYOUT, TILE_SIZE } from '../data/map';

/** Axis-aligned rectangle, px. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const createRect = (): Rect => ({ x: 0, y: 0, w: 0, h: 0 });

const L = SHELF_LAYOUT;
export const BLOCK_W = L.blockTilesX * TILE_SIZE;
export const BLOCK_H = L.blockTilesY * TILE_SIZE;
const LENGTH_RANGE = L.maxLengthTiles - L.minLengthTiles + 1;

/**
 * The shelf of block (bx, by), if it has one. The single source of truth for both drawing and
 * collision: derived from `hash2`, so nothing is stored and the map is infinite.
 */
export function shelfInBlock(bx: number, by: number, seed: number, out: Rect): boolean {
  if (hash2(bx, by, seed) >= L.density) return false;
  const lenTiles = L.minLengthTiles + Math.floor(hash2(bx, by, seed + 1) * LENGTH_RANGE);
  // Keep `marginTiles` free at both ends so shelves of neighboring blocks leave a wide aisle.
  const positions = L.blockTilesX - lenTiles - 2 * L.marginTiles + 1;
  const offX = L.marginTiles + Math.floor(hash2(bx, by, seed + 2) * positions);
  const offY = 1 + Math.floor(hash2(bx, by, seed + 3) * (L.blockTilesY - 2));
  out.x = bx * BLOCK_W + offX * TILE_SIZE;
  out.y = by * BLOCK_H + offY * TILE_SIZE + (TILE_SIZE - L.depth) / 2;
  out.w = lenTiles * TILE_SIZE;
  out.h = L.depth;
  return true;
}

/** Max blocks a query box may span; queries are small (an entity, a projectile). */
const NEAR_CAPACITY = 9;
const near: Rect[] = Array.from({ length: NEAR_CAPACITY }, createRect);
const blockRect = createRect();

/**
 * Fills `nearShelves` with the shelves overlapping the box and returns how many. Only the
 * blocks the box touches are looked at. The buffer is reused by the next query.
 */
export function queryShelves(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  seed: number,
): number {
  const bx0 = Math.floor(minX / BLOCK_W);
  const by0 = Math.floor(minY / BLOCK_H);
  const bx1 = Math.floor(maxX / BLOCK_W);
  const by1 = Math.floor(maxY / BLOCK_H);
  let n = 0;
  for (let by = by0; by <= by1; by++) {
    for (let bx = bx0; bx <= bx1; bx++) {
      if (n >= NEAR_CAPACITY || !shelfInBlock(bx, by, seed, blockRect)) continue;
      const r = blockRect;
      if (r.x > maxX || r.x + r.w < minX || r.y > maxY || r.y + r.h < minY) continue;
      const slot = near[n++] as Rect;
      slot.x = r.x;
      slot.y = r.y;
      slot.w = r.w;
      slot.h = r.h;
    }
  }
  return n;
}

/** Result buffer of the last `queryShelves` call. */
export const nearShelves: readonly Rect[] = near;

/** Where a circle overlapping a rectangle must move to touch it from outside. */
export interface Push {
  /** Corrected center. */
  x: number;
  y: number;
  /** Unit normal pointing out of the rectangle. */
  nx: number;
  ny: number;
  /** Overlap that was removed, px. */
  depth: number;
}

export const createPush = (): Push => ({ x: 0, y: 0, nx: 0, ny: 0, depth: 0 });

/**
 * Circle vs rectangle. Returns false if they don't overlap; otherwise writes the push-out.
 * A center inside the rectangle leaves through the nearest edge.
 */
export function circleRectPush(
  x: number,
  y: number,
  r: number,
  rect: Readonly<Rect>,
  out: Push,
): boolean {
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;
  const dx = x - clamp(x, rect.x, right);
  const dy = y - clamp(y, rect.y, bottom);
  const d2 = dx * dx + dy * dy;
  if (d2 > 0) {
    if (d2 >= r * r) return false;
    const d = Math.sqrt(d2);
    out.nx = dx / d;
    out.ny = dy / d;
    out.depth = r - d;
  } else {
    // Center inside (or on the border): leave through the closest side.
    const toLeft = x - rect.x;
    const toRight = right - x;
    const toTop = y - rect.y;
    const toBottom = bottom - y;
    const min = Math.min(toLeft, toRight, toTop, toBottom);
    out.nx = min === toLeft ? -1 : min === toRight ? 1 : 0;
    out.ny = out.nx !== 0 ? 0 : min === toTop ? -1 : 1;
    out.depth = min + r;
  }
  out.x = x + out.nx * out.depth;
  out.y = y + out.ny * out.depth;
  return true;
}

const push = createPush();

/**
 * Moves a circle out of any shelf it overlaps (to the nearest free edge). Returns the index in
 * `nearShelves` of the last shelf it touched, or -1. Aisles are wider than any entity, so leaving
 * one shelf never lands inside another and a single pass is enough. `hit` gets the last push.
 * Within `skin` px of a shelf counts as touching it (so a circle sliding flush along a shelf
 * keeps reporting the contact), but only real overlap is pushed out.
 */
export function pushOutOfShelves(pos: Vec2, r: number, seed: number, hit?: Push, skin = 0): number {
  const reach = r + skin;
  const n = queryShelves(pos.x - reach, pos.y - reach, pos.x + reach, pos.y + reach, seed);
  let touched = -1;
  for (let i = 0; i < n; i++) {
    if (!circleRectPush(pos.x, pos.y, reach, nearShelves[i] as Rect, push)) continue;
    const overlap = push.depth - skin;
    if (overlap > 0) {
      pos.x += push.nx * overlap;
      pos.y += push.ny * overlap;
    }
    touched = i;
    if (hit) Object.assign(hit, push);
  }
  return touched;
}

/** True if the circle overlaps any shelf (projectiles, receipts, spawn checks). */
export function circleHitsShelf(x: number, y: number, r: number, seed: number): boolean {
  const n = queryShelves(x - r, y - r, x + r, y + r, seed);
  for (let i = 0; i < n; i++) {
    if (circleRectPush(x, y, r, nearShelves[i] as Rect, push)) return true;
  }
  return false;
}
