/** One synthesized voice: an oscillator (or filtered noise) with a pitch sweep and a quick fade. */
export interface ToneSpec {
  wave: OscillatorType | 'noise';
  /** Hz at the start and at the end of the sweep (ignored by noise unless filtered). */
  freqFrom: number;
  freqTo: number;
  /** Seconds. */
  duration: number;
  /** Peak volume, 0..1 (before the master volume). */
  gain: number;
  /** Seconds after the sound starts (for jingles and two-part sounds). */
  delay?: number;
  /** Noise only: filter whose cutoff follows freqFrom → freqTo. */
  filter?: 'lowpass' | 'highpass' | 'bandpass';
}

export interface SoundDef {
  layers: readonly ToneSpec[];
  /** The same sound is skipped if it was played less than this long ago, s. */
  minInterval: number;
}

export const AUDIO = {
  masterGain: 0.5,
  /** Voices alive at once; extra sounds are dropped. */
  maxVoices: 28,
  /** Attack time of every voice, s (avoids clicks). */
  attack: 0.005,
  /** Length of the shared white-noise buffer, s. */
  noiseSeconds: 1,
} as const;

const note = (
  freq: number,
  delay: number,
  duration: number,
  gain = 0.14,
  wave: OscillatorType = 'triangle',
): ToneSpec => ({ wave, freqFrom: freq, freqTo: freq, duration, gain, delay });

