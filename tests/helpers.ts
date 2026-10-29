import { setVec } from '../src/core/math';
import { ENEMIES } from '../src/data/enemies';
import { spawnEnemy, type Enemy } from '../src/game/enemies';
import { hasAmmo } from '../src/game/manual';
import type { AmmoBox } from '../src/game/pickups';
import { findNearestEnemy } from '../src/game/weapons';
import { createWorld, type World } from '../src/game/world';

/** Fresh world with no enemies; tests call individual systems on it. */
export function emptyWorld(seed = 1): World {
  return createWorld(seed);
}

export function addClient(world: World, x: number, y: number): Enemy {
  const e = spawnEnemy(world, ENEMIES.client, x, y);
  if (!e) throw new Error('pool full');
  return e;
}

function nearestBox(world: World): AmmoBox | undefined {
  const p = world.player.pos;
  let best: AmmoBox | undefined;
  let bestD = Infinity;
  for (let i = 0; i < world.ammoBoxes.count; i++) {
    const b = world.ammoBoxes.items[i];
    if (!b) continue;
    const d = Math.hypot(b.pos.x - p.x, b.pos.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

/** Bot preference when picking an upgrade card: weapons first, then passives, then heal. */
export function botPickOffer(world: World): number {
  const rank = (kind: string): number =>
    kind === 'newWeapon' ? 0 : kind === 'upgradeWeapon' ? 1 : kind === 'heal' ? 4 : 2;
  let best = 0;
  world.offers.forEach((o, i) => {
    if (rank(o.kind) < rank(world.offers[best]?.kind ?? 'heal')) best = i;
  });
  return best;
}

/** Distance within which the bot feels "pressure" from a zombie and steps away from it, px. */
const BOT_DANGER_RADIUS = 220;

/**
 * A crude stand-in for a human player, used by the long simulations: aims at the nearest
 * zombie and holds the trigger, kites away from the crowd (weighted by closeness, with a
 * sideways drift so it circles instead of backing into a wall of zombies), closes in with
 * the broom, and walks to the nearest ammo box when it is running dry.
 */
export function playerBot(world: World): void {
  const p = world.player.pos;
  const m = world.player.manual;
  const target = findNearestEnemy(world, p.x, p.y, Infinity);
  world.aimActive = true;
  world.triggerHeld = target !== undefined;
  let mx = 0;
  let my = 0;
  if (target) {
    const dx = target.pos.x - p.x;
    const dy = target.pos.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    setVec(world.aim, dx / d, dy / d);
    if (m.active === 'melee' && d > 50) {
      mx = dx / d;
      my = dy / d;
    } else {
      // Repulsion from every nearby zombie, closer ones weigh more.
      let rx = 0;
      let ry = 0;
      for (let i = 0; i < world.enemies.count; i++) {
        const e = world.enemies.items[i];
        if (!e) continue;
        const ex = p.x - e.pos.x;
        const ey = p.y - e.pos.y;
        const ed = Math.hypot(ex, ey) || 1;
        if (ed > BOT_DANGER_RADIUS) continue;
        const w = (BOT_DANGER_RADIUS - ed) / BOT_DANGER_RADIUS;
        rx += (ex / ed) * w;
        ry += (ey / ed) * w;
      }
      // Drift sideways relative to the target so the bot circles the horde.
      mx = rx - (dy / d) * 0.6;
      my = ry + (dx / d) * 0.6;
    }
  }
  const box = !hasAmmo(m) || m.reserve < 20 ? nearestBox(world) : undefined;
  if (box) {
    const dx = box.pos.x - p.x;
    const dy = box.pos.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    mx = dx / d;
    my = dy / d;
  }
  setVec(world.moveInput, mx, my);
}
