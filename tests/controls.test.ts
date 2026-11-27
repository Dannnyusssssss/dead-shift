import { describe, expect, it } from 'vitest';
import { assignKey } from '../src/core/bindings';
import { viewFactor, worldToScreen } from '../src/core/camera';
import { createPadReader, type PadSnapshot } from '../src/core/gamepad';
import {
  DEFAULT_KEY_BINDINGS,
  DEFAULT_PAD_BINDINGS,
  DEFAULT_VIEW_SCALE,
  PAD_BUTTON,
  PAD_SENSITIVITY,
  VIEW_SCALES,
} from '../src/data/controls';
import { spawnRadiusForView } from '../src/game/spawner';
import { controlsSummary } from '../src/ui/key-labels';
import { stepFocusIndex } from '../src/ui/pad-nav';

const stick = PAD_SENSITIVITY[3];

function pad(pressed: number[] = [], axes: number[] = [0, 0, 0, 0]): PadSnapshot {
  return {
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: pressed.includes(i),
      value: pressed.includes(i) ? 1 : 0,
    })),
  };
}

describe('field of view', () => {
  it('100 % is the game before the setting', () => {
    expect(DEFAULT_VIEW_SCALE).toBe(100);
    expect(viewFactor(DEFAULT_VIEW_SCALE)).toBe(1);
    expect(worldToScreen(500, 400, 800, 1)).toBe(500);
  });

  it('a wider view draws the world smaller around the screen center', () => {
    const f = viewFactor(130);
    expect(worldToScreen(400, 400, 800, f)).toBe(400);
    expect(worldToScreen(530, 400, 800, f)).toBeCloseTo(500);
  });

  it('zombies keep spawning off-screen at every level', () => {
    for (const scale of VIEW_SCALES) {
      const f = viewFactor(scale);
      const w = 1920 * f;
      const h = 1080 * f;
      expect(spawnRadiusForView(w, h)).toBeGreaterThan(Math.hypot(w, h) / 2);
    }
  });

  it('the levels are sorted and capped for performance', () => {
    expect([...VIEW_SCALES].sort((a, b) => a - b)).toEqual([...VIEW_SCALES]);
    expect(Math.max(...VIEW_SCALES)).toBeLessThanOrEqual(130);
    expect(VIEW_SCALES).toContain(100);
  });
});

describe('createPadReader', () => {
  it('reports each new press once', () => {
    const reader = createPadReader();
    const presses: number[] = [];
    const onPress = (b: number): void => {
      presses.push(b);
    };
    reader.poll(pad(), stick, 0, onPress);
    reader.poll(pad([PAD_BUTTON.rt]), stick, 16, onPress);
    reader.poll(pad([PAD_BUTTON.rt]), stick, 32, onPress);
    reader.poll(pad(), stick, 48, onPress);
    reader.poll(pad([PAD_BUTTON.rt]), stick, 64, onPress);
    expect(presses).toEqual([PAD_BUTTON.rt, PAD_BUTTON.rt]);
  });

  it('a pad that connects with a button held does not press it', () => {
    const reader = createPadReader();
    const presses: number[] = [];
    reader.poll(pad([PAD_BUTTON.start]), stick, 0, (b) => presses.push(b));
    expect(reader.connected).toBe(true);
    expect(reader.held(PAD_BUTTON.start)).toBe(true);
    expect(presses).toEqual([]);
  });

  it('a disconnect clears the sticks and held buttons', () => {
    const reader = createPadReader();
    reader.poll(pad([PAD_BUTTON.rt], [1, 0, 0, 1]), stick, 0, () => undefined);
    expect(reader.move.x).toBeCloseTo(1);
    reader.poll(null, stick, 16, () => undefined);
    expect(reader.connected).toBe(false);
    expect(reader.move).toEqual({ x: 0, y: 0 });
    expect(reader.aim).toEqual({ x: 0, y: 0 });
    expect(reader.held(PAD_BUTTON.rt)).toBe(false);
  });

  it('returns menu steps from the d-pad', () => {
    const reader = createPadReader();
    reader.poll(pad(), stick, 0, () => undefined);
    expect(reader.poll(pad([PAD_BUTTON.dpadDown]), stick, 16, () => undefined)).toBe(1);
    expect(reader.poll(pad([PAD_BUTTON.dpadDown]), stick, 32, () => undefined)).toBe(0);
  });
});

describe('stepFocusIndex', () => {
  it('wraps around and starts at an end when nothing is focused', () => {
    expect(stepFocusIndex(-1, 4, 1)).toBe(0);
    expect(stepFocusIndex(-1, 4, -1)).toBe(3);
    expect(stepFocusIndex(3, 4, 1)).toBe(0);
    expect(stepFocusIndex(0, 4, -1)).toBe(3);
    expect(stepFocusIndex(1, 4, 1)).toBe(2);
    expect(stepFocusIndex(0, 0, 1)).toBe(-1);
  });
});

describe('controlsSummary', () => {
  it('shows the keys of every release before the controls menu', () => {
    const text = controlsSummary(DEFAULT_KEY_BINDINGS, DEFAULT_PAD_BINDINGS, 'keyboard');
    expect(text).toContain('WASD: moverse');
    expect(text).toContain('Espacio');
    expect(text).toContain('R: recargar');
    expect(text).toContain('F3: métricas');
  });

  it('follows the assigned keys', () => {
    const b = assignKey(DEFAULT_KEY_BINDINGS, 'reload', 'KeyE')?.bindings;
    if (!b) throw new Error('assignment failed');
    expect(controlsSummary(b, DEFAULT_PAD_BINDINGS, 'keyboard')).toContain('E: recargar');
    const spaced = assignKey(DEFAULT_KEY_BINDINGS, 'up', 'Space')?.bindings;
    if (!spaced) throw new Error('assignment failed');
    expect(controlsSummary(spaced, DEFAULT_PAD_BINDINGS, 'keyboard')).toContain(
      'Espacio / A / S / D: moverse',
    );
  });

  it('has a gamepad and a touch version', () => {
    expect(controlsSummary(DEFAULT_KEY_BINDINGS, DEFAULT_PAD_BINDINGS, 'pad')).toContain('RT');
    expect(controlsSummary(DEFAULT_KEY_BINDINGS, DEFAULT_PAD_BINDINGS, 'touch')).toContain(
      'Mitad izquierda',
    );
  });
});
