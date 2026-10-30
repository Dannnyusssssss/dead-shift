import { EVOLUTIONS, EVOLUTION_RULES, type EvolutionDef } from '../data/evolutions';
import { PROGRESSION } from '../data/progression';
import type { TextKey } from '../data/texts';
import { WEAPON_IDS, type WeaponId } from '../data/weapons';
import { findOwnedWeapon, type Player } from './player';
import type { WeaponInstance } from './weapons';

/** The extra last level of every weapon table: the evolved weapon. */
export const EVOLVED_LEVEL = PROGRESSION.maxLevel + 1;

export function recipeFor(id: WeaponId): Readonly<EvolutionDef> | undefined {
  return EVOLUTIONS.find((e) => e.weapon === id);
}

export function isEvolved(w: Readonly<WeaponInstance>): boolean {
  return w.level > PROGRESSION.maxLevel;
}

/** How far the player is from a weapon's evolution (levels are 0 when not owned). */
export interface RecipeStatus {
  recipe: Readonly<EvolutionDef>;
  weaponLevel: number;
  passiveLevel: number;
  weaponReady: boolean;
  passiveReady: boolean;
  evolved: boolean;
  /** Both parts met and not evolved yet: it can be offered. */
  ready: boolean;
}

export function recipeStatus(player: Readonly<Player>, id: WeaponId): RecipeStatus | undefined {
  const recipe = recipeFor(id);
  if (!recipe) return undefined;
  const weapon = findOwnedWeapon(player, id);
  const weaponLevel = weapon?.level ?? 0;
  const passiveLevel = player.passives.find((p) => p.def.id === recipe.passive)?.level ?? 0;
  const evolved = weapon !== undefined && isEvolved(weapon);
  const weaponReady = weaponLevel >= PROGRESSION.maxLevel;
  const passiveReady = passiveLevel >= EVOLUTION_RULES.minPassiveLevel;
  return {
    recipe,
    weaponLevel,
    passiveLevel,
    weaponReady,
    passiveReady,
    evolved,
    ready: weaponReady && passiveReady && !evolved,
  };
}

/** Weapons whose recipe is complete, in WEAPON_IDS order. */
export function readyEvolutions(player: Readonly<Player>): WeaponId[] {
  return WEAPON_IDS.filter((id) => recipeStatus(player, id)?.ready === true);
}

/** Turns the weapon into its evolution in place (same slot, ammo and key). */
export function evolveWeapon(player: Player, id: WeaponId): boolean {
  if (recipeStatus(player, id)?.ready !== true) return false;
  const weapon = findOwnedWeapon(player, id);
  if (!weapon) return false;
  weapon.level = EVOLVED_LEVEL;
  return true;
}

/** Icon shown for a weapon: its evolution's once evolved. */
export function weaponIcon(w: Readonly<WeaponInstance>): string {
  return (isEvolved(w) ? recipeFor(w.def.id)?.icon : undefined) ?? w.def.icon;
}

/** Name text key shown for a weapon: its evolution's once evolved. */
export function weaponNameKey(w: Readonly<WeaponInstance>): TextKey {
  return (isEvolved(w) ? recipeFor(w.def.id)?.nameKey : undefined) ?? w.def.nameKey;
}
