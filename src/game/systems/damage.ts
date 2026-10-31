import { COMBAT } from '../../data/combat';
import { WEAPON_IDS, WEAPONS, isManual } from '../../data/weapons';
import type { Enemy } from '../enemies';
import { emitHit } from '../events';
import type { Player } from '../player';
import type { World } from '../world';

/** 1 for the manual weapons, indexed like WEAPON_IDS. */
const MANUAL_SOURCE = Uint8Array.from(WEAPON_IDS, (id) => (isManual(WEAPONS[id]) ? 1 : 0));

/**
 * Multiplier on what `source` (index in WEAPON_IDS, -1 = unknown) does to the enemy: its armor
 * against automatic weapons. Manual weapons and unknown sources always do full damage.
 */
export function damageTakenFrom(enemy: Readonly<Enemy>, source: number): number {
  if (source < 0 || MANUAL_SOURCE[source] === 1) return 1;
  return enemy.def.autoDamageTaken ?? 1;
}

/** Applies damage and sets knockback (reduced by resistance). Returns true if lethal. */
export function damageEnemy(enemy: Enemy, amount: number, kx: number, ky: number): boolean {
  const push = 1 - enemy.def.knockbackResist;
  enemy.hp -= amount;
  enemy.knockback.x = kx * push;
  enemy.knockback.y = ky * push;
  enemy.hitTimer = COMBAT.hitFlashTime;
  return enemy.hp <= 0;
}

/**
 * `damageEnemy` plus a floating damage number. Weapons use this one.
 * `source` is the weapon's index in WEAPON_IDS (-1 = unknown); the kill is credited to the last one.
 */
export function hitEnemy(
  world: World,
  enemy: Enemy,
  amount: number,
  kx: number,
  ky: number,
  source = -1,
): boolean {
  const taken = damageTakenFrom(enemy, source);
  const dealt = amount * taken;
  emitHit(world.hits, enemy.pos.x, enemy.pos.y - enemy.radius, dealt, taken < 1);
  if (source >= 0) enemy.lastHitBy = source;
  return damageEnemy(enemy, dealt, kx, ky);
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
