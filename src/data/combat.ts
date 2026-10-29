export const COMBAT = {
  /** Hard cap of simultaneous enemies; the spawner stops at this count. */
  maxEnemies: 400,
  /** Spawn ring radius used when the view size is unknown (tests, tiny screens). */
  spawnRingMinRadius: 700,
  /** Extra distance beyond the view's half diagonal so spawns are off-screen. */
  spawnRingMargin: 60,
  /** Random extra depth of the ring, px. */
  spawnRingThickness: 120,
  /** Enemies farther than spawnRadius * this are moved back onto the ring. */
  relocateFactor: 1.6,
  /** Max offset of group members from the group center, px. */
  groupSpread: 45,
  /** Exponential decay of knockback velocity, 1/s. */
  knockbackDecay: 12,
  /** White flash after an enemy is hit, s. */
  hitFlashTime: 0.1,
  /** Fraction of an overlap between two enemies resolved per step. */
  separationStrength: 0.5,
  /** Spatial hash cell size, px. */
  cellSize: 64,
  /** Max ids returned by one spatial query. */
  queryBufferSize: 512,
  /** Max gameplay events buffered between two renders. */
  eventCapacity: 512,
  /** Max enemy hits (floating damage numbers) buffered between two renders. */
  hitCapacity: 512,
  projectileCapacity: 300,
  turretCapacity: 4,
  /** Nearest-enemy targeting ignores anything farther than this, px. */
  maxTargetDistance: 600,
  /** Max enemies one projectile remembers having hit (pierce + 1 must fit). */
  maxProjectileHits: 4,
  /** Enemy hp and damage grow by this fraction per minute of game time. */
  scalingPerMinute: 0.08,
  /** Puddles, receipts and shockwaves alive at once. */
  hazardCapacity: 160,
  /** Receipts explode after this long even if they never reach the target, s. */
  receiptMaxLife: 3,
  /** Size of a flying receipt for shelf collisions, px. */
  receiptRadius: 5,
  /** Footprint of a placed microwave, kept clear of shelves, px. */
  turretRadius: 16,
  /** Shockwave ring thickness that counts as a hit, px. */
  shockwaveThickness: 26,
} as const;
