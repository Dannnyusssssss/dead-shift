/** Tile size of the floor grid, px (shared by the floor drawing and the shelf layout). */
export const TILE_SIZE = 64;

/**
 * Solid shelves. The world is split into blocks; each may hold one horizontal shelf whose
 * place is derived from `hash2(block, seed)`, so the map is infinite and needs no stored state.
 */
export const SHELF_LAYOUT = {
  /** Block size in tiles. */
  blockTilesX: 10,
  blockTilesY: 6,
  /** Probability a block has a shelf. */
  density: 0.75,
  minLengthTiles: 3,
  maxLengthTiles: 7,
  /** Free tiles kept at each horizontal end of the block, so shelves in neighboring blocks never touch. */
  marginTiles: 1,
  /** Shelf thickness (its footprint height), px. */
  depth: 44,
} as const;

/** How enemies deal with shelves in their way. */
export const SHELF_COLLISION = {
  /** Seconds an enemy remembers its last shelf contact (for sliding along it). */
  contactMemory: 0.2,
  /** Below this fraction of its speed along the shelf, an enemy slides at full speed toward a corner. */
  slideThreshold: 0.5,
  /** Distance within which touching a shelf already counts as touching it (sliding flush along it), px. */
  contactSkin: 1,
  /**
   * An enemy pressing against a shelf that hasn't moved this far from where it got stuck is
   * making no progress (sliding around a shelf moves it well past this), px.
   */
  progressDistance: 24,
  /** Seconds without progress against a shelf before the enemy is moved back to the spawn ring. */
  stuckTime: 1.5,
  /** Closer than this to the player an enemy is fighting, not stuck (crowds pile up near him), px. */
  engagedDistance: 100,
} as const;
