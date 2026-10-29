/** The night shift: 10 real minutes cover 22:00 -> 06:00 on the in-game clock. */
export const SHIFT = {
  /** Real seconds until dawn (victory). */
  durationSeconds: 600,
  startHour: 22,
  /** In-game hours covered by the shift. */
  hours: 8,
} as const;
