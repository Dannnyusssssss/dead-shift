export type WeaponId = 'broom';

/** Melee sweep in front of the player that hits everything inside the arc. */
export interface ArcLevel {
  damage: number;
  /** Seconds between sweeps. */
  cooldown: number;
  arcDegrees: number;
  /** Reach from the player's center, px. */
  range: number;
  /** Knockback impulse, px/s. */
  knockback: number;
  /** Also sweeps behind the player. */
  bothSides: boolean;
}

export interface ArcWeaponDef {
  id: WeaponId;
  behavior: 'arc';
  /** Index 0 = level 1. */
  levels: readonly Readonly<ArcLevel>[];
}

export type WeaponDef = ArcWeaponDef;

export const WEAPONS: Readonly<Record<WeaponId, Readonly<WeaponDef>>> = {
  broom: {
    id: 'broom',
    behavior: 'arc',
    levels: [
      { damage: 10, cooldown: 1.2, arcDegrees: 100, range: 75, knockback: 220, bothSides: false },
    ],
  },
};

export const STARTING_WEAPON: WeaponId = 'broom';
