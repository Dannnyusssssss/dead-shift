import type { Enemy } from '../enemies';
import { emit } from '../events';
import { dropChest, dropCoupon, maybeDropAmmo } from '../pickups';
import type { World } from '../world';

/** Removes dead enemies (kills, coupons, chests, events) and ends the run when the player dies. */
export function deathSystem(world: World): void {
  const enemies = world.enemies;
  for (let i = enemies.count - 1; i >= 0; i--) {
    const e = enemies.items[i] as Enemy;
    if (e.hp > 0) continue;
    emit(world.events, 'enemyDeath', e.pos.x, e.pos.y, e.def.look.blood);
    dropCoupon(world, e.pos.x, e.pos.y, e.def.xp);
    maybeDropAmmo(world, e.pos.x, e.pos.y, e.def.xp);
    if (e.def.dropsChest) {
      dropChest(world, e.pos.x, e.pos.y);
      emit(world.events, 'bossDeath', e.pos.x, e.pos.y);
    }
    world.kills++;
    enemies.releaseAt(i);
  }
  if (world.player.hp <= 0) world.status = 'dead';
}
