/** Pure input rules (no DOM): key meanings, joysticks, aim priority. */
import { keyLookup } from './bindings';
import { normalizeInPlace, setVec, type Vec2 } from './math';
import { DEFAULT_KEY_BINDINGS, FIXED_MOVE_KEYS, type KeyActionId } from '../data/controls';

export interface KeyState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/** Floating virtual joystick, in CSS pixels relative to the target element. */
export interface JoystickState {
  active: boolean;
  pointerId: number;
  originX: number;
  originY: number;
  knobX: number;
  knobY: number;
}

export interface JoystickConfig {
  /** Max knob distance from origin (CSS px); full speed at this distance. */
  radius: number;
  /** Fraction of `radius` ignored as noise. */
  deadZone: number;
}

/** One-shot actions bound to keys (held keys such as movement and fire are handled apart). */
export type KeyAction = 'swap' | 'reload' | 'pause' | 'mute' | 'debug';

const DEFAULT_LOOKUP = keyLookup(DEFAULT_KEY_BINDINGS);

/** Movement direction of a key: the arrows always, plus the four assigned keys. */
export function moveKey(
  code: string,
  lookup: ReadonlyMap<string, KeyActionId> = DEFAULT_LOOKUP,
): keyof KeyState | undefined {
  if (Object.prototype.hasOwnProperty.call(FIXED_MOVE_KEYS, code)) return FIXED_MOVE_KEYS[code];
  const a = lookup.get(code);
  return a === 'up' || a === 'down' || a === 'left' || a === 'right' ? a : undefined;
}

/** One-shot action of a key: Esc always pauses and F3 always toggles the metrics. */
export function keyAction(
  code: string,
  lookup: ReadonlyMap<string, KeyActionId> = DEFAULT_LOOKUP,
): KeyAction | undefined {
  if (code === 'Escape') return 'pause';
  if (code === 'F3') return 'debug';
  const a = lookup.get(code);
  return a === 'swap' || a === 'reload' || a === 'pause' || a === 'mute' ? a : undefined;
}

/** Fire in «alternar» mode: each new press flips it on or off. */
export function toggleLatch(latched: boolean, pressed: boolean): boolean {
  return pressed ? !latched : latched;
}

/** 1-9 for the number keys (top row or numpad), 0 for anything else. */
export function digitKey(code: string): number {
  const match = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  return match ? Number(match[1]) : 0;
}

/** Keyboard direction, normalized so diagonals are not faster. */
export function keysToAxis(keys: KeyState, out: Vec2): Vec2 {
  setVec(out, (keys.right ? 1 : 0) - (keys.left ? 1 : 0), (keys.down ? 1 : 0) - (keys.up ? 1 : 0));
  normalizeInPlace(out);
  return out;
}

/** Analog joystick direction with magnitude in [0, 1], remapped past the dead zone. */
export function joystickToAxis(joy: JoystickState, cfg: JoystickConfig, out: Vec2): Vec2 {
  setVec(out, 0, 0);
  if (!joy.active) return out;
  setVec(out, joy.knobX - joy.originX, joy.knobY - joy.originY);
  const dist = normalizeInPlace(out);
  const t = Math.min(dist / cfg.radius, 1);
  const mag = t <= cfg.deadZone ? 0 : (t - cfg.deadZone) / (1 - cfg.deadZone);
  out.x *= mag;
  out.y *= mag;
  return out;
}

/** Joystick wins while it is pushed past the dead zone; otherwise keyboard. */
export function combineAxis(
  keys: KeyState,
  joy: JoystickState,
  cfg: JoystickConfig,
  out: Vec2,
): Vec2 {
  joystickToAxis(joy, cfg, out);
  if (out.x !== 0 || out.y !== 0) return out;
  return keysToAxis(keys, out);
}

/** Touches on the left part of the screen move; the rest aim (and fire). */
export function touchRole(x: number, viewW: number, moveFraction = 0.5): 'move' | 'aim' {
  return x < viewW * moveFraction ? 'move' : 'aim';
}

/** Unit direction from (originX, originY) to (targetX, targetY); false if they coincide. */
export function aimFromScreen(
  targetX: number,
  targetY: number,
  originX: number,
  originY: number,
  out: Vec2,
): boolean {
  setVec(out, targetX - originX, targetY - originY);
  return normalizeInPlace(out) > 1e-6;
}

export interface MouseState {
  /** The mouse has moved over the game at least once (it then drives the aim). */
  seen: boolean;
  x: number;
  y: number;
  down: boolean;
}

export interface AimResult {
  /** Unit aim direction (valid when `active`). */
  dir: Vec2;
  /** A mouse or aim stick is steering the aim. */
  active: boolean;
  trigger: boolean;
}

/**
 * Aim priority: aim stick (pushed past its dead zone: aims and fires), then the mouse
 * (aims), else none. `fire` is the fire button (mouse, key or pad) after the fire mode.
 */
export function readAim(
  aimStick: Readonly<JoystickState>,
  mouse: Readonly<MouseState>,
  fire: boolean,
  playerScreenX: number,
  playerScreenY: number,
  cfg: Readonly<JoystickConfig>,
  out: AimResult,
): AimResult {
  joystickToAxis(aimStick, cfg, out.dir);
  if (out.dir.x !== 0 || out.dir.y !== 0) {
    normalizeInPlace(out.dir);
    out.active = true;
    out.trigger = true;
    return out;
  }
  out.active = mouse.seen && aimFromScreen(mouse.x, mouse.y, playerScreenX, playerScreenY, out.dir);
  out.trigger = fire;
  return out;
}
