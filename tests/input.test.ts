import { describe, expect, it } from 'vitest';
import {
  aimFromScreen,
  combineAxis,
  joystickToAxis,
  keyAction,
  keysToAxis,
  readAim,
  touchRole,
  type AimResult,
  type JoystickConfig,
  type JoystickState,
  type KeyState,
  type MouseState,
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

describe('touchRole', () => {
  it('left half moves, right half aims', () => {
    expect(touchRole(10, 800)).toBe('move');
    expect(touchRole(399, 800)).toBe('move');
    expect(touchRole(400, 800)).toBe('aim');
    expect(touchRole(790, 800)).toBe('aim');
  });
});

describe('aimFromScreen', () => {
  it('points from the player to the cursor', () => {
    const v = vec2();
    expect(aimFromScreen(300, 100, 100, 100, v)).toBe(true);
    expect(v).toEqual({ x: 1, y: 0 });
    expect(aimFromScreen(100, 0, 100, 100, v)).toBe(true);
    expect(v).toEqual({ x: 0, y: -1 });
  });

  it('reports no direction when the cursor is on the player', () => {
    expect(aimFromScreen(100, 100, 100, 100, vec2())).toBe(false);
  });
});

describe('readAim', () => {
  const out = (): AimResult => ({ dir: vec2(), active: false, trigger: false });
  const mouse = (over: Partial<MouseState> = {}): MouseState => ({
    seen: true,
    x: 300,
    y: 100,
    down: false,
    ...over,
  });
  const idle = joy(0, 0, false);

  it('mouse aims; the button or Space fires', () => {
    const r = readAim(idle, mouse(), false, 100, 100, cfg, out());
    expect(r.active).toBe(true);
    expect(r.dir).toEqual({ x: 1, y: 0 });
    expect(r.trigger).toBe(false);
    expect(readAim(idle, mouse({ down: true }), false, 100, 100, cfg, out()).trigger).toBe(true);
    expect(readAim(idle, mouse(), true, 100, 100, cfg, out()).trigger).toBe(true);
  });

  it('a pushed aim stick wins over the mouse and fires on its own', () => {
    const r = readAim(joy(0, 60), mouse(), false, 100, 100, cfg, out());
    expect(r.active).toBe(true);
    expect(r.dir.x).toBeCloseTo(0);
    expect(r.dir.y).toBeCloseTo(1);
    expect(r.trigger).toBe(true);
  });

  it('an aim stick inside its dead zone neither aims nor fires', () => {
    const r = readAim(joy(3, 0), mouse({ seen: false }), false, 100, 100, cfg, out());
    expect(r.active).toBe(false);
    expect(r.trigger).toBe(false);
  });

  it('keyboard only: no aim, Space still fires', () => {
    const r = readAim(idle, mouse({ seen: false }), true, 100, 100, cfg, out());
    expect(r.active).toBe(false);
    expect(r.trigger).toBe(true);
  });
});

describe('keyAction', () => {
  it('maps the one-shot keys', () => {
    expect(keyAction('KeyQ')).toBe('swap');
    expect(keyAction('KeyR')).toBe('reload');
    expect(keyAction('Escape')).toBe('pause');
    expect(keyAction('KeyP')).toBe('pause');
    expect(keyAction('KeyM')).toBe('mute');
  });

  it('ignores movement and unbound keys', () => {
    expect(keyAction('KeyW')).toBeUndefined();
    expect(keyAction('Space')).toBeUndefined();
    expect(keyAction('KeyZ')).toBeUndefined();
  });
});
