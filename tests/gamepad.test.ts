import { describe, expect, it } from 'vitest';
import {
  axis,
  buttonDown,
  navStep,
  newNavRepeat,
  padAimAxis,
  padMoveAxis,
  padNavDirection,
  stickToAxis,
  type PadSnapshot,
} from '../src/core/gamepad';
import { length, vec2 } from '../src/core/math';
import {
  PAD_BUTTON,
  PAD_NAV,
  PAD_SENSITIVITY,
  SENSITIVITY_LEVELS,
  TOUCH_SENSITIVITY,
  DEFAULT_SENSITIVITY,
} from '../src/data/controls';
import { JOYSTICK } from '../src/data/render';

const cfg = { deadZone: 0.15, curve: 1 };

/** A pad at rest, with optional axes and pressed buttons. */
function pad(
  axes: number[] = [0, 0, 0, 0],
  pressed: number[] = [],
  values: Record<number, number> = {},
): PadSnapshot {
  const buttons = Array.from({ length: 17 }, (_, i) => ({
    pressed: pressed.includes(i),
    value: values[i] ?? (pressed.includes(i) ? 1 : 0),
  }));
  return { axes, buttons };
}

describe('buttonDown', () => {
  it('reads pressed buttons and analog triggers past the threshold', () => {
    expect(buttonDown(pad([], [PAD_BUTTON.bottom]), PAD_BUTTON.bottom)).toBe(true);
    expect(buttonDown(pad([], [], { [PAD_BUTTON.rt]: 0.7 }), PAD_BUTTON.rt)).toBe(true);
    expect(buttonDown(pad([], [], { [PAD_BUTTON.rt]: 0.2 }), PAD_BUTTON.rt)).toBe(false);
  });

  it('treats missing buttons and junk values as released', () => {
    expect(buttonDown({ axes: [], buttons: [] }, 3)).toBe(false);
    expect(buttonDown(pad([], [], { 7: NaN }), 7)).toBe(false);
  });
});

describe('axis', () => {
  it('clamps to [-1, 1] and centers junk', () => {
    expect(axis(pad([2, -3]), 0)).toBe(1);
    expect(axis(pad([2, -3]), 1)).toBe(-1);
    expect(axis(pad([NaN, Infinity]), 0)).toBe(0);
    expect(axis(pad([NaN, Infinity]), 1)).toBe(0);
    expect(axis(pad([]), 5)).toBe(0);
  });
});

describe('stickToAxis', () => {
  it('ignores drift inside the dead zone', () => {
    expect(stickToAxis(0.1, 0.05, cfg, vec2())).toEqual({ x: 0, y: 0 });
  });

  it('reaches full magnitude at the edge and never more', () => {
    const v = stickToAxis(1, 1, cfg, vec2());
    expect(length(v.x, v.y)).toBeCloseTo(1);
  });

  it('a steeper curve is finer near the center', () => {
    const linear = stickToAxis(0.5, 0, cfg, vec2()).x;
    const curved = stickToAxis(0.5, 0, { deadZone: 0.15, curve: 2 }, vec2()).x;
    expect(curved).toBeGreaterThan(0);
    expect(curved).toBeLessThan(linear);
  });
});

describe('padMoveAxis / padAimAxis', () => {
  it('left stick moves, right stick aims', () => {
    const p = pad([1, 0, 0, -1]);
    expect(padMoveAxis(p, cfg, vec2()).x).toBeCloseTo(1);
    expect(padAimAxis(p, cfg, vec2()).y).toBeCloseTo(-1);
  });

  it('the d-pad moves when the stick rests, normalized on diagonals', () => {
    const v = padMoveAxis(
      pad([0, 0, 0, 0], [PAD_BUTTON.dpadUp, PAD_BUTTON.dpadRight]),
      cfg,
      vec2(),
    );
    expect(length(v.x, v.y)).toBeCloseTo(1);
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeLessThan(0);
  });
});

describe('menu navigation', () => {
  it('reads previous / next from the d-pad or the left stick', () => {
    expect(padNavDirection(pad())).toBe(0);
    expect(padNavDirection(pad([], [PAD_BUTTON.dpadDown]))).toBe(1);
    expect(padNavDirection(pad([], [PAD_BUTTON.dpadLeft]))).toBe(-1);
    expect(padNavDirection(pad([0, -0.9]))).toBe(-1);
    expect(padNavDirection(pad([0.9, 0]))).toBe(1);
    expect(padNavDirection(pad([0.3, 0.3]))).toBe(0);
  });

  it('steps once, then repeats while held, and resets on release', () => {
    const s = newNavRepeat();
    expect(navStep(s, 1, 0)).toBe(1);
    expect(navStep(s, 1, 100)).toBe(0);
    expect(navStep(s, 1, PAD_NAV.repeatDelay)).toBe(1);
    expect(navStep(s, 1, PAD_NAV.repeatDelay + 10)).toBe(0);
    expect(navStep(s, 1, PAD_NAV.repeatDelay + PAD_NAV.repeatEvery)).toBe(1);
    expect(navStep(s, 0, 2000)).toBe(0);
    expect(navStep(s, -1, 2001)).toBe(-1);
  });
});

describe('sensitivity levels', () => {
  it('level 3 of the touch joystick is the game before the setting', () => {
    expect(TOUCH_SENSITIVITY[DEFAULT_SENSITIVITY]).toEqual(JOYSTICK);
  });

  it('every level is a valid configuration and they grow in sensitivity', () => {
    let lastRadius = Infinity;
    let lastDead = Infinity;
    for (const level of SENSITIVITY_LEVELS) {
      const touch = TOUCH_SENSITIVITY[level];
      const stick = PAD_SENSITIVITY[level];
      expect(touch.radius).toBeGreaterThan(0);
      expect(touch.deadZone).toBeGreaterThanOrEqual(0);
      expect(touch.deadZone).toBeLessThan(1);
      expect(stick.deadZone).toBeGreaterThanOrEqual(0);
      expect(stick.deadZone).toBeLessThan(1);
      expect(stick.curve).toBeGreaterThanOrEqual(1);
      expect(touch.radius).toBeLessThan(lastRadius);
      expect(stick.deadZone).toBeLessThan(lastDead);
      lastRadius = touch.radius;
      lastDead = stick.deadZone;
    }
  });
});
