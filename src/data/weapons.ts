import type { TextKey } from './texts';

export type WeaponId = 'broom' | 'cans' | 'ice' | 'aerosol' | 'microwave' | 'labelGun' | 'shotgun';

/** Stable order (new weapons go at the end); also the index of per-enemy, per-weapon hit timers. */
export const WEAPON_IDS: readonly WeaponId[] = [
  'broom',
  'cans',
  'ice',
  'aerosol',
  'microwave',
  'labelGun',
  'shotgun',
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
  /** Electric broom: a discharge from the first zombie hit jumps to this many more. */
  chainJumps?: number;
  /** Max distance of each jump, px. */
  chainRange?: number;
  /** Damage of each jump as a fraction of the sweep's damage. */
  chainDamageFraction?: number;
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
  /** Burn applied on hit (reuses the poison of the aerosol), damage per second. Pistol mod. */
  burnDps?: number;
  burnTime?: number;
  /** Times a shot that would be used up jumps to the nearest enemy it hasn't hit. Pistol mod. */
  bounces?: number;
  /** Max distance of a bounce, px. */
  bounceRange?: number;
  /** Overrides the weapon's look (the laser pistol evolution). */
  look?: ProjectileLook;
  /** Grenade cans: blast radius on impact (zombie or shelf), px. */
  explosionRadius?: number;
  explosionDamage?: number;
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

/**
 * Every level table has `PROGRESSION.maxLevel` regular levels plus one more: the evolution
 * (see data/evolutions.ts). Level-ups stop at the regular max; only an evolution reaches the last.
 */
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

export type ProjectileLook = 'can' | 'label' | 'pellet' | 'laser';

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
  /**
   * Player level from which it can be offered as a new weapon (it then joins the manual weapons,
   * outside the slots). Without it the weapon is never offered as new (the starting ones).
   */
  offerFromLevel?: number;
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

// Shotgun: 5 pellets over ±15°, ~220 px of reach (600 px/s × 0.37 s), strong knockback.
const shotgunL1: GunLevel = {
  damage: 6,
  cooldown: 0.9,
  count: 5,
  pierce: 0,
  spreadDegrees: 7.5,
  speed: 600,
  radius: 4,
  lifetime: 0.37,
  knockback: 260,
  magazine: 6,
  reloadTime: 2,
};
const shotgunL3: GunLevel = { ...shotgunL1, damage: 7, count: 6, spreadDegrees: 6, magazine: 8 };
const shotgunL4: GunLevel = { ...shotgunL3, reloadTime: 1.6, cooldown: 0.75 };

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
      // Evolution: electric broom.
      {
        ...broomL4,
        damage: 22,
        cooldown: 0.55,
        bothSides: true,
        chainJumps: 4,
        chainRange: 120,
        chainDamageFraction: 0.6,
      },
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
      // Evolution: grenade cans.
      {
        ...cansL4,
        damage: 18,
        count: 4,
        cooldown: 0.8,
        pierce: 0,
        explosionRadius: 60,
        explosionDamage: 12,
      },
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
      // Evolution: blizzard (slowFactor 1 = frozen in place).
      {
        ...iceL3,
        bags: 6,
        angularSpeed: 4.5,
        orbitRadius: 130,
        damage: 12,
        slowFactor: 1,
        slowTime: 1.2,
      },
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
      // Evolution: homemade flamethrower (the poison becomes a burn).
      {
        damage: 7,
        tickInterval: 0.2,
        activeTime: 3,
        cooldown: 1.5,
        range: 170,
        angleDegrees: 70,
        poisonDps: 8,
        poisonTime: 3,
      },
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
      // Evolution: industrial microwave.
      {
        ...microwaveL4,
        units: 3,
        rays: 5,
        damage: 14,
        cooldown: 0.5,
        range: 280,
        duration: 12,
      },
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
      // Evolution: laser pistol (pierces everything a shot can remember).
      {
        ...labelL4,
        count: 1,
        damage: 16,
        cooldown: 0.09,
        pierce: 11,
        look: 'laser',
        speed: 1100,
        lifetime: 0.55,
        magazine: 30,
        reloadTime: 1,
      },
    ],
  },
  shotgun: {
    id: 'shotgun',
    behavior: 'gun',
    look: 'pellet',
    icon: '💥',
    nameKey: 'weaponShotgun',
    descKey: 'weaponShotgunDesc',
    ammo: { startReserve: 12, maxReserve: 36 },
    offerFromLevel: 4,
    levels: [
      shotgunL1,
      { ...shotgunL1, damage: 7 },
      shotgunL3,
      shotgunL4,
      { ...shotgunL4, count: 7, spreadDegrees: 5, damage: 8, pierce: 1 },
      // Evolution: riot shotgun.
      { ...shotgunL4, count: 9, spreadDegrees: 4, damage: 9, pierce: 3, knockback: 650 },
    ],
  },
};

