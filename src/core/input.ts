import { normalizeInPlace, setVec, type Vec2 } from './math';

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

const KEY_MAP: Readonly<Record<string, keyof KeyState>> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

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

export interface Input {
  readonly keys: KeyState;
  readonly joystick: Readonly<JoystickState>;
  readonly joystickConfig: JoystickConfig;
  getMoveAxis(out: Vec2): Vec2;
  dispose(): void;
}

export function createInput(target: HTMLElement, joystickConfig: JoystickConfig): Input {
  const keys: KeyState = { up: false, down: false, left: false, right: false };
  const joystick: JoystickState = {
    active: false,
    pointerId: -1,
    originX: 0,
    originY: 0,
    knobX: 0,
    knobY: 0,
  };

  const setKey = (e: KeyboardEvent, pressed: boolean): void => {
    const dir = KEY_MAP[e.code];
    if (!dir) return;
    keys[dir] = pressed;
    e.preventDefault();
  };
  const onKeyDown = (e: KeyboardEvent): void => setKey(e, true);
  const onKeyUp = (e: KeyboardEvent): void => setKey(e, false);

  const releaseAll = (): void => {
    keys.up = keys.down = keys.left = keys.right = false;
    joystick.active = false;
    joystick.pointerId = -1;
  };

  const localX = (e: PointerEvent): number => e.clientX - target.getBoundingClientRect().left;
  const localY = (e: PointerEvent): number => e.clientY - target.getBoundingClientRect().top;

  const onPointerDown = (e: PointerEvent): void => {
    if (joystick.active) return;
    joystick.active = true;
    joystick.pointerId = e.pointerId;
    joystick.originX = joystick.knobX = localX(e);
    joystick.originY = joystick.knobY = localY(e);
    target.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!joystick.active || e.pointerId !== joystick.pointerId) return;
    let dx = localX(e) - joystick.originX;
    let dy = localY(e) - joystick.originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > joystickConfig.radius) {
      dx = (dx / dist) * joystickConfig.radius;
      dy = (dy / dist) * joystickConfig.radius;
    }
    joystick.knobX = joystick.originX + dx;
    joystick.knobY = joystick.originY + dy;
    e.preventDefault();
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== joystick.pointerId) return;
    joystick.active = false;
    joystick.pointerId = -1;
  };

  const preventDefault = (e: Event): void => e.preventDefault();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointermove', onPointerMove);
  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerUp);
  target.addEventListener('contextmenu', preventDefault);

  return {
    keys,
    joystick,
    joystickConfig,
    getMoveAxis: (out) => combineAxis(keys, joystick, joystickConfig, out),
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseAll);
      target.removeEventListener('pointerdown', onPointerDown);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', onPointerUp);
      target.removeEventListener('pointercancel', onPointerUp);
      target.removeEventListener('contextmenu', preventDefault);
    },
  };
}
