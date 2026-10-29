import { COMBAT } from '../../data/combat';
import type { Enemy } from '../enemies';
import type { Player } from '../player';
import type { World } from '../world';

/** Applies damage and sets knockback velocity. Returns true if the hit was lethal. */
export function damageEnemy(enemy: Enemy, amount: number, kx: number, ky: number): boolean {
  enemy.hp -= amount;
  enemy.knockback.x = kx;
  enemy.knockback.y = ky;
  enemy.hitTimer = COMBAT.hitFlashTime;
  return enemy.hp <= 0;
}

/** Applies a hit (reduced by armor, min 1) unless invulnerable. Returns true if it landed. */
export function damagePlayer(player: Player, amount: number): boolean {
  if (player.invulnTimer > 0 || amount <= 0) return false;
  const taken = Math.max(1, amount - player.mods.armor);
  if (!player.invincible) player.hp = Math.max(0, player.hp - taken);
  player.invulnTimer = player.invulnTime;
  return true;
}

export function timersSystem(world: World, dt: number): void {
  const p = world.player;
  p.invulnTimer = Math.max(0, p.invulnTimer - dt);
  const { items, count } = world.enemies;
  for (let i = 0; i < count; i++) {
    const e = items[i] as Enemy;
    if (e.hitTimer > 0) e.hitTimer = Math.max(0, e.hitTimer - dt);
  }
}
