export const PROGRESSION = {
  maxWeapons: 4,
  maxPassives: 4,
  /** Max level of every weapon and passive. */
  maxLevel: 5,
  offerCount: 3,
  rerollsPerRun: 3,
  /** Relative chance of each kind of card in a draw: upgrades of weapons you own weigh more. */
  offerWeights: {
    newWeapon: 1,
    upgradeWeapon: 2.5,
    newPassive: 1,
    upgradePassive: 1,
    pistolMod: 1,
  },
  /** Fraction of max hp restored by the fallback "heal" offer. */
  healFraction: 0.3,
  /** XP needed to reach level N: base + N * perLevel + floor(powerCoef * N ^ exponent). */
  xpBase: 4,
  xpPerLevel: 2,
  xpPowerCoef: 0,
  xpExponent: 1.5,
  /** Lower bound of the cooldown multiplier, whatever passives stack up. */
  minCooldownMultiplier: 0.2,
} as const;

export const COUPONS = {
  capacity: 600,
  /** Collision radius, px. */
  radius: 7,
  /** Speed when the magnet first grabs a coupon, px/s. */
  attractStartSpeed: 90,
  /** px/s² */
  attractAccel: 1100,
  maxSpeed: 700,
  /** Boss chest pickup radius, px. */
  chestRadius: 18,
  chestCapacity: 4,
} as const;

/** Rare floor pickups: medkits (heal) and the floor magnet (pulls every coupon). */
export const FLOOR_ITEMS = {
  capacity: 16,
  /** Pickup collision radius, px. */
  radius: 10,
  medkit: {
    /** Fraction of max hp restored. */
    healFraction: 0.25,
    /** Drop chance by enemy xp value: the first tier whose `minXp` the enemy reaches (elites and the boss). */
    dropTiers: [
      { minXp: 20, chance: 1 },
      { minXp: 5, chance: 0.04 },
    ],
  },
  magnet: {
    /** Drop chance from any enemy. */
    chance: 0.002,
  },
} as const;
