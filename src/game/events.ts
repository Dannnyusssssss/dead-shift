import { createPool, type Pool } from '../core/pool';

export type GameEventType =
  | 'enemyDeath'
  | 'playerHit'
  | 'explosion'
  | 'gunFire'
  | 'reloadStart'
  | 'reloadDone'
  | 'dryFire'
  | 'weaponSwap'
  | 'ammoPickup'
  | 'couponPickup'
  | 'medkitPickup'
  | 'magnetPickup'
  | 'meleeSwing'
  | 'canThrow'
  | 'levelUp'
  | 'chestOpen'
  | 'bossSpawn'
  | 'bossDeath'
  | 'shockwave';

/** Something the presentation layer may want to react to (particles, sounds, shake). */
export interface GameEvent {
  type: GameEventType;
  x: number;
  y: number;
  color: string;
}

/** Accumulates across fixed steps; the host drains it once per rendered frame. */
export type EventQueue = Pool<GameEvent>;

export function createEventQueue(capacity: number): EventQueue {
  return createPool<GameEvent>(capacity, () => ({ type: 'enemyDeath', x: 0, y: 0, color: '' }));
}

/** Drops the event silently if the queue is full (purely cosmetic consequences). */
export function emit(
  queue: EventQueue,
  type: GameEventType,
  x: number,
  y: number,
  color = '',
): void {
  const ev = queue.acquire();
  if (!ev) return;
  ev.type = type;
  ev.x = x;
  ev.y = y;
  ev.color = color;
}

/** Damage dealt to an enemy, for floating numbers. Kept apart so a flood of hits never crowds out events. */
export interface HitEvent {
  x: number;
  y: number;
  amount: number;
}

export type HitQueue = Pool<HitEvent>;

export function createHitQueue(capacity: number): HitQueue {
  return createPool<HitEvent>(capacity, () => ({ x: 0, y: 0, amount: 0 }));
}

export function emitHit(queue: HitQueue, x: number, y: number, amount: number): void {
  const h = queue.acquire();
  if (!h) return;
  h.x = x;
  h.y = y;
  h.amount = amount;
}
