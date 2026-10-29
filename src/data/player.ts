export interface PlayerStats {
  maxHp: number;
  /** px/s */
  speed: number;
  /** px */
  pickupRadius: number;
  /** Seconds of invulnerability after being hit. */
  invulnTime: number;
  /** Collision radius in px. */
  radius: number;
}

/** "Mati, el repositor". */
export const PLAYER_BASE: Readonly<PlayerStats> = {
  maxHp: 100,
  speed: 150,
  pickupRadius: 60,
  invulnTime: 0.5,
  radius: 14,
};
