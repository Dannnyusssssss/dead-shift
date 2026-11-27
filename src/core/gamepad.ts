import { normalizeInPlace, setVec, type Vec2 } from './math';
import {
  PAD_AXES,
  PAD_BUTTON,
  PAD_NAV,
  PAD_TRIGGER_THRESHOLD,
  type StickConfig,
} from '../data/controls';

/** The part of a browser `Gamepad` the game reads (tests pass plain objects). */
export interface PadSnapshot {
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
}

/** Buttons read every poll: the 16 of the standard mapping (the system button is left alone). */
export const PAD_BUTTON_COUNT = 16;

/** A button is down when the pad says so or an analog trigger passes the threshold. */
export function buttonDown(pad: Readonly<PadSnapshot>, index: number): boolean {
  const b = pad.buttons[index];
  if (!b) return false;
  return b.pressed === true || (Number.isFinite(b.value) && b.value >= PAD_TRIGGER_THRESHOLD);
}

/** An axis value, with anything that is not a finite number read as centered. */
export function axis(pad: Readonly<PadSnapshot>, index: number): number {
  const v = pad.axes[index];
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
}

/**
 * Stick direction with magnitude in [0, 1]: a radial dead zone (worn sticks drift), the rest
 * rescaled to the full range and shaped by the response curve.
 */
export function stickToAxis(x: number, y: number, cfg: Readonly<StickConfig>, out: Vec2): Vec2 {
  setVec(out, x, y);
  const mag = Math.min(normalizeInPlace(out), 1);
  if (mag <= cfg.deadZone) return setVec(out, 0, 0);
  const m = ((mag - cfg.deadZone) / (1 - cfg.deadZone)) ** cfg.curve;
  out.x *= m;
  out.y *= m;
  return out;
}

/** Left stick, or the d-pad when the stick rests (the d-pad gives full-speed, 8-way moves). */
export function padMoveAxis(
  pad: Readonly<PadSnapshot>,
  cfg: Readonly<StickConfig>,
  out: Vec2,
): Vec2 {
  stickToAxis(axis(pad, PAD_AXES.moveX), axis(pad, PAD_AXES.moveY), cfg, out);
  if (out.x !== 0 || out.y !== 0) return out;
  const dx =
    (buttonDown(pad, PAD_BUTTON.dpadRight) ? 1 : 0) -
    (buttonDown(pad, PAD_BUTTON.dpadLeft) ? 1 : 0);
  const dy =
    (buttonDown(pad, PAD_BUTTON.dpadDown) ? 1 : 0) - (buttonDown(pad, PAD_BUTTON.dpadUp) ? 1 : 0);
  setVec(out, dx, dy);
  normalizeInPlace(out);
  return out;
}

export function padAimAxis(
  pad: Readonly<PadSnapshot>,
  cfg: Readonly<StickConfig>,
  out: Vec2,
): Vec2 {
  return stickToAxis(axis(pad, PAD_AXES.aimX), axis(pad, PAD_AXES.aimY), cfg, out);
}

/**
 * Menu direction from the d-pad or the left stick: -1 = previous (up / left), +1 = next
 * (down / right), 0 = none. Vertical wins when both are pushed.
 */
export function padNavDirection(pad: Readonly<PadSnapshot>): -1 | 0 | 1 {
  const y = axis(pad, PAD_AXES.moveY);
  if (buttonDown(pad, PAD_BUTTON.dpadUp) || y <= -PAD_NAV.threshold) return -1;
  if (buttonDown(pad, PAD_BUTTON.dpadDown) || y >= PAD_NAV.threshold) return 1;
  const x = axis(pad, PAD_AXES.moveX);
  if (buttonDown(pad, PAD_BUTTON.dpadLeft) || x <= -PAD_NAV.threshold) return -1;
  if (buttonDown(pad, PAD_BUTTON.dpadRight) || x >= PAD_NAV.threshold) return 1;
  return 0;
}

export interface NavRepeat {
  dir: -1 | 0 | 1;
  /** When the current direction started, ms. */
  since: number;
  /** When it last produced a step, ms. */
  last: number;
}

export const newNavRepeat = (): NavRepeat => ({ dir: 0, since: 0, last: 0 });

/** One step when a direction is first pushed, then repeats while it is held (like a key). */
export function navStep(state: NavRepeat, dir: -1 | 0 | 1, now: number): -1 | 0 | 1 {
  if (dir === 0) {
    state.dir = 0;
    return 0;
  }
  if (dir !== state.dir) {
    state.dir = dir;
    state.since = state.last = now;
    return dir;
  }
  if (now - state.since >= PAD_NAV.repeatDelay && now - state.last >= PAD_NAV.repeatEvery) {
    state.last = now;
    return dir;
  }
  return 0;
}

/** Edge detection and stick reading for one gamepad, independent of the browser API. */
export interface PadReader {
  readonly connected: boolean;
  /** Movement and aim of the last poll, magnitude in [0, 1]. */
  readonly move: Readonly<Vec2>;
  readonly aim: Readonly<Vec2>;
  /** The button was down on the last poll. */
  held(button: number): boolean;
  /**
   * Reads one frame of `pad` (null = no pad): calls `onPress` for each newly pressed button and
   * returns the menu navigation step. A pad that arrives with buttons held does not press them.
   */
  poll(
    pad: Readonly<PadSnapshot> | null,
    cfg: Readonly<StickConfig>,
    now: number,
    onPress: (button: number) => void,
  ): -1 | 0 | 1;
}

export function createPadReader(): PadReader {
  let connected = false;
  const move: Vec2 = { x: 0, y: 0 };
  const aim: Vec2 = { x: 0, y: 0 };
  const prev = new Uint8Array(PAD_BUTTON_COUNT);
  const nav = newNavRepeat();

  return {
    get connected() {
      return connected;
    },
    move,
    aim,
    held: (button) => connected && prev[button] === 1,
    poll(pad, cfg, now, onPress) {
      if (!pad) {
        connected = false;
        setVec(move, 0, 0);
        setVec(aim, 0, 0);
        prev.fill(0);
        nav.dir = 0;
        return 0;
      }
      if (!connected) {
        for (let i = 0; i < PAD_BUTTON_COUNT; i++) prev[i] = buttonDown(pad, i) ? 1 : 0;
        connected = true;
      }
      for (let i = 0; i < PAD_BUTTON_COUNT; i++) {
        const down = buttonDown(pad, i);
        if (down && prev[i] === 0) onPress(i);
        prev[i] = down ? 1 : 0;
      }
      padMoveAxis(pad, cfg, move);
      padAimAxis(pad, cfg, aim);
      return navStep(nav, padNavDirection(pad), now);
    },
  };
}