const SOUND_TABLE = {
  enemyHit: {
    minInterval: 0.05,
    layers: [{ wave: 'square', freqFrom: 220, freqTo: 90, duration: 0.06, gain: 0.07 }],
  },
  meleeSwing: {
    minInterval: 0.08,
    layers: [
      { wave: 'noise', filter: 'bandpass', freqFrom: 600, freqTo: 2200, duration: 0.14, gain: 0.3 },
    ],
  },
  gunFire: {
    minInterval: 0.04,
    layers: [
      { wave: 'noise', filter: 'lowpass', freqFrom: 4000, freqTo: 600, duration: 0.08, gain: 0.3 },
      { wave: 'square', freqFrom: 900, freqTo: 180, duration: 0.05, gain: 0.06 },
    ],
  },
  reloadStart: {
    minInterval: 0.2,
    layers: [
      { wave: 'triangle', freqFrom: 520, freqTo: 340, duration: 0.05, gain: 0.14 },
      {
        wave: 'noise',
        filter: 'highpass',
        freqFrom: 2500,
        freqTo: 2500,
        duration: 0.05,
        gain: 0.12,
        delay: 0.09,
      },
    ],
  },
  reloadDone: {
    minInterval: 0.2,
    layers: [
      { wave: 'square', freqFrom: 1300, freqTo: 900, duration: 0.03, gain: 0.08 },
      { wave: 'triangle', freqFrom: 700, freqTo: 700, duration: 0.05, gain: 0.12, delay: 0.05 },
    ],
  },
  dryFire: {
    minInterval: 0.15,
    layers: [{ wave: 'square', freqFrom: 1900, freqTo: 1600, duration: 0.025, gain: 0.08 }],
  },
  weaponSwap: {
    minInterval: 0.1,
    layers: [
      { wave: 'triangle', freqFrom: 380, freqTo: 680, duration: 0.07, gain: 0.12 },
      { wave: 'triangle', freqFrom: 680, freqTo: 520, duration: 0.06, gain: 0.1, delay: 0.06 },
    ],
  },
  ammoPickup: {
    minInterval: 0.06,
    layers: [
      { wave: 'square', freqFrom: 500, freqTo: 500, duration: 0.05, gain: 0.06 },
      { wave: 'square', freqFrom: 750, freqTo: 750, duration: 0.07, gain: 0.06, delay: 0.06 },
    ],
  },
  couponPickup: {
    minInterval: 0.035,
    layers: [{ wave: 'sine', freqFrom: 1250, freqTo: 1700, duration: 0.05, gain: 0.07 }],
  },
  medkitPickup: {
    minInterval: 0.2,
    layers: [note(440, 0, 0.09), note(554, 0.08, 0.09), note(659, 0.16, 0.18)],
  },
  magnetPickup: {
    minInterval: 0.2,
    layers: [{ wave: 'sine', freqFrom: 300, freqTo: 1500, duration: 0.35, gain: 0.1 }],
  },
  canThrow: {
    minInterval: 0.08,
    layers: [{ wave: 'triangle', freqFrom: 260, freqTo: 520, duration: 0.07, gain: 0.08 }],
  },
  explosion: {
    minInterval: 0.08,
    layers: [
      { wave: 'noise', filter: 'lowpass', freqFrom: 1400, freqTo: 200, duration: 0.3, gain: 0.35 },
      { wave: 'sine', freqFrom: 130, freqTo: 40, duration: 0.3, gain: 0.25 },
    ],
  },
  /** Grenade cans: a smaller blast than the cashier's receipts. */
  canExplosion: {
    minInterval: 0.1,
    layers: [
      { wave: 'noise', filter: 'lowpass', freqFrom: 1100, freqTo: 250, duration: 0.18, gain: 0.18 },
    ],
  },
  /** Electric broom discharge. */
  chainZap: {
    minInterval: 0.08,
    layers: [
      { wave: 'sawtooth', freqFrom: 1800, freqTo: 600, duration: 0.09, gain: 0.07 },
      {
        wave: 'noise',
        filter: 'highpass',
        freqFrom: 3000,
        freqTo: 5000,
        duration: 0.08,
        gain: 0.06,
      },
    ],
  },
  playerHurt: {
    minInterval: 0.15,
    layers: [
      { wave: 'sawtooth', freqFrom: 220, freqTo: 80, duration: 0.18, gain: 0.16 },
      { wave: 'noise', filter: 'lowpass', freqFrom: 900, freqTo: 300, duration: 0.12, gain: 0.18 },
    ],
  },
  levelUp: {
    minInterval: 0.3,
    layers: [note(523, 0, 0.1), note(659, 0.08, 0.1), note(784, 0.16, 0.1), note(1046, 0.24, 0.22)],
  },
  chestOpen: {
    minInterval: 0.3,
    layers: [
      note(784, 0, 0.08, 0.1, 'square'),
      note(988, 0.07, 0.08, 0.1, 'square'),
      note(1175, 0.14, 0.08, 0.1, 'square'),
      note(1568, 0.21, 0.3, 0.12),
    ],
  },
  bossSpawn: {
    minInterval: 1,
    layers: [
      { wave: 'sawtooth', freqFrom: 75, freqTo: 52, duration: 1, gain: 0.22 },
      { wave: 'square', freqFrom: 112, freqTo: 98, duration: 0.9, gain: 0.08 },
      { wave: 'sawtooth', freqFrom: 75, freqTo: 50, duration: 0.8, gain: 0.18, delay: 1.1 },
    ],
  },
  shockwave: {
    minInterval: 0.3,
    layers: [
      { wave: 'sine', freqFrom: 95, freqTo: 30, duration: 0.6, gain: 0.35 },
      { wave: 'noise', filter: 'lowpass', freqFrom: 500, freqTo: 120, duration: 0.5, gain: 0.25 },
    ],
  },
  bossDeath: {
    minInterval: 1,
    layers: [
      { wave: 'noise', filter: 'lowpass', freqFrom: 1200, freqTo: 100, duration: 0.9, gain: 0.35 },
      { wave: 'sawtooth', freqFrom: 180, freqTo: 30, duration: 1, gain: 0.2 },
      note(523, 0.7, 0.12),
      note(659, 0.82, 0.12),
      note(784, 0.94, 0.3),
    ],
  },
  victory: {
    minInterval: 2,
    layers: [
      note(392, 0, 0.14),
      note(523, 0.14, 0.14),
      note(659, 0.28, 0.14),
      note(784, 0.42, 0.24),
      note(659, 0.68, 0.12),
      note(784, 0.8, 0.14),
      note(1046, 0.94, 0.6, 0.16),
      note(523, 0.94, 0.6, 0.08, 'sine'),
    ],
  },
  defeat: {
    minInterval: 2,
    layers: [
      note(330, 0, 0.3, 0.12, 'sawtooth'),
      note(262, 0.3, 0.3, 0.12, 'sawtooth'),
      note(196, 0.6, 0.3, 0.12, 'sawtooth'),
      { wave: 'sawtooth', freqFrom: 147, freqTo: 110, duration: 0.9, gain: 0.12, delay: 0.9 },
    ],
  },
} satisfies Record<string, SoundDef>;

export type SoundId = keyof typeof SOUND_TABLE;

export const SOUNDS: Readonly<Record<SoundId, Readonly<SoundDef>>> = SOUND_TABLE;
export const SOUND_IDS = Object.keys(SOUND_TABLE) as SoundId[];
