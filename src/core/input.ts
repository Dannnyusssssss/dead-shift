import { createPadReader, type PadSnapshot } from './gamepad';
import {
  digitKey,
  joystickToAxis,
  keyAction,
  keysToAxis,
  moveKey,
  readAim,
  toggleLatch,
  touchRole,
  type AimResult,
  type JoystickConfig,
  type JoystickState,
  type KeyState,
  type MouseState,
} from './input-logic';
import { keyLookup } from './bindings';
import { normalizeInPlace, setVec, type Vec2 } from './math';
import {
  DEFAULT_FIRE_MODE,
  DEFAULT_KEY_BINDINGS,
  DEFAULT_PAD_BINDINGS,
  DEFAULT_SENSITIVITY,
  PAD_ACTIONS,
  PAD_BUTTON,
  PAD_SENSITIVITY,
  type FireMode,
  type KeyBindings,
  type PadBindings,
  type StickConfig,
} from '../data/controls';

export * from './input-logic';

export interface Input {
  readonly keys: KeyState;
  readonly joystick: Readonly<JoystickState>;
  readonly aimStick: Readonly<JoystickState>;
  readonly mouse: Readonly<MouseState>;
  /** Touch joysticks (changes with «Sensibilidad táctil»). */
  readonly joystickConfig: Readonly<JoystickConfig>;
  getMoveAxis(out: Vec2): Vec2;
  /** Aim and trigger for a player drawn at (playerScreenX, playerScreenY) in CSS px. */
  getAim(playerScreenX: number, playerScreenY: number, out: AimResult): AimResult;
  /** The last pointer used was a finger (touch hints and buttons). */
  readonly touchMode: boolean;
  /** A gamepad is connected (read on the last poll). */
  readonly padConnected: boolean;
  /** The gamepad's right stick is pushed past its dead zone (it steers the aim). */
  readonly padAiming: boolean;
  /** Reads the gamepad; call once per frame before consuming presses. */
  poll(now: number): void;
  /** One-shot presses since the last call (keys, wheel, touch buttons or gamepad). */
  consumeSwap(): boolean;
  consumeReload(): boolean;
  consumePause(): boolean;
  consumeMute(): boolean;
  /** F3: show / hide the performance overlay. */
  consumeDebug(): boolean;
  /** Number key pressed since the last call (1-9, from the top row or the numpad), 0 = none. */
  consumeSelect(): number;
  /** Gamepad menu navigation since the last call: -1 previous, +1 next, 0 none. */
  consumeNavStep(): -1 | 0 | 1;
  /** Gamepad bottom button (confirm) / right button (back) pressed since the last call. */
  consumeNavConfirm(): boolean;
  consumeNavBack(): boolean;
  /** First gamepad button (0-15) pressed since the last call, or -1 (controls menu capture). */
  consumePadButton(): number;
  /** Drops pending gameplay presses (swap, reload, number keys, toggled fire) e.g. in a menu. */
  clearEdges(): void;
  /** Drops every pending press, global ones included (while capturing a gamepad button). */
  clearAll(): void;
  requestSwap(): void;
  requestReload(): void;
  setKeyBindings(bindings: Readonly<KeyBindings>): void;
  setPadBindings(bindings: Readonly<PadBindings>): void;
  setJoystickConfig(cfg: Readonly<JoystickConfig>): void;
  setStickConfig(cfg: Readonly<StickConfig>): void;
  setFireMode(mode: FireMode): void;
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

/** The first connected pad, or null (the browser may lack the API or block it in an iframe). */
function firstPad(): PadSnapshot | null {
  try {
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) if (pad?.connected) return pad;
  } catch {
    // Blocked by a permissions policy: play on without a pad.
  }
  return null;
}

