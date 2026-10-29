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
} as const;
