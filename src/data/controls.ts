import type { JoystickConfig } from '../core/input';

/** Keyboard actions the player can move to another key (`KeyboardEvent.code` values). */
export const KEY_ACTIONS = [
  'up',
  'down',
  'left',
  'right',
  'fire',
  'reload',
  'swap',
  'pause',
  'mute',
] as const;
export type KeyActionId = (typeof KEY_ACTIONS)[number];
export type KeyBindings = Record<KeyActionId, string>;

/** The keys of every release before the controls menu. */
export const DEFAULT_KEY_BINDINGS: Readonly<KeyBindings> = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  fire: 'Space',
  reload: 'KeyR',
  swap: 'KeyQ',
  pause: 'KeyP',
  mute: 'KeyM',
};

/**
 * Keys that always keep their meaning and cannot be assigned: arrows (move), Esc (pause, close,
 * cancel), Tab (focus), 1-9 (weapon / card choice) and F3 (metrics). Keeping Esc and Tab out
 * means the keyboard can never get stuck in a menu.
 */
export const FIXED_MOVE_KEYS: Readonly<Record<string, 'up' | 'down' | 'left' | 'right'>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/** Keys outside the letters that may be assigned (F5, F11 and F12 belong to the browser). */
export const EXTRA_ASSIGNABLE_KEYS: readonly string[] = [
  'Space',
  'Enter',
  'Backspace',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'Digit0',
  'Minus',
  'Equal',
  'BracketLeft',
  'BracketRight',
  'Backslash',
  'Semicolon',
  'Quote',
  'Backquote',
  'Comma',
  'Period',
  'Slash',
  'IntlBackslash',
  'Numpad0',
  'NumpadDecimal',
  'NumpadEnter',
  'NumpadAdd',
  'NumpadSubtract',
  'NumpadMultiply',
  'NumpadDivide',
  'F1',
  'F2',
  'F4',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
];

/** Gamepad actions the player can move to another button (standard mapping indexes). */
export const PAD_ACTIONS = ['fire', 'reload', 'swap', 'pause', 'mute'] as const;
export type PadActionId = (typeof PAD_ACTIONS)[number];
export type PadBindings = Record<PadActionId, number>;

/** Standard gamepad mapping (W3C): positions, so Xbox and PlayStation pads read the same. */
export const PAD_BUTTON = {
  bottom: 0,
  right: 1,
  left: 2,
  top: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  back: 8,
  start: 9,
  leftStick: 10,
  rightStick: 11,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
} as const;

export const DEFAULT_PAD_BINDINGS: Readonly<PadBindings> = {
  fire: PAD_BUTTON.rt,
  reload: PAD_BUTTON.left,
  swap: PAD_BUTTON.rb,
  pause: PAD_BUTTON.start,
  mute: PAD_BUTTON.back,
};

/** Buttons 0-11 can be assigned; the d-pad (12-15) moves and navigates menus, 16+ is the system's. */
export const PAD_ASSIGNABLE_MAX = 11;

/** Standard axes: left stick moves, right stick aims. */
export const PAD_AXES = { moveX: 0, moveY: 1, aimX: 2, aimY: 3 } as const;

/** Analog triggers report a value; past this it counts as pressed. */
export const PAD_TRIGGER_THRESHOLD = 0.5;

/** Menu navigation with the d-pad or left stick. */
export const PAD_NAV = {
  /** Stick deflection that counts as a direction. */
  threshold: 0.6,
  /** Holding a direction repeats it after this delay, then every `repeatEvery`, ms. */
  repeatDelay: 400,
  repeatEvery: 150,
} as const;

/**
 * «Campo de visión»: how much of the store fits on screen, relative to 1 CSS px per world px.
 * 100 is the game before this setting; the widest level is capped for performance.
 */
export const VIEW_SCALES = [80, 90, 100, 115, 130] as const;
export type ViewScale = (typeof VIEW_SCALES)[number];
export const DEFAULT_VIEW_SCALE: ViewScale = 100;

/** Sensitivity levels, 1 (least) to 5 (most); 3 is the game before this setting. */
export const SENSITIVITY_LEVELS = [1, 2, 3, 4, 5] as const;
export type SensitivityLevel = (typeof SENSITIVITY_LEVELS)[number];
export const DEFAULT_SENSITIVITY: SensitivityLevel = 3;

/** Touch joysticks: a smaller radius and dead zone answer to shorter drags. */
export const TOUCH_SENSITIVITY: Readonly<Record<SensitivityLevel, Readonly<JoystickConfig>>> = {
  1: { radius: 80, deadZone: 0.2 },
  2: { radius: 70, deadZone: 0.18 },
  3: { radius: 60, deadZone: 0.15 },
  4: { radius: 50, deadZone: 0.12 },
  5: { radius: 42, deadZone: 0.1 },
};

export interface StickConfig {
  /** Fraction of the stick travel ignored (drift of worn sticks). */
  deadZone: number;
  /** Response curve exponent: >1 is finer near the center, 1 is linear. */
  curve: number;
}

/** Gamepad sticks: less dead zone and a flatter curve react sooner. */
export const PAD_SENSITIVITY: Readonly<Record<SensitivityLevel, Readonly<StickConfig>>> = {
  1: { deadZone: 0.25, curve: 2 },
  2: { deadZone: 0.2, curve: 1.6 },
  3: { deadZone: 0.15, curve: 1.3 },
  4: { deadZone: 0.12, curve: 1.1 },
  5: { deadZone: 0.08, curve: 1 },
};

export const FIRE_MODES = ['hold', 'toggle'] as const;
/** `hold`: fires while the button is held. `toggle`: one press starts firing, another stops. */
export type FireMode = (typeof FIRE_MODES)[number];
export const DEFAULT_FIRE_MODE: FireMode = 'hold';

/** «Apuntado asistido»: the Pistol and Shotgun aim at the nearest zombie in reach. */
export const AIM_ASSIST = {
  /** Upper bound of the search, px (a gun's reach is speed × lifetime, usually below this). */
  maxRange: 600,
} as const;
