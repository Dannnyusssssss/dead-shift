import { describe, expect, it } from 'vitest';
import {
  combineAxis,
  joystickToAxis,
  keysToAxis,
  type JoystickConfig,
  type JoystickState,
  type KeyState,
} from '../src/core/input';
import { length, vec2 } from '../src/core/math';

const cfg: JoystickConfig = { radius: 60, deadZone: 0.15 };
const noKeys = (): KeyState => ({ up: false, down: false, left: false, right: false });
const joy = (dx: number, dy: number, active = true): JoystickState => ({
  active,
  pointerId: 1,
  originX: 100,
  originY: 100,
  knobX: 100 + dx,
  knobY: 100 + dy,
});

describe('keysToAxis', () => {
  it('maps single directions (y grows downward)', () => {
    expect(keysToAxis({ ...noKeys(), right: true }, vec2())).toEqual({ x: 1, y: 0 });
    expect(keysToAxis({ ...noKeys(), up: true }, vec2())).toEqual({ x: 0, y: -1 });
  });

  it('normalizes diagonals', () => {
    const v = keysToAxis({ ...noKeys(), up: true, left: true }, vec2());
    expect(length(v.x, v.y)).toBeCloseTo(1);
    expect(v.x).toBeLessThan(0);
    expect(v.y).toBeLessThan(0);
  });

  it('cancels opposite keys', () => {
    expect(keysToAxis({ up: true, down: true, left: true, right: true }, vec2())).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('joystickToAxis', () => {
  it('is zero when inactive', () => {
    expect(joystickToAxis(joy(60, 0, false), cfg, vec2())).toEqual({ x: 0, y: 0 });
  });

  it('ignores movement inside the dead zone', () => {
    expect(joystickToAxis(joy(5, 0), cfg, vec2())).toEqual({ x: 0, y: 0 });
  });

  it('reaches full magnitude at the radius and clamps past it', () => {
    const full = joystickToAxis(joy(0, 60), cfg, vec2());
    expect(full.x).toBeCloseTo(0);
    expect(full.y).toBeCloseTo(1);
    const past = joystickToAxis(joy(0, 200), cfg, vec2());
    expect(past.y).toBeCloseTo(1);
  });

  it('is analog in between', () => {
    const v = joystickToAxis(joy(30, 0), cfg, vec2());
    expect(v.x).toBeGreaterThan(0);
    expect(v.x).toBeLessThan(1);
  });
});

describe('combineAxis', () => {
  it('prefers the joystick when pushed', () => {
    const v = combineAxis({ ...noKeys(), left: true }, joy(60, 0), cfg, vec2());
    expect(v.x).toBeCloseTo(1);
  });

  it('falls back to keyboard when the joystick is idle', () => {
    const v = combineAxis({ ...noKeys(), left: true }, joy(0, 0), cfg, vec2());
    expect(v).toEqual({ x: -1, y: 0 });
  });
});
