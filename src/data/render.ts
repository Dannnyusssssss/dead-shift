import type { JoystickConfig } from '../core/input';
import { TILE_SIZE } from './map';

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
  tileSize: TILE_SIZE,
  colorA: '#d9d6cc',
  colorB: '#cfccc1',
  groutColor: 'rgba(90, 85, 75, 0.35)',
  groutWidth: 2,
} as const;

/** Look of the solid shelves; their layout lives in `data/map.ts` (SHELF_LAYOUT). */
export const SHELVES = {
  frameColor: '#5b6470',
  topColor: '#7c8794',
  dividerColor: '#3f4650',
  shadowColor: 'rgba(0, 0, 0, 0.3)',
  /** Shadow offset to the lower right, px. */
  shadowOffsetX: 6,
  shadowOffsetY: 10,
  /** Dark front face along the bottom of the footprint that reads as height, px. */
  frontHeight: 10,
  frontColor: '#2f353d',
  /** Light edge along the top of the shelf. */
  rimColor: 'rgba(255, 255, 255, 0.35)',
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

export const ENEMY_SPRITE = {
  shadow: 'rgba(0, 0, 0, 0.22)',
  outline: '#1b1b1b',
  eyes: '#e8f0a0',
  flash: '#ffffff',
} as const;

/** Player blinks at this rate (Hz) while invulnerable. */
export const PLAYER_BLINK_RATE = 12;

export const SWEEP = {
  /** How long the broom swing stays visible, s. */
  fadeTime: 0.18,
  color: 'rgba(255, 255, 255, 0.55)',
  edgeColor: 'rgba(255, 240, 200, 0.9)',
} as const;

export const STATUS_TINT = {
  slow: 'rgba(120, 200, 255, 0.55)',
  poison: 'rgba(120, 230, 60, 0.5)',
} as const;

/** Coupon colors by value tier (first tier whose `min` the value reaches, from the top). */
export const COUPON_STYLE = {
  tiers: [
    { min: 20, fill: '#e94f37', stroke: '#8a1f12' },
    { min: 5, fill: '#3f88c5', stroke: '#173d5c' },
    { min: 0, fill: '#f6c445', stroke: '#8a6a10' },
  ],
  width: 14,
  height: 9,
  /** Bob amplitude (px) and speed (rad/s) so coupons catch the eye. */
  bob: 1.5,
  bobSpeed: 5,
} as const;

export const PROJECTILE_STYLE = {
  canBody: '#b9c0c8',
  canBand: '#d63a3a',
  canOutline: '#4a4f55',
  /** Spin of thrown cans, rad/s. */
  canSpin: 12,
  labelFill: '#fff3a8',
  labelStroke: '#c9a227',
  labelLength: 9,
  labelWidth: 5,
  pelletFill: '#ffd27a',
  pelletStroke: '#7a4a12',
} as const;

export const ICE_STYLE = {
  fill: '#d8f1ff',
  stroke: '#5aa6d6',
  shine: 'rgba(255, 255, 255, 0.9)',
} as const;

export const CLOUD_STYLE = {
  color: 'rgba(150, 220, 90, 0.22)',
  edge: 'rgba(170, 240, 110, 0.35)',
  /** Puffs drawn along the cone. */
  puffs: 7,
} as const;

export const MICROWAVE_STYLE = {
  body: '#e8e8e8',
  outline: '#555b62',
  window: '#2a2f36',
  glow: '#ffcf4a',
  width: 30,
  height: 22,
  beam: 'rgba(255, 230, 120, 0.95)',
  beamGlow: 'rgba(255, 200, 60, 0.35)',
  /** How long a zap stays visible, s. */
  beamTime: 0.12,
  /** Starts blinking when this many seconds of life are left. */
  blinkWhenLeft: 1.5,
} as const;

export const ACCESSORY_STYLE = {
  cap: '#d9531e',
  frost: 'rgba(240, 252, 255, 0.9)',
  cartFrame: '#9aa3ad',
  cartBasket: 'rgba(154, 163, 173, 0.35)',
  apron: '#f2f2f2',
  visor: '#1f6f45',
  tie: '#d63a3a',
  badge: '#f6c445',
} as const;

/** Dawn "fainting": enemies tip over, squash and fade. */
export const FAINT = {
  duration: 1.5,
  /** Final rotation, rad. */
  tilt: 1.4,
  minAlpha: 0.35,
} as const;

/** Seconds after dawn before the victory screen appears. */
export const VICTORY_SCREEN_DELAY = 1.8;

export const LIGHTING = {
  /** Darkness at 10 PM (0..1). */
  maxDarkness: 0.82,
  /** Shift progress at which the darkness starts to lift (0 = 10 PM, 1 = 6 AM). */
  liftFrom: 0.45,
  /** Flashlight: fully lit inside `inner`, fading to dark at `outer` (px). */
  inner: 70,
  outer: 250,
  /** The lit area grows toward this outer radius as the night ends. */
  outerAtDawn: 650,
  /** Darkness is quantized to this many steps so the gradient is rebuilt rarely. */
  steps: 64,
  dawnTint: 'rgba(255, 170, 90, 0.10)',
  /** Progress from which the warm dawn tint fades in. */
  dawnTintFrom: 0.85,
} as const;

export const HAZARD_STYLE = {
  puddleFill: 'rgba(150, 215, 245, 0.45)',
  puddleEdge: 'rgba(220, 245, 255, 0.7)',
  receiptFill: '#fafafa',
  receiptLine: '#9a9a9a',
  receiptSpin: 9,
  targetColor: 'rgba(230, 50, 40, 0.75)',
  explosionColor: '#f29d38',
  shockWarn: 'rgba(230, 50, 40, 0.35)',
  shockRing: 'rgba(255, 120, 80, 0.85)',
} as const;

/** Cart wind-up warning line. */
export const TELEGRAPH = {
  color: 'rgba(235, 40, 40, 0.7)',
  width: 4,
} as const;

export const CHEST_STYLE = {
  body: '#8a5a2b',
  lid: '#a86f37',
  trim: '#f6c445',
  glow: 'rgba(246, 196, 69, 0.35)',
  width: 30,
  height: 22,
} as const;

export const CLOCK_HUD = {
  font: '700 22px system-ui, sans-serif',
  y: 26,
  /** On narrow screens the clock goes top-right, below the pause button. */
  narrowY: 78,
} as const;

export const BOSS_BAR = {
  width: 360,
  height: 12,
  y: 48,
  /** On narrow screens the bar sits below the left HUD column. */
  narrowY: 150,
  bg: 'rgba(0, 0, 0, 0.6)',
  fill: '#b23be0',
  border: 'rgba(255, 255, 255, 0.8)',
  font: '700 12px system-ui, sans-serif',
} as const;

export const CROSSHAIR = {
  radius: 10,
  gap: 4,
  color: 'rgba(255, 255, 255, 0.9)',
  shadow: 'rgba(0, 0, 0, 0.6)',
  /** Tint while the trigger is held. */
  firing: 'rgba(255, 210, 90, 0.95)',
} as const;

export const AMMO_BOX_STYLE = {
  body: '#4d7c3a',
  edge: '#24401a',
  bullet: '#f6c445',
  width: 16,
  height: 12,
} as const;

/** Shotgun shell box: red, with two shells. */
export const SHELL_BOX_STYLE = {
  body: '#b8322a',
  edge: '#5a1410',
  shell: '#f2c94c',
  width: 16,
  height: 12,
} as const;

/** Medkit: white box with a red cross. */
export const MEDKIT_STYLE = {
  body: '#f4f1ea',
  edge: '#8c1f1f',
  cross: '#d33a3a',
  size: 16,
  /** Arm thickness of the cross, px. */
  arm: 4,
} as const;

/** Floor magnet: red horseshoe with silver tips and a pulsing halo. */
export const FLOOR_MAGNET_STYLE = {
  body: '#d33a3a',
  tips: '#d9dde3',
  halo: 'rgba(120, 190, 255, 0.35)',
  radius: 8,
  thickness: 4,
} as const;

/** What Mati holds: label gun or broom, drawn in his local frame. */
export const HELD_STYLE = {
  gun: '#2b2f36',
  gunTip: '#f6c445',
  shotgunBarrel: '#3a3f47',
  shotgunStock: '#8a5a2b',
  broomStick: '#8a5a2b',
  broomHead: '#e0b84c',
} as const;

export const AIM_STICK_STYLE = {
  baseColor: 'rgba(255, 200, 90, 0.12)',
  baseStroke: 'rgba(255, 200, 90, 0.45)',
  knobColor: 'rgba(255, 200, 90, 0.5)',
} as const;

export const MANUAL_HUD = {
  width: 236,
  height: 58,
  bg: 'rgba(0, 0, 0, 0.55)',
  border: 'rgba(255, 255, 255, 0.35)',
  nameFont: '700 13px system-ui, sans-serif',
  ammoFont: '700 20px system-ui, sans-serif',
  hintFont: '11px system-ui, sans-serif',
  iconFont: '24px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
  reloadBg: 'rgba(255, 255, 255, 0.15)',
  reloadFill: '#f6c445',
  emptyColor: '#ff6b5a',
  lowAmmoColor: '#ffc46b',
  /** Magazine at or below this fraction shows in the warning color. */
  lowAmmoFraction: 0.25,
  cooldownShade: 'rgba(0, 0, 0, 0.6)',
  /** Row of owned manual weapons above the panel (key, icon, ammo) and the pistol mods. */
  rowHeight: 22,
  rowGap: 4,
  chipPadding: 6,
  chipBg: 'rgba(0, 0, 0, 0.5)',
  chipActiveBg: 'rgba(246, 196, 69, 0.35)',
  chipActiveBorder: '#f6c445',
  chipFont: '600 11px system-ui, sans-serif',
  chipIconFont: '13px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
} as const;

export const XP_BAR = {
  height: 10,
  bg: 'rgba(0, 0, 0, 0.55)',
  fill: '#6fd3ff',
  border: 'rgba(255, 255, 255, 0.7)',
} as const;

export const LOADOUT_HUD = {
  iconSize: 22,
  gap: 6,
  font: '18px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
  levelFont: '700 10px system-ui, sans-serif',
  slotBg: 'rgba(0, 0, 0, 0.45)',
} as const;

export const PARTICLES = {
  capacity: 800,
  drag: 5,
  death: {
    count: 10,
    speedMin: 40,
    speedMax: 170,
    lifeMin: 0.3,
    lifeMax: 0.7,
    sizeMin: 2,
    sizeMax: 5,
  },
  hit: {
    count: 8,
    speedMin: 60,
    speedMax: 180,
    lifeMin: 0.2,
    lifeMax: 0.45,
    sizeMin: 2,
    sizeMax: 4,
  },
  hitColor: '#e23b3b',
  /** A shot stopped by a shelf. */
  shelfHit: {
    count: 4,
    speedMin: 40,
    speedMax: 120,
    lifeMin: 0.1,
    lifeMax: 0.25,
    sizeMin: 1.5,
    sizeMax: 3,
  },
  shelfHitColor: '#ffe9a8',
  explosionColor: '#f29d38',
  explosion: {
    count: 16,
    speedMin: 60,
    speedMax: 220,
    lifeMin: 0.25,
    lifeMax: 0.55,
    sizeMin: 3,
    sizeMax: 6,
  },
} as const;

/** Performance line (F3). */
export const DEBUG_HUD = {
  /** Touch layout: distance between the line and the top of the weapon panel, px. */
  gapAbovePanel: 12,
} as const;

export const HUD = {
  margin: 16,
  /** Below this view width (px) the clock moves to the top-right corner. */
  wideLayoutMinWidth: 640,
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

export const FLOATERS = {
  capacity: 150,
  /** Seconds on screen. */
  life: 0.7,
  /** Fades out during the last this-many seconds. */
  fadeTime: 0.3,
  /** Upward speed, px/s. */
  rise: 48,
  /** Random sideways speed, px/s. */
  drift: 18,
  /** Random horizontal offset at spawn, px. */
  jitter: 6,
  /** Hits of at least this much use the big style. */
  bigThreshold: 20,
  /** Values below this keep their string cached. */
  cachedValues: 1000,
  font: '700 13px system-ui, sans-serif',
  bigFont: '800 17px system-ui, sans-serif',
  color: '#ffffff',
  bigColor: '#ffd84a',
  outline: 'rgba(0, 0, 0, 0.85)',
  outlineWidth: 3,
} as const;

/** Screen shake: trauma added per event (0..1); the view moves with trauma². */
export const SHAKE = {
  maxOffset: 16,
  decay: 1.3,
  frequency: 38,
  playerHit: 0.32,
  /** Explosions shake only this close to the player, px. */
  explosionRange: 260,
  explosion: 0.25,
  bossSpawn: 0.75,
  shockwave: 0.6,
  bossDeath: 0.9,
} as const;

/** Red vignette when the player is hit. */
export const HURT_FLASH = {
  duration: 0.35,
  color: 'rgba(220, 30, 30, 0.55)',
  /** Inner radius of the vignette as a fraction of the view's half diagonal. */
  inner: 0.55,
} as const;

/** Faint line showing where the touch aim stick points. */
export const AIM_LINE = {
  from: 22,
  length: 120,
  width: 2,
  dash: [6, 6],
  color: 'rgba(255, 210, 90, 0.45)',
} as const;
