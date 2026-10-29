import { COMBAT } from '../../data/combat';
import { MAX_ENEMY_RADIUS, type Enemy } from '../enemies';
import { emit } from '../events';
import type { World } from '../world';
import { damagePlayer } from './damage';

export function spatialIndexSystem(world: World): void {
  const { items, count } = world.enemies;
  world.hash.clear();
  for (let i = 0; i < count; i++) {
    const e = items[i] as Enemy;
    world.hash.insert(i, e.pos.x, e.pos.y);
  }
}

/** Soft push-apart so zombies form a crowd instead of a single stacked blob. */
export function separationSystem(world: World): void {
  const { items, count } = world.enemies;
  const buf = world.queryBuf;
  const strength = COMBAT.separationStrength * 0.5;
  for (let i = 0; i < count; i++) {
    const a = items[i] as Enemy;
    const n = world.hash.query(a.pos.x, a.pos.y, a.radius + MAX_ENEMY_RADIUS, buf);
    for (let k = 0; k < n; k++) {
      const j = buf[k] ?? 0;
      if (j <= i) continue; // each pair once
      const b = items[j] as Enemy;
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const minDist = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minDist * minDist) continue;
      const d = Math.sqrt(d2);
      if (d < 1e-6) {
        // Perfectly stacked: separate along a fixed, deterministic axis.
        const push = minDist * strength;
        a.pos.x -= push;
        b.pos.x += push;
        continue;
      }
      const push = ((minDist - d) / d) * strength;
      a.pos.x -= dx * push;
      a.pos.y -= dy * push;
      b.pos.x += dx * push;
      b.pos.y += dy * push;
    }
  }
}

/** Touching zombies hurt the player; one hit (the strongest) per invulnerability window. */
export function contactDamageSystem(world: World): void {
  const p = world.player;
  if (p.invulnTimer > 0) return;
  const { items } = world.enemies;
  const buf = world.queryBuf;
  const n = world.hash.query(p.pos.x, p.pos.y, p.radius + MAX_ENEMY_RADIUS, buf);
  let damage = 0;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k] ?? 0] as Enemy;
    const dx = e.pos.x - p.pos.x;
    const dy = e.pos.y - p.pos.y;
    const r = p.radius + e.radius;
    if (dx * dx + dy * dy < r * r && e.damage > damage) damage = e.damage;
  }
  if (damagePlayer(p, damage)) emit(world.events, 'playerHit', p.pos.x, p.pos.y, '');
}