/** Manual weapons (outside the automatic slots), in cycle order (Q / wheel) and auto-switch priority. */
export const MANUAL_ORDER: readonly WeaponId[] = ['labelGun', 'shotgun', 'broom'];

/** Manual weapons every run starts with. */
export const STARTING_MANUAL: readonly WeaponId[] = ['labelGun', 'broom'];

/** The melee fallback: always usable, picked last by the automatic switch. */
export const MELEE_FALLBACK: WeaponId = 'broom';

/** Number keys that select each manual weapon (fixed, so they never change meaning). */
export const MANUAL_KEYS: Readonly<Partial<Record<WeaponId, number>>> = {
  labelGun: 1,
  broom: 2,
  shotgun: 3,
};

export type PistolModId = 'piercing' | 'extendedMag' | 'incendiary' | 'ricochet';

export const PISTOL_MOD_IDS: readonly PistolModId[] = [
  'piercing',
  'extendedMag',
  'incendiary',
  'ricochet',
];

/** Pistol mod: a permanent tweak to the gun's stats. It has no levels and uses no slot. */
export interface PistolModDef {
  id: PistolModId;
  icon: string;
  nameKey: TextKey;
  descKey: TextKey;
  /** Extra enemies each shot passes through. */
  pierce?: number;
  /** Magazine size multiplier (rounded). */
  magazineMultiplier?: number;
  burnDps?: number;
  burnTime?: number;
  bounces?: number;
  bounceRange?: number;
}

export const PISTOL_MODS: Readonly<Record<PistolModId, Readonly<PistolModDef>>> = {
  piercing: {
    id: 'piercing',
    icon: '📌',
    nameKey: 'modPiercing',
    descKey: 'modPiercingDesc',
    pierce: 1,
  },
  extendedMag: {
    id: 'extendedMag',
    icon: '📦',
    nameKey: 'modExtendedMag',
    descKey: 'modExtendedMagDesc',
    magazineMultiplier: 1.5,
  },
  incendiary: {
    id: 'incendiary',
    icon: '🔥',
    nameKey: 'modIncendiary',
    descKey: 'modIncendiaryDesc',
    burnDps: 4,
    burnTime: 2,
  },
  ricochet: {
    id: 'ricochet',
    icon: '↪️',
    nameKey: 'modRicochet',
    descKey: 'modRicochetDesc',
    bounces: 1,
    bounceRange: 220,
  },
};

/** When pistol mods are offered: from this pistol level, and at most this many per run. */
export const PISTOL_MOD_RULES = {
  weapon: 'labelGun',
  minWeaponLevel: 3,
  maxPerRun: 2,
} as const satisfies { weapon: WeaponId; minWeaponLevel: number; maxPerRun: number };

/** Ammo boxes dropped by zombies. */
export const AMMO = {
  /** Rounds added to the pistol reserve per box (Hito 9: 15 → 20, see DECISIONS.md). */
  boxAmount: 20,
  /** Shells added to the shotgun reserve per shell box. */
  shellAmount: 6,
  /**
   * Once the player has the shotgun, this share of the drops are shell boxes instead of rounds
   * (the overall drop chance stays the same).
   */
  shellShare: 0.4,
  /** Drop chance by enemy xp value: the first tier whose `minXp` the enemy reaches. */
  dropTiers: [
    { minXp: 20, chance: 1 },
    { minXp: 5, chance: 0.5 },
    { minXp: 0, chance: 0.28 },
  ],
  capacity: 40,
  shellCapacity: 30,
  /** Pickup collision radius, px. */
  radius: 9,
} as const;
