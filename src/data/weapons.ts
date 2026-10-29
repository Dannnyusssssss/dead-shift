import type { TextKey } from './texts';

export type WeaponId = 'broom' | 'cans' | 'ice' | 'aerosol' | 'microwave' | 'labelGun';

/** Stable order; also the index of per-enemy, per-weapon hit timers. */
export const WEAPON_IDS: readonly WeaponId[] = [
  'broom',
  'cans',
  'ice',
  'aerosol',
  'microwave',
  'labelGun',
];

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

/** Shots that fly in a straight line. */
export interface ProjectileLevel {
  damage: number;
  cooldown: number;
  /** Projectiles per volley. */
  count: number;
  /** Extra enemies a projectile passes through. */
  pierce: number;
  /** Angle between projectiles of the same volley. */
  spreadDegrees: number;
  /** px/s */
  speed: number;
  /** Collision radius, px. */
  radius: number;
  /** Seconds before it disappears. */
  lifetime: number;
  knockback: number;
}

/** Objects circling the player that hurt what they touch. */
export interface OrbitLevel {
  damage: number;
  bags: number;
  orbitRadius: number;
  /** rad/s */
  angularSpeed: number;
  /** Collision radius of each bag, px. */
  bagRadius: number;
  /** Minimum time between hits on the same enemy, s. */
  hitInterval: number;
  /** Fraction of speed removed while slowed. */
  slowFactor: number;
  slowTime: number;
  knockback: number;
}

/** Gas cone in front of the player that ticks damage while active. */
export interface ConeLevel {
  damage: number;
  /** Seconds between damage ticks. */
  tickInterval: number;
  /** Seconds the cloud stays active. */
  activeTime: number;
  /** Pause after the cloud ends, s. */
  cooldown: number;
  range: number;
  angleDegrees: number;
  /** Poison damage per second applied to hit enemies (0 = none). */
  poisonDps: number;
  poisonTime: number;
}

/** Placed device that zaps nearby enemies on its own. */
export interface TurretLevel {
  damage: number;
  /** Seconds between zaps. */
  cooldown: number;
  /** Seconds a placed unit lasts. */
  duration: number;
  /** Pause after a unit expires before placing again, s. */
  respawnDelay: number;
  /** Enemies zapped per shot. */
  rays: number;
  range: number;
  /** Units placed at once. */
  units: number;
}

interface WeaponBase {
  id: WeaponId;
  icon: string;
  nameKey: TextKey;
  descKey: TextKey;
}

export interface ArcWeaponDef extends WeaponBase {
  behavior: 'arc';
  /** Index 0 = level 1. */
  levels: readonly Readonly<ArcLevel>[];
}

export type ProjectileLook = 'can' | 'label';

export interface ProjectileWeaponDef extends WeaponBase {
  /** `projectile` aims at the nearest enemy; `stream` fires where the player faces. */
  behavior: 'projectile' | 'stream';
  look: ProjectileLook;
  levels: readonly Readonly<ProjectileLevel>[];
}

export interface OrbitWeaponDef extends WeaponBase {
  behavior: 'orbit';
  levels: readonly Readonly<OrbitLevel>[];
}

export interface ConeWeaponDef extends WeaponBase {
  behavior: 'cone';
  levels: readonly Readonly<ConeLevel>[];
}

export interface TurretWeaponDef extends WeaponBase {
  behavior: 'turret';
  levels: readonly Readonly<TurretLevel>[];
}

export type WeaponDef =
  ArcWeaponDef | ProjectileWeaponDef | OrbitWeaponDef | ConeWeaponDef | TurretWeaponDef;

export type WeaponLevel = WeaponDef['levels'][number];

const broomL1: ArcLevel = {
  damage: 10,
  cooldown: 1.2,
  arcDegrees: 100,
  range: 75,
  knockback: 220,
  bothSides: false,
};
const broomL3: ArcLevel = { ...broomL1, damage: 14, arcDegrees: 130, range: 85 };
const broomL4: ArcLevel = { ...broomL3, damage: 18, cooldown: 1.1 };

const cansL1: ProjectileLevel = {
  damage: 8,
  cooldown: 0.9,
  count: 1,
  pierce: 0,
  spreadDegrees: 10,
  speed: 360,
  radius: 7,
  lifetime: 1.6,
  knockback: 120,
};
const cansL4: ProjectileLevel = { ...cansL1, damage: 12, count: 3, pierce: 1 };

