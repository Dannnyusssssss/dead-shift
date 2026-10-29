import { SHELF_COLLISION } from '../../data/map';
import { clearShelfContact, stopChargeAgainstShelf, type Enemy } from '../enemies';
import { createPush, nearShelves, pushOutOfShelves, type Rect } from '../shelves';
import { relocateToRing } from '../spawner';
import type { World } from '../world';

const hit = createPush();

/** Restarts the no-progress stretch from the enemy's current position. */
function resetStuck(e: Enemy): void {
  e.stuckTimer = 0;
  e.stuckAnchor.x = e.pos.x;
  e.stuckAnchor.y = e.pos.y;
}

/** Keeps the touched shelf and its normal, and measures whether the enemy is getting anywhere. */
function trackContact(world: World, e: Enemy, touched: number, dt: number): void {
  if (touched < 0) {
    e.contactTimer = Math.max(0, e.contactTimer - dt);
    if (e.contactTimer === 0) resetStuck(e);
    return;
  }
  const shelf = nearShelves[touched] as Rect;
  Object.assign(e.contactShelf, shelf);
  e.contactNormal.x = hit.nx;
  e.contactNormal.y = hit.ny;
  e.contactTimer = SHELF_COLLISION.contactMemory;
  stopChargeAgainstShelf(e);
  const p = world.player.pos;
  const engaged = Math.hypot(p.x - e.pos.x, p.y - e.pos.y) < SHELF_COLLISION.engagedDistance;
  const moved = Math.hypot(e.pos.x - e.stuckAnchor.x, e.pos.y - e.stuckAnchor.y);
  // Only an enemy trying to reach the player can be stuck (a retreating cashier is not), and
  // one sliding around the shelf keeps moving well past the progress distance.
  if (!e.approaching || engaged || moved >= SHELF_COLLISION.progressDistance) {
    resetStuck(e);
    return;
  }
  e.stuckTimer += dt;
}

/**
 * Shelves are solid: pushes the player and every enemy out of them (after movement, knockback
 * and crowd separation). Enemies remember the contact to slide around the shelf next step, and
 * one that makes no progress for `stuckTime` is moved back to the spawn ring.
 */
export function shelfCollisionSystem(world: World, dt: number): void {
  const p = world.player;
  pushOutOfShelves(p.pos, p.radius, world.seed);

  const { items, count } = world.enemies;
  for (let i = 0; i < count; i++) {
    const e = items[i] as Enemy;
    const touched = pushOutOfShelves(e.pos, e.radius, world.seed, hit, SHELF_COLLISION.contactSkin);
    trackContact(world, e, touched, dt);
    if (e.stuckTimer < SHELF_COLLISION.stuckTime) continue;
    relocateToRing(world, e);
    clearShelfContact(e);
    world.stuckRelocations++;
  }
}
