import type { Enemy } from '../enemies';
import type { World } from '../world';

/** Poison damage, slow and per-weapon hit timers on enemies; player regeneration. */
export function statusSystem(world: World, dt: number): void {
  const { items, count } = world.enemies;
  for (let i = 0; i < count; i++) {
    const e = items[i] as Enemy;
    if (e.poisonTimer > 0) {
      e.hp -= e.poisonDps * Math.min(dt, e.poisonTimer);
      e.poisonTimer = Math.max(0, e.poisonTimer - dt);
    }
    if (e.slowTimer > 0) e.slowTimer = Math.max(0, e.slowTimer - dt);
    const timers = e.weaponHitTimers;
    for (let w = 0; w < timers.length; w++) {
      if ((timers[w] ?? 0) > 0) timers[w] = Math.max(0, (timers[w] ?? 0) - dt);
    }
  }
  const p = world.player;
  if (p.mods.regen > 0 && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + p.mods.regen * dt);
}