const iceL1: OrbitLevel = {
  damage: 6,
  bags: 2,
  orbitRadius: 70,
  angularSpeed: 3,
  bagRadius: 11,
  hitInterval: 0.5,
  slowFactor: 0.4,
  slowTime: 1,
  knockback: 80,
};
const iceL3: OrbitLevel = { ...iceL1, bags: 3, orbitRadius: 85, damage: 8 };

const aerosolL1: ConeLevel = {
  damage: 4,
  tickInterval: 0.25,
  activeTime: 1.5,
  cooldown: 3,
  range: 110,
  angleDegrees: 60,
  poisonDps: 0,
  poisonTime: 0,
};
const aerosolL3: ConeLevel = { ...aerosolL1, range: 130, activeTime: 2 };

const microwaveL1: TurretLevel = {
  damage: 7,
  cooldown: 0.7,
  duration: 8,
  respawnDelay: 4,
  rays: 1,
  range: 220,
  units: 1,
};
const microwaveL4: TurretLevel = { ...microwaveL1, rays: 3, duration: 10, damage: 9 };

const labelL1: ProjectileLevel = {
  damage: 3,
  cooldown: 0.15,
  count: 1,
  pierce: 0,
  spreadDegrees: 0,
  speed: 520,
  radius: 4,
  lifetime: 0.8,
  knockback: 30,
};
const labelL3: ProjectileLevel = { ...labelL1, cooldown: 0.12, damage: 4 };

export const WEAPONS: Readonly<Record<WeaponId, Readonly<WeaponDef>>> = {
  broom: {
    id: 'broom',
    behavior: 'arc',
    icon: '🧹',
    nameKey: 'weaponBroom',
    descKey: 'weaponBroomDesc',
    levels: [
      broomL1,
      { ...broomL1, damage: 14 },
      broomL3,
      broomL4,
      { ...broomL4, bothSides: true },
    ],
  },
  cans: {
    id: 'cans',
    behavior: 'projectile',
    look: 'can',
    icon: '🥫',
    nameKey: 'weaponCans',
    descKey: 'weaponCansDesc',
    levels: [
      cansL1,
      { ...cansL1, count: 2 },
      { ...cansL1, count: 2, damage: 12 },
      cansL4,
      { ...cansL4, damage: 15, pierce: 2 },
    ],
  },
  ice: {
    id: 'ice',
    behavior: 'orbit',
    icon: '🧊',
    nameKey: 'weaponIce',
    descKey: 'weaponIceDesc',
    levels: [
      iceL1,
      { ...iceL1, bags: 3 },
      iceL3,
      { ...iceL3, bags: 4, angularSpeed: 4 },
      { ...iceL3, bags: 5, angularSpeed: 4, orbitRadius: 100, damage: 10 },
    ],
  },
  aerosol: {
    id: 'aerosol',
    behavior: 'cone',
    icon: '🧴',
    nameKey: 'weaponAerosol',
    descKey: 'weaponAerosolDesc',
    levels: [
      aerosolL1,
      { ...aerosolL1, range: 130 },
      aerosolL3,
      { ...aerosolL3, poisonDps: 3, poisonTime: 2 },
      { ...aerosolL3, poisonDps: 3, poisonTime: 2, range: 150, activeTime: 2.5, damage: 5 },
    ],
  },
  microwave: {
    id: 'microwave',
    behavior: 'turret',
    icon: '♨️',
    nameKey: 'weaponMicrowave',
    descKey: 'weaponMicrowaveDesc',
    levels: [
      microwaveL1,
      { ...microwaveL1, rays: 2 },
      { ...microwaveL1, rays: 2, duration: 10 },
      microwaveL4,
      { ...microwaveL4, units: 2 },
    ],
  },
  labelGun: {
    id: 'labelGun',
    behavior: 'stream',
    look: 'label',
    icon: '🏷️',
    nameKey: 'weaponLabelGun',
    descKey: 'weaponLabelGunDesc',
    levels: [
      labelL1,
      { ...labelL1, cooldown: 0.12 },
      labelL3,
      { ...labelL3, count: 2, spreadDegrees: 8 },
      { ...labelL3, count: 3, spreadDegrees: 12, cooldown: 0.09, damage: 5 },
    ],
  },
};

export const STARTING_WEAPON: WeaponId = 'broom';
