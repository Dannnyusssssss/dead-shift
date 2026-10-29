export const PROGRESSION = {
  maxWeapons: 4,
  maxPassives: 4,
  /** Max level of every weapon and passive. */
  maxLevel: 5,
  offerCount: 3,
  rerollsPerRun: 1,
  /** Fraction of max hp restored by the fallback "heal" offer. */
  healFraction: 0.3,
  /** XP needed to reach level N: base + N * perLevel + floor(N ^ exponent). */
  xpBase: 5,
  xpPerLevel: 4,
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
