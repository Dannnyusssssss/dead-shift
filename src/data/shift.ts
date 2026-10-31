/** The night shift: 10 real minutes cover 22:00 -> 06:00 on the in-game clock. */
export const SHIFT = {
  /** Real seconds until dawn (victory). */
  durationSeconds: 600,
  startHour: 22,
  /** In-game hours covered by the shift. */
  hours: 8,
} as const;

/** The 5 AM frenzy: from `startTime` on, the whole horde moves faster and shrugs off slows. */
export const FRENZY = {
  /** Hour on the shift clock when it starts (5:00 AM = 525 s of game time, minute 8:45). */
  startHour: 5,
  /** Multiplier on enemy speed. */
  speedMultiplier: 1.2,
  /** Fraction of every slow (ice bags, blizzard freeze) the horde ignores. */
  slowResist: 0.5,
} as const;
