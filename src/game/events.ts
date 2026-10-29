import { createPool, type Pool } from '../core/pool';

export type GameEventType = 'enemyDeath' | 'playerHit';

/** Something the presentation layer may want to react to (particles, later sounds). */
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
  color: string,
): void {
  const ev = queue.acquire();
  if (!ev) return;
  ev.type = type;
  ev.x = x;
  ev.y = y;
  ev.color = color;
}
