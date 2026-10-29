import type { Rng } from '../core/rng';
import { PROGRESSION } from '../data/progression';
import { PASSIVE_IDS, type PassiveId } from '../data/upgrades';
import { WEAPON_IDS, WEAPONS, isManual, type WeaponId } from '../data/weapons';
import { emit } from './events';
import { addPassive, findOwnedWeapon, findPassive, recomputeStats, type Player } from './player';
import { createWeapon } from './weapons';
import type { World } from './world';

export type Offer =
  | { kind: 'newWeapon'; weaponId: WeaponId }
  | { kind: 'upgradeWeapon'; weaponId: WeaponId }
  | { kind: 'newPassive'; passiveId: PassiveId }
  | { kind: 'upgradePassive'; passiveId: PassiveId }
  | { kind: 'heal' };

/** XP needed to go from level N-1 to level N. */
export function xpForLevel(level: number): number {
  const { xpBase, xpPerLevel, xpExponent } = PROGRESSION;
  return xpBase + level * xpPerLevel + Math.floor(level ** xpExponent);
}

/** XP needed for the player's next level. */
export function xpToNext(player: Readonly<Player>): number {
  return xpForLevel(player.level + 1);
}

/** Adds XP, levelling up as many times as it covers. Returns the levels gained. */
export function addXp(player: Player, amount: number): number {
  player.xp += amount;
  let gained = 0;
  for (let need = xpToNext(player); player.xp >= need; need = xpToNext(player)) {
    player.xp -= need;
    player.level++;
    gained++;
  }
  player.pendingLevelUps += gained;
  return gained;
}

/**
 * Every valid upgrade for the current loadout. Each target appears at most once.
 * Manual weapons are always owned, so they are only ever offered as upgrades.
 */
export function buildCandidates(player: Readonly<Player>): Offer[] {
  const out: Offer[] = [];
  const max = PROGRESSION.maxLevel;
  for (const id of WEAPON_IDS) {
    const owned = findOwnedWeapon(player, id);
    if (owned) {
      if (owned.level < max) out.push({ kind: 'upgradeWeapon', weaponId: id });
    } else if (!isManual(WEAPONS[id]) && player.weapons.length < PROGRESSION.maxWeapons) {
      out.push({ kind: 'newWeapon', weaponId: id });
    }
  }
  for (const id of PASSIVE_IDS) {
    const owned = player.passives.find((p) => p.def.id === id);
    if (owned) {
      if (owned.level < max) out.push({ kind: 'upgradePassive', passiveId: id });
    } else if (player.passives.length < PROGRESSION.maxPassives) {
      out.push({ kind: 'newPassive', passiveId: id });
    }
  }
  return out;
}

/** Up to `count` distinct random picks from `pool`; a lone heal when it is empty. */
function sample(pool: Offer[], rng: Rng, count: number): Offer[] {
  if (pool.length === 0) return [{ kind: 'heal' }];
  // Partial Fisher-Yates: the first `count` slots end up a uniform random sample.
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const j = rng.int(i, pool.length - 1);
    const tmp = pool[i] as Offer;
    pool[i] = pool[j] as Offer;
    pool[j] = tmp;
  }
  return pool.slice(0, n);
}

/** Up to `count` distinct random candidates; a lone heal when nothing is left. */
export function rollOffers(
  player: Readonly<Player>,
  rng: Rng,
  count: number = PROGRESSION.offerCount,
): Offer[] {
  return sample(buildCandidates(player), rng, count);
}

export function applyOffer(player: Player, offer: Readonly<Offer>): void {
  switch (offer.kind) {
    case 'newWeapon':
      if (!findOwnedWeapon(player, offer.weaponId) && !isManual(WEAPONS[offer.weaponId])) {
        player.weapons.push(createWeapon(offer.weaponId));
      }
      break;
    case 'upgradeWeapon': {
      const w = findOwnedWeapon(player, offer.weaponId);
      if (w) w.level = Math.min(PROGRESSION.maxLevel, w.level + 1);
      break;
    }
    case 'newPassive':
      if (!findPassive(player, offer.passiveId)) addPassive(player, offer.passiveId);
      break;
    case 'upgradePassive': {
      const p = findPassive(player, offer.passiveId);
      if (p) p.level = Math.min(PROGRESSION.maxLevel, p.level + 1);
      recomputeStats(player);
      break;
    }
    case 'heal':
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp * PROGRESSION.healFraction);
      break;
  }
}

/** Boss chest: a free level for one of the weapons you own; heal if all are maxed. */
export function rollChestOffers(
  player: Readonly<Player>,
  rng: Rng,
  count: number = PROGRESSION.offerCount,
): Offer[] {
  const pool: Offer[] = buildCandidates(player).filter((o) => o.kind === 'upgradeWeapon');
  return sample(pool, rng, count);
}

function rollFor(world: World): Offer[] {
  return world.offerSource === 'chest'
    ? rollChestOffers(world.player, world.rng)
    : rollOffers(world.player, world.rng);
}

/** Shows the next pending choice (chests first, then levels) or resumes play. */
function openNextChoice(world: World): void {
  const p = world.player;
  if (p.pendingChests > 0) {
    world.offerSource = 'chest';
  } else if (p.pendingLevelUps > 0) {
    world.offerSource = 'level';
  } else {
    world.offers = [];
    world.status = 'playing';
    return;
  }
  const wasChoosing = world.status === 'levelup';
  world.status = 'levelup';
  world.offers = rollFor(world);
  // Only the first screen of a chain gets a fanfare; the rest follow right after a click.
  if (!wasChoosing) {
    const type = world.offerSource === 'chest' ? 'chestOpen' : 'levelUp';
    emit(world.events, type, p.pos.x, p.pos.y);
  }
}

/** Pauses the run for an upgrade choice whenever level-ups or chests are pending. */
export function progressionSystem(world: World): void {
  if (world.status !== 'playing') return;
  if (world.player.pendingChests > 0 || world.player.pendingLevelUps > 0) openNextChoice(world);
}

/** Level shown on the current level-up screen (the oldest pending one). */
export function levelBeingChosen(player: Readonly<Player>): number {
  return player.level - player.pendingLevelUps + 1;
}

/** Applies the chosen offer; then shows the next pending choice or resumes play. */
export function chooseOffer(world: World, index: number): boolean {
  if (world.status !== 'levelup') return false;
  const offer = world.offers[index];
  if (!offer) return false;
  applyOffer(world.player, offer);
  const p = world.player;
  if (world.offerSource === 'chest') p.pendingChests = Math.max(0, p.pendingChests - 1);
  else p.pendingLevelUps = Math.max(0, p.pendingLevelUps - 1);
  openNextChoice(world);
  return true;
}

/** Re-rolls the current offers if a reroll is left. */
export function rerollOffers(world: World): boolean {
  if (world.status !== 'levelup' || world.rerollsLeft <= 0) return false;
  world.rerollsLeft--;
  world.offers = rollFor(world);
  return true;
}