export function createInput(target: HTMLElement, initialJoystick: JoystickConfig): Input {
  const keys: KeyState = { up: false, down: false, left: false, right: false };
  const joystick = newStick();
  const aimStick = newStick();
  const mouse: MouseState = { seen: false, x: 0, y: 0, down: false };
  let joystickConfig: Readonly<JoystickConfig> = initialJoystick;
  let stickConfig: Readonly<StickConfig> = PAD_SENSITIVITY[DEFAULT_SENSITIVITY];
  let lookup = keyLookup(DEFAULT_KEY_BINDINGS);
  let padBindings: Readonly<PadBindings> = DEFAULT_PAD_BINDINGS;
  let fireMode: FireMode = DEFAULT_FIRE_MODE;
  let fireKey = false;
  /** «Alternar»: firing until the next press. */
  let fireLatched = false;
  let swapPressed = false;
  let reloadPressed = false;
  let pausePressed = false;
  let mutePressed = false;
  let debugPressed = false;
  let selectPressed = 0;
  // Until the first pointer arrives, guess from the device (phones and tablets report "coarse").
  let touchMode = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  let lastWheelSwap = 0;

  // Gamepad state, refreshed by `poll` (no objects created per frame).
  const pad = createPadReader();
  const padMove = pad.move;
  const padAim = pad.aim;
  let navStepPending: -1 | 0 | 1 = 0;
  let navConfirm = false;
  let navBack = false;
  let padButtonPressed = -1;

  const pressFire = (): void => {
    fireLatched = toggleLatch(fireLatched, true);
  };

  /**
   * Game keys skip the browser default (page scroll, Alt menu) except on a focused button or
   * field, where Space and Enter must still press it.
   */
  const claim = (e: KeyboardEvent): void => {
    const onControl = e.target instanceof Element && e.target.closest('button, input, a') !== null;
    if (!onControl) e.preventDefault();
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    const dir = moveKey(e.code, lookup);
    if (dir) {
      keys[dir] = true;
      claim(e);
      return;
    }
    if (lookup.get(e.code) === 'fire') {
      fireKey = true;
      if (!e.repeat) pressFire();
      claim(e);
      return;
    }
    const digit = digitKey(e.code);
    if (digit > 0) {
      if (!e.repeat) selectPressed = digit;
      return;
    }
    const action = keyAction(e.code, lookup);
    // F3 is "find next" in most browsers, even while held. Esc keeps its browser meaning.
    if (action === 'debug') e.preventDefault();
    else if (action && e.code !== 'Escape') claim(e);
    if (e.repeat) return;
    switch (action) {
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
      case 'debug':
        debugPressed = true;
        break;
      case undefined:
        break;
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const dir = moveKey(e.code, lookup);
    if (dir) keys[dir] = false;
    else if (lookup.get(e.code) === 'fire') fireKey = false;
  };

  const releaseStick = (stick: JoystickState): void => {
    stick.active = false;
    stick.pointerId = -1;
  };

  const releaseAll = (): void => {
    keys.up = keys.down = keys.left = keys.right = false;
    fireKey = false;
    fireLatched = false;
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
      if (e.button === 0) {
        mouse.down = true;
        pressFire();
      }
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

  /** A new gamepad press: menu confirm / back, the capture in «Controles» and assigned actions. */
  const padPress = (button: number): void => {
    if (padButtonPressed < 0) padButtonPressed = button;
    if (button === PAD_BUTTON.bottom) navConfirm = true;
    if (button === PAD_BUTTON.right) navBack = true;
    for (const action of PAD_ACTIONS) {
      if (padBindings[action] !== button) continue;
      switch (action) {
        case 'fire':
          pressFire();
          break;
        case 'reload':
          reloadPressed = true;
          break;
        case 'swap':
          swapPressed = true;
          break;
        case 'pause':
          pausePressed = true;
          break;
        case 'mute':
          mutePressed = true;
          break;
      }
    }
  };

  const poll = (now: number): void => {
    const step = pad.poll(firstPad(), stickConfig, now, padPress);
    if (step !== 0) navStepPending = step;
    // The right stick takes over the aim: the mouse crosshair hides until the mouse moves again.
    if (padAim.x !== 0 || padAim.y !== 0) mouse.seen = false;
  };

  /** The fire button after the fire mode: held, or toggled on. */
  const fireHeld = (): boolean =>
    fireMode === 'toggle'
      ? fireLatched
      : fireKey || (mouse.seen && mouse.down) || pad.held(padBindings.fire);

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
    get joystickConfig() {
      return joystickConfig;
    },
    getMoveAxis(out) {
      // Touch joystick, then the gamepad, then the keyboard.
      joystickToAxis(joystick, joystickConfig, out);
      if (out.x !== 0 || out.y !== 0) return out;
      if (padMove.x !== 0 || padMove.y !== 0) return setVec(out, padMove.x, padMove.y);
      return keysToAxis(keys, out);
    },
    getAim(px, py, out) {
      if (!aimStick.active && (padAim.x !== 0 || padAim.y !== 0)) {
        setVec(out.dir, padAim.x, padAim.y);
        normalizeInPlace(out.dir);
        out.active = true;
        out.trigger = fireHeld();
        return out;
      }
      return readAim(aimStick, mouse, fireHeld(), px, py, joystickConfig, out);
    },
    get touchMode() {
      return touchMode;
    },
    get padConnected() {
      return pad.connected;
    },
    get padAiming() {
      return padAim.x !== 0 || padAim.y !== 0;
    },
    poll,
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
    consumeSelect() {
      const v = selectPressed;
      selectPressed = 0;
      return v;
    },
    consumeDebug() {
      const v = debugPressed;
      debugPressed = false;
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
    consumeNavStep() {
      const v = navStepPending;
      navStepPending = 0;
      return v;
    },
    consumeNavConfirm() {
      const v = navConfirm;
      navConfirm = false;
      return v;
    },
    consumeNavBack() {
      const v = navBack;
      navBack = false;
      return v;
    },
    consumePadButton() {
      const v = padButtonPressed;
      padButtonPressed = -1;
      return v;
    },
    clearEdges() {
      swapPressed = false;
      reloadPressed = false;
      selectPressed = 0;
      fireLatched = false;
    },
    clearAll() {
      swapPressed = reloadPressed = pausePressed = mutePressed = debugPressed = false;
      selectPressed = 0;
      fireLatched = false;
      navStepPending = 0;
      navConfirm = navBack = false;
      padButtonPressed = -1;
    },
    requestSwap() {
      swapPressed = true;
    },
    requestReload() {
      reloadPressed = true;
    },
    setKeyBindings(bindings) {
      lookup = keyLookup(bindings);
      // A key held under its old meaning would otherwise never be released.
      releaseAll();
    },
    setPadBindings(bindings) {
      padBindings = { ...bindings };
    },
    setJoystickConfig(cfg) {
      joystickConfig = cfg;
    },
    setStickConfig(cfg) {
      stickConfig = cfg;
    },
    setFireMode(mode) {
      fireMode = mode;
      fireLatched = false;
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
