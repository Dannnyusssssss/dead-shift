import type { TextKey } from './texts';
import type { PassiveId } from './upgrades';
import type { WeaponId } from './weapons';

export type EvolutionId =
  | 'electricBroom'
  | 'laserGun'
  | 'riotShotgun'
  | 'grenadeCans'
  | 'flamethrower'
  | 'blizzard'
  | 'industrialMicrowave';

/**
 * Recipe: `weapon` at its max regular level + `passive` at `EVOLUTION_RULES.minPassiveLevel`.
 * The evolved stats are the extra last level of the weapon's table (data/weapons.ts); the
 * evolution keeps the weapon's slot (or manual place), ammo and key.
 */
export interface EvolutionDef {
  id: EvolutionId;
  weapon: WeaponId;
  passive: PassiveId;
  icon: string;
  nameKey: TextKey;
  descKey: TextKey;
}

export const EVOLUTION_RULES = {
  /** Passive level the recipe asks for. */
  minPassiveLevel: 3,
} as const;

/** One recipe per weapon (7 weapons, 6 passives: the vest is shared). */
export const EVOLUTIONS: readonly Readonly<EvolutionDef>[] = [
  {
    id: 'electricBroom',
    weapon: 'broom',
    passive: 'magnet',
    icon: '⚡',
    nameKey: 'evoElectricBroom',
    descKey: 'evoElectricBroomDesc',
  },
  {
    id: 'laserGun',
    weapon: 'labelGun',
    passive: 'calculator',
    icon: '🔴',
    nameKey: 'evoLaserGun',
    descKey: 'evoLaserGunDesc',
  },
  {
    id: 'riotShotgun',
    weapon: 'shotgun',
    passive: 'vest',
    icon: '🛡️',
    nameKey: 'evoRiotShotgun',
    descKey: 'evoRiotShotgunDesc',
  },
  {
    id: 'grenadeCans',
    weapon: 'cans',
    passive: 'coffee',
    icon: '💣',
    nameKey: 'evoGrenadeCans',
    descKey: 'evoGrenadeCansDesc',
  },
  {
    id: 'flamethrower',
    weapon: 'aerosol',
    passive: 'soup',
    icon: '🔥',
    nameKey: 'evoFlamethrower',
    descKey: 'evoFlamethrowerDesc',
  },
  {
    id: 'blizzard',
    weapon: 'ice',
    passive: 'shoes',
    icon: '🌨️',
    nameKey: 'evoBlizzard',
    descKey: 'evoBlizzardDesc',
  },
  {
    id: 'industrialMicrowave',
    weapon: 'microwave',
    passive: 'vest',
    icon: '🏭',
    nameKey: 'evoIndustrialMicrowave',
    descKey: 'evoIndustrialMicrowaveDesc',
  },
];
