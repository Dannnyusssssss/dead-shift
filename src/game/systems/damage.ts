import { COMBAT } from '../../data/combat';
import type { Enemy } from '../enemies';
import { emitHit } from '../events';
import type { Player } from '../player';
import type { World } from '../world';

/** Applies damage and sets knockback (reduced by resistance). Returns true if lethal. */
export function damageEnemy(enemy: Enemy, amount: number, kx: number, ky: number): boolean {
  const push = 1 - enemy.def.knockbackResist;
  enemy.hp -= amount;
  enemy.knockback.x = kx * push;
  enemy.knockback.y = ky * push;
  enemy.hitTimer = COMBAT.hitFlashTime;
  return enemy.hp <= 0;
}

/** `damageEnemy` plus a floating damage number. Weapons use this one. */
export function hitEnemy(
  world: World,
  enemy: Enemy,
  amount: number,
  kx: number,
  ky: number,
): boolean {
  emitHit(world.hits, enemy.pos.x, enemy.pos.y - enemy.radius, amount);
  return damageEnemy(enemy, amount, kx, ky);
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
  p.slowTimer = Math.max(0, p.slowTimer - dt);
  const { items, count } = world.enemies;
  for (let i = 0; i < count; i++) {
    const e = items[i] as Enemy;
    if (e.hitTimer > 0) e.hitTimer = Math.max(0, e.hitTimer - dt);
  }
}
