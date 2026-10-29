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

/** Melee sweep toward the aim that hits everything inside the arc. */
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

/** Manual gun: a projectile weapon with a magazine. `cooldown` is the time between shots. */
export interface GunLevel extends ProjectileLevel {
  /** Rounds per magazine. */
  magazine: number;
  /** Seconds to reload. */
  reloadTime: number;
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

/** Manual melee weapon swung toward the aim while the trigger is held. */
export interface MeleeWeaponDef extends WeaponBase {
  behavior: 'melee';
  /** Index 0 = level 1. */
  levels: readonly Readonly<ArcLevel>[];
}

export type ProjectileLook = 'can' | 'label';

export interface AmmoSpec {
  /** Rounds in the reserve at the start of a run (the magazine starts full). */
  startReserve: number;
  maxReserve: number;
}

/** Manual gun fired toward the aim while the trigger is held. */
export interface GunWeaponDef extends WeaponBase {
  behavior: 'gun';
  look: ProjectileLook;
  ammo: AmmoSpec;
  levels: readonly Readonly<GunLevel>[];
}

/** Automatic: throws at the nearest enemy. */
export interface ProjectileWeaponDef extends WeaponBase {
  behavior: 'projectile';
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

export type ManualWeaponDef = MeleeWeaponDef | GunWeaponDef;
export type AutoWeaponDef = ProjectileWeaponDef | OrbitWeaponDef | ConeWeaponDef | TurretWeaponDef;
export type WeaponDef = ManualWeaponDef | AutoWeaponDef;

export function isManual(def: Readonly<WeaponDef>): def is Readonly<ManualWeaponDef> {
  return def.behavior === 'melee' || def.behavior === 'gun';
}

export type WeaponLevel = WeaponDef['levels'][number];

// Hito 7: toned down so the broom is a fallback, not the main weapon (see DECISIONS.md).
const broomL1: ArcLevel = {
  damage: 10,
  cooldown: 0.75,
  arcDegrees: 95,
  range: 65,
  knockback: 120,
  bothSides: false,
};
const broomL3: ArcLevel = { ...broomL1, damage: 14, arcDegrees: 125, range: 75 };
const broomL4: ArcLevel = { ...broomL3, damage: 18, cooldown: 0.63 };

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

const labelL1: GunLevel = {
  damage: 10,
  cooldown: 0.18,
  count: 1,
  pierce: 0,
  spreadDegrees: 0,
  speed: 640,
  radius: 4,
  lifetime: 0.9,
  knockback: 60,
  magazine: 12,
  reloadTime: 1.3,
};
const labelL3: GunLevel = { ...labelL1, damage: 12, magazine: 18, reloadTime: 1.1 };
const labelL4: GunLevel = { ...labelL3, pierce: 1, cooldown: 0.15 };

export const WEAPONS: Readonly<Record<WeaponId, Readonly<WeaponDef>>> = {
  broom: {
    id: 'broom',
    behavior: 'melee',
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
    behavior: 'gun',
    look: 'label',
    icon: '🏷️',
    nameKey: 'weaponLabelGun',
    descKey: 'weaponLabelGunDesc',
    ammo: { startReserve: 60, maxReserve: 120 },
    levels: [
      labelL1,
      { ...labelL1, damage: 12 },
      labelL3,
      labelL4,
      { ...labelL4, count: 2, spreadDegrees: 6, damage: 14 },
    ],
  },
};

/** The two manual weapons every run starts with (outside the automatic slots). */
export const MANUAL_WEAPONS = { gun: 'labelGun', melee: 'broom' } as const satisfies Record<
  string,
  WeaponId
>;

/** Ammo boxes dropped by zombies. */
export const AMMO = {
  /** Rounds added to the reserve per box. */
  boxAmount: 15,
  /** Drop chance by enemy xp value: the first tier whose `minXp` the enemy reaches. */
  dropTiers: [
    { minXp: 20, chance: 1 },
    { minXp: 5, chance: 0.5 },
    { minXp: 0, chance: 0.22 },
  ],
  capacity: 40,
  /** Pickup collision radius, px. */
  radius: 9,
} as const;
