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

/** One-shot actions bound to keys (held keys such as movement and Space are handled apart). */
export type KeyAction = 'swap' | 'reload' | 'pause' | 'mute';

const ACTION_KEYS: Readonly<Record<string, KeyAction>> = {
  KeyQ: 'swap',
  KeyR: 'reload',
  Escape: 'pause',
  KeyP: 'pause',
  KeyM: 'mute',
};

export function keyAction(code: string): KeyAction | undefined {
  return ACTION_KEYS[code];
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
 * (aims; fires with the button or Space), else none (Space still fires).
 */
export function readAim(
  aimStick: Readonly<JoystickState>,
  mouse: Readonly<MouseState>,
  fireKey: boolean,
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
  out.trigger = fireKey || (mouse.seen && mouse.down);
  return out;
}

export interface Input {
  readonly keys: KeyState;
  readonly joystick: Readonly<JoystickState>;
  readonly aimStick: Readonly<JoystickState>;
  readonly mouse: Readonly<MouseState>;
  readonly joystickConfig: JoystickConfig;
  getMoveAxis(out: Vec2): Vec2;
  /** Aim and trigger for a player drawn at (playerScreenX, playerScreenY) in CSS px. */
  getAim(playerScreenX: number, playerScreenY: number, out: AimResult): AimResult;
  /** The last pointer used was a finger (touch hints and buttons). */
  readonly touchMode: boolean;
  /** One-shot presses since the last call (Q / wheel / touch button, R, Esc / P, M). */
  consumeSwap(): boolean;
  consumeReload(): boolean;
  consumePause(): boolean;
  consumeMute(): boolean;
  /** Drops pending gameplay presses (swap, reload) e.g. while a menu is open. */
  clearEdges(): void;
  requestSwap(): void;
  requestReload(): void;
  dispose(): void;
}

const newStick = (): JoystickState => ({
  active: false,
  pointerId: -1,
  originX: 0,
  originY: 0,
  knobX: 0,
  knobY: 0,
});

/** Minimum time between two wheel-triggered swaps (trackpads fire many events), ms. */
const WHEEL_SWAP_COOLDOWN_MS = 200;

export function createInput(target: HTMLElement, joystickConfig: JoystickConfig): Input {
  const keys: KeyState = { up: false, down: false, left: false, right: false };
  const joystick = newStick();
  const aimStick = newStick();
  const mouse: MouseState = { seen: false, x: 0, y: 0, down: false };
  let fireKey = false;
  let swapPressed = false;
  let reloadPressed = false;
  let pausePressed = false;
  let mutePressed = false;
  // Until the first pointer arrives, guess from the device (phones and tablets report "coarse").
  let touchMode = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  let lastWheelSwap = 0;

  const onKeyDown = (e: KeyboardEvent): void => {
    const dir = KEY_MAP[e.code];
    if (dir) {
      keys[dir] = true;
      e.preventDefault();
      return;
    }
    if (e.code === 'Space') {
      fireKey = true;
      e.preventDefault();
      return;
    }
    if (e.repeat) return;
    switch (keyAction(e.code)) {
      case 'swap':
        swapPressed = true;
        break;
      case 'reload':
        reloadPressed = true;
        break;
      case 'pause':
        pausePressed = true;
        break;
      case 'mute':
        mutePressed = true;
        break;
      case undefined:
        break;
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const dir = KEY_MAP[e.code];
    if (dir) keys[dir] = false;
    else if (e.code === 'Space') fireKey = false;
  };

  const releaseStick = (stick: JoystickState): void => {
    stick.active = false;
    stick.pointerId = -1;
  };

  const releaseAll = (): void => {
    keys.up = keys.down = keys.left = keys.right = false;
    fireKey = false;
    mouse.down = false;
    releaseStick(joystick);
    releaseStick(aimStick);
  };

  const localX = (e: PointerEvent): number => e.clientX - target.getBoundingClientRect().left;
  const localY = (e: PointerEvent): number => e.clientY - target.getBoundingClientRect().top;

  const stickOf = (pointerId: number): JoystickState | undefined =>
    joystick.pointerId === pointerId
      ? joystick
      : aimStick.pointerId === pointerId
        ? aimStick
        : undefined;

  // Listens on the window so taps on DOM buttons also switch the mode.
  const onAnyPointerDown = (e: PointerEvent): void => {
    touchMode = e.pointerType === 'touch';
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') {
      mouse.seen = true;
      mouse.x = localX(e);
      mouse.y = localY(e);
      if (e.button === 0) mouse.down = true;
      e.preventDefault();
      return;
    }
    const x = localX(e);
    const stick = touchRole(x, target.clientWidth) === 'move' ? joystick : aimStick;
    if (stick.active) return;
    stick.active = true;
    stick.pointerId = e.pointerId;
    stick.originX = stick.knobX = x;
    stick.originY = stick.knobY = localY(e);
    target.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') {
      mouse.seen = true;
      mouse.x = localX(e);
      mouse.y = localY(e);
      return;
    }
    const stick = stickOf(e.pointerId);
    if (!stick?.active) return;
    let dx = localX(e) - stick.originX;
    let dy = localY(e) - stick.originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > joystickConfig.radius) {
      dx = (dx / dist) * joystickConfig.radius;
      dy = (dy / dist) * joystickConfig.radius;
    }
    stick.knobX = stick.originX + dx;
    stick.knobY = stick.originY + dy;
    e.preventDefault();
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') {
      if (e.button === 0) mouse.down = false;
      return;
    }
    const stick = stickOf(e.pointerId);
    if (stick) releaseStick(stick);
  };

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const now = performance.now();
    if (e.deltaY === 0 || now - lastWheelSwap < WHEEL_SWAP_COOLDOWN_MS) return;
    lastWheelSwap = now;
    swapPressed = true;
  };

  const preventDefault = (e: Event): void => e.preventDefault();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointerdown', onAnyPointerDown, true);
  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointermove', onPointerMove);
  target.addEventListener('pointercancel', onPointerUp);
  target.addEventListener('wheel', onWheel, { passive: false });
  target.addEventListener('contextmenu', preventDefault);

  return {
    keys,
    joystick,
    aimStick,
    mouse,
    joystickConfig,
    getMoveAxis: (out) => combineAxis(keys, joystick, joystickConfig, out),
    getAim: (px, py, out) => readAim(aimStick, mouse, fireKey, px, py, joystickConfig, out),
    get touchMode() {
      return touchMode;
    },
    consumePause() {
      const v = pausePressed;
      pausePressed = false;
      return v;
    },
    consumeMute() {
      const v = mutePressed;
      mutePressed = false;
      return v;
    },
    consumeSwap() {
      const v = swapPressed;
      swapPressed = false;
      return v;
    },
    consumeReload() {
      const v = reloadPressed;
      reloadPressed = false;
      return v;
    },
    clearEdges() {
      swapPressed = false;
      reloadPressed = false;
    },
    requestSwap() {
      swapPressed = true;
    },
    requestReload() {
      reloadPressed = true;
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseAll);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointerdown', onAnyPointerDown, true);
      target.removeEventListener('pointerdown', onPointerDown);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointercancel', onPointerUp);
      target.removeEventListener('wheel', onWheel);
      target.removeEventListener('contextmenu', preventDefault);
    },
  };
}
