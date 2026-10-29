import { describe, expect, it } from 'vitest';
import { addShake, createCamera, updateShake, type ShakeConfig } from '../src/core/camera';
import { vec2 } from '../src/core/math';

const cfg: ShakeConfig = { maxOffset: 10, decay: 2, frequency: 30 };

describe('screen shake', () => {
  it('starts still', () => {
    const cam = createCamera(vec2(0, 0), 10);
    updateShake(cam, cfg, 1 / 60);
    expect(cam.offsetX).toBe(0);
    expect(cam.offsetY).toBe(0);
  });

  it('stacks trauma up to 1', () => {
    const cam = createCamera(vec2(0, 0), 10);
    addShake(cam, 0.4);
    addShake(cam, 0.4);
    expect(cam.trauma).toBeCloseTo(0.8);
    addShake(cam, 5);
    expect(cam.trauma).toBe(1);
    addShake(cam, -3);
    expect(cam.trauma).toBe(1);
  });

  it('stays within maxOffset · trauma² and decays back to exactly zero', () => {
    const cam = createCamera(vec2(0, 0), 10);
    addShake(cam, 0.5);
    let moved = false;
    for (let i = 0; i < 120; i++) {
      const bound = cfg.maxOffset * cam.trauma * cam.trauma;
      updateShake(cam, cfg, 1 / 60);
      expect(Math.abs(cam.offsetX)).toBeLessThanOrEqual(bound + 1e-9);
      expect(Math.abs(cam.offsetY)).toBeLessThanOrEqual(bound + 1e-9);
      if (cam.offsetX !== 0 || cam.offsetY !== 0) moved = true;
    }
    expect(moved).toBe(true);
    // 0.5 trauma at 2/s is gone after 0.25 s.
    expect(cam.trauma).toBe(0);
    expect(cam.offsetX).toBe(0);
    expect(cam.offsetY).toBe(0);
  });

  it('never touches the follow position', () => {
    const cam = createCamera(vec2(100, 50), 10);
    addShake(cam, 1);
    updateShake(cam, cfg, 0.1);
    expect(cam.x).toBe(100);
    expect(cam.y).toBe(50);
  });
});
