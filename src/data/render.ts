import type { JoystickConfig } from '../core/input';

/** Max devicePixelRatio we render at (keeps fill-rate sane on 3x phones). */
export const MAX_DPR = 2;

export const CAMERA_FOLLOW_RATE = 10;

export const JOYSTICK: Readonly<JoystickConfig> = {
  radius: 60,
  deadZone: 0.15,
};

export const JOYSTICK_STYLE = {
  baseColor: 'rgba(255, 255, 255, 0.12)',
  baseStroke: 'rgba(255, 255, 255, 0.35)',
  knobColor: 'rgba(255, 255, 255, 0.45)',
  knobRadius: 26,
} as const;

export const FLOOR = {
  tileSize: 64,
  colorA: '#d9d6cc',
  colorB: '#cfccc1',
  groutColor: 'rgba(90, 85, 75, 0.35)',
  groutWidth: 2,
} as const;

/** Decorative shelves (no collision). The world is split into blocks; each may hold one shelf. */
export const SHELVES = {
  /** Block size in tiles. */
  blockTilesX: 10,
  blockTilesY: 6,
  /** Probability a block has a shelf. */
  density: 0.75,
  minLengthTiles: 3,
  maxLengthTiles: 7,
  depth: 44,
  frameColor: '#5b6470',
  topColor: '#7c8794',
  dividerColor: '#3f4650',
  shadowColor: 'rgba(0, 0, 0, 0.18)',
  productsPerTile: 3,
  productInset: 4,
  productColors: ['#e94f37', '#f6c445', '#3f88c5', '#44bba4', '#f78f3f', '#a05cc8', '#f2f2f2'],
} as const;

export const PLAYER_SPRITE = {
  shadow: 'rgba(0, 0, 0, 0.25)',
  body: '#2f6fbf',
  vest: '#c8f03c',
  skin: '#f1c27d',
  cap: '#d63a3a',
  outline: '#1b1b1b',
} as const;

export const HUD = {
  margin: 16,
  font: '600 14px system-ui, sans-serif',
  smallFont: '12px system-ui, sans-serif',
  hpBarWidth: 220,
  hpBarHeight: 18,
  hpBg: 'rgba(0, 0, 0, 0.55)',
  hpFill: '#e23b3b',
  hpBorder: 'rgba(255, 255, 255, 0.8)',
  textColor: '#ffffff',
  textShadow: 'rgba(0, 0, 0, 0.7)',
} as const;

export const BACKGROUND_COLOR = '#111111';
