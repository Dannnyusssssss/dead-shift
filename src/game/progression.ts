import type { Rng } from '../core/rng';
import { PROGRESSION } from '../data/progression';
import { PASSIVE_IDS, type PassiveId } from '../data/upgrades';
import { WEAPON_IDS, type WeaponId } from '../data/weapons';
import { addPassive, findPassive, recomputeStats, type Player } from './player';
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

function findWeapon(player: Readonly<Player>, id: WeaponId) {
  return player.weapons.find((w) => w.def.id === id);
}

/** Every valid upgrade for the current loadout. Each target appears at most once. */
export function buildCandidates(player: Readonly<Player>): Offer[] {
  const out: Offer[] = [];
  const max = PROGRESSION.maxLevel;
  for (const id of WEAPON_IDS) {
    const owned = findWeapon(player, id);
    if (owned) {
      if (owned.level < max) out.push({ kind: 'upgradeWeapon', weaponId: id });
    } else if (player.weapons.length < PROGRESSION.maxWeapons) {
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

/** Up to `count` distinct random candidates; a lone heal when nothing is left. */
export function rollOffers(
  player: Readonly<Player>,
  rng: Rng,
  count: number = PROGRESSION.offerCount,
): Offer[] {
  const pool = buildCandidates(player);
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

export function applyOffer(player: Player, offer: Readonly<Offer>): void {
  switch (offer.kind) {
    case 'newWeapon':
      if (!findWeapon(player, offer.weaponId)) player.weapons.push(createWeapon(offer.weaponId));
      break;
    case 'upgradeWeapon': {
      const w = findWeapon(player, offer.weaponId);
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

/** Pauses the run for an upgrade choice whenever level-ups are pending. */
export function progressionSystem(world: World): void {
  if (world.player.pendingLevelUps <= 0 || world.status !== 'playing') return;
  world.status = 'levelup';
  world.offers = rollOffers(world.player, world.rng);
}

/** Level shown on the current level-up screen (the oldest pending one). */
export function levelBeingChosen(player: Readonly<Player>): number {
  return player.level - player.pendingLevelUps + 1;
}

/** Applies the chosen offer; resumes play or rolls the next pending level-up. */
export function chooseOffer(world: World, index: number): boolean {
  if (world.status !== 'levelup') return false;
  const offer = world.offers[index];
  if (!offer) return false;
  applyOffer(world.player, offer);
  world.player.pendingLevelUps = Math.max(0, world.player.pendingLevelUps - 1);
  if (world.player.pendingLevelUps > 0) {
    world.offers = rollOffers(world.player, world.rng);
  } else {
    world.offers = [];
    world.status = 'playing';
  }
  return true;
}

/** Re-rolls the current offers if a reroll is left. */
export function rerollOffers(world: World): boolean {
  if (world.status !== 'levelup' || world.rerollsLeft <= 0) return false;
  world.rerollsLeft--;
  world.offers = rollOffers(world.player, world.rng);
  return true;
}
