import { describe, expect, it } from 'vitest';
import { pulse } from '../src/core/math';
import { MAX_FLASH_HZ, PULSE } from '../src/data/render';

describe('photosensitivity limits', () => {
  it('the ceiling is 3 flashes per second', () => {
    expect(MAX_FLASH_HZ).toBeLessThanOrEqual(3);
  });

  it('every warning pulse stays at or below the ceiling', () => {
    for (const hz of [PULSE.playerHz, PULSE.shockWarnHz, PULSE.microwaveHz, PULSE.glowHz]) {
      expect(hz).toBeGreaterThan(0);
      expect(hz).toBeLessThanOrEqual(MAX_FLASH_HZ);
    }
  });

  it('the player and the microwave fade but never vanish', () => {
    expect(PULSE.playerMinAlpha).toBeGreaterThan(0);
    expect(PULSE.microwaveMinAlpha).toBeGreaterThan(0);
    expect(PULSE.steadyAlpha).toBeGreaterThan(0);
    expect(PULSE.steadyAlpha).toBeLessThanOrEqual(1);
  });
});

describe('pulse', () => {
  it('starts at 1 and stays within [min, 1]', () => {
    expect(pulse(0, 2, 0.35)).toBeCloseTo(1);
    for (let t = 0; t < 2; t += 0.01) {
      const v = pulse(t, 2, 0.35);
      expect(v).toBeGreaterThanOrEqual(0.35 - 1e-9);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('completes exactly `hz` cycles per second (one minimum per cycle)', () => {
    const hz = 2;
    let minima = 0;
    const dt = 1 / 600;
    for (let t = dt; t < 1; t += dt) {
      const prev = pulse(t - dt, hz, 0);
      const cur = pulse(t, hz, 0);
      const next = pulse(t + dt, hz, 0);
      if (cur < prev && cur <= next) minima++;
    }
    expect(minima).toBe(hz);
  });
});
