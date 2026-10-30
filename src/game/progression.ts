import type { Rng } from '../core/rng';
import { PROGRESSION } from '../data/progression';
import { PASSIVE_IDS, type PassiveId } from '../data/upgrades';
import {
  PISTOL_MOD_IDS,
  PISTOL_MOD_RULES,
  WEAPON_IDS,
  WEAPONS,
  isManual,
  type PistolModId,
  type WeaponId,
} from '../data/weapons';
import { emit } from './events';
import { addManualWeapon, addPistolMod, entryOf, gunDefOf } from './manual';
import { addPassive, findOwnedWeapon, findPassive, recomputeStats, type Player } from './player';
import { createWeapon } from './weapons';
import type { World } from './world';

export type Offer =
  | { kind: 'newWeapon'; weaponId: WeaponId }
  | { kind: 'upgradeWeapon'; weaponId: WeaponId }
  | { kind: 'newPassive'; passiveId: PassiveId }
  | { kind: 'upgradePassive'; passiveId: PassiveId }
  | { kind: 'pistolMod'; modId: PistolModId }
  | { kind: 'heal' };

/** XP needed to go from level N-1 to level N. */
export function xpForLevel(level: number): number {
  const { xpBase, xpPerLevel, xpPowerCoef, xpExponent } = PROGRESSION;
  return xpBase + level * xpPerLevel + Math.floor(xpPowerCoef * level ** xpExponent);
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
 * A weapon the player doesn't own yet that may be offered as new: an automatic one while a slot
 * is free, or a manual one with `offerFromLevel` once the player reaches it (no slot needed).
 */
function canOfferNew(player: Readonly<Player>, id: WeaponId): boolean {
  const def = WEAPONS[id];
  if (!isManual(def)) return player.weapons.length < PROGRESSION.maxWeapons;
  const from = gunDefOf(id)?.offerFromLevel;
  return from !== undefined && player.level >= from;
}

/** Pistol mods still available: the pistol is high enough, under the per-run limit, not taken. */
function modCandidates(player: Readonly<Player>, out: Offer[]): void {
  const m = player.manual;
  const level = entryOf(m, PISTOL_MOD_RULES.weapon)?.weapon.level ?? 0;
  if (level < PISTOL_MOD_RULES.minWeaponLevel || m.mods.length >= PISTOL_MOD_RULES.maxPerRun)
    return;
  for (const id of PISTOL_MOD_IDS) {
    if (!m.mods.includes(id)) out.push({ kind: 'pistolMod', modId: id });
  }
}

/**
 * Every valid upgrade for the current loadout. Each target appears at most once.
 * The starting manual weapons are always owned, so they are only ever offered as upgrades.
 */
export function buildCandidates(player: Readonly<Player>): Offer[] {
  const out: Offer[] = [];
  const max = PROGRESSION.maxLevel;
  for (const id of WEAPON_IDS) {
    const owned = findOwnedWeapon(player, id);
    if (owned) {
      if (owned.level < max) out.push({ kind: 'upgradeWeapon', weaponId: id });
    } else if (canOfferNew(player, id)) {
      out.push({ kind: 'newWeapon', weaponId: id });
    }
  }
  modCandidates(player, out);
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
      if (findOwnedWeapon(player, offer.weaponId)) break;
      if (isManual(WEAPONS[offer.weaponId])) addManualWeapon(player.manual, offer.weaponId);
      else player.weapons.push(createWeapon(offer.weaponId));
      break;
    case 'pistolMod':
      addPistolMod(player.manual, offer.modId);
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

/** Manual weapon the first boss chest always offers if the player doesn't have it yet. */
export const FIRST_CHEST_WEAPON: WeaponId = 'shotgun';

/**
 * Boss chest: a free level for one of the weapons you own; heal if all are maxed. The first
 * chest of the run also always offers the shotgun (if not owned yet) as one of the options.
 */
export function rollChestOffers(
  player: Readonly<Player>,
  rng: Rng,
  count: number = PROGRESSION.offerCount,
): Offer[] {
  const pool: Offer[] = buildCandidates(player).filter((o) => o.kind === 'upgradeWeapon');
  const guaranteed = player.chestsOpened === 0 && !findOwnedWeapon(player, FIRST_CHEST_WEAPON);
  if (!guaranteed) return sample(pool, rng, count);
  const rest = pool.length > 0 ? sample(pool, rng, count - 1) : [];
  return [{ kind: 'newWeapon', weaponId: FIRST_CHEST_WEAPON }, ...rest];
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
  if (world.offerSource === 'chest') {
    p.pendingChests = Math.max(0, p.pendingChests - 1);
    p.chestsOpened++;
  } else p.pendingLevelUps = Math.max(0, p.pendingLevelUps - 1);
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
