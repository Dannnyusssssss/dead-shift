import { COMBAT } from '../../data/combat';
import type { Enemy } from '../enemies';
import { emit } from '../events';
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

/** Applies a hit unless the player is invulnerable. Returns true if the hit landed. */
export function damagePlayer(player: Player, amount: number): boolean {
  if (player.invulnTimer > 0 || amount <= 0) return false;
  if (!player.invincible) player.hp = Math.max(0, player.hp - amount);
  player.invulnTimer = player.invulnTime;
  return true;
}

/** Removes dead enemies (counting kills) and ends the run when the player dies. */
export function deathSystem(world: World): void {
  const enemies = world.enemies;
  for (let i = enemies.count - 1; i >= 0; i--) {
    const e = enemies.items[i] as Enemy;
    if (e.hp > 0) continue;
    emit(world.events, 'enemyDeath', e.pos.x, e.pos.y, e.def.look.blood);
    world.kills++;
    enemies.releaseAt(i);
  }
  if (world.player.hp <= 0) world.status = 'dead';
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
