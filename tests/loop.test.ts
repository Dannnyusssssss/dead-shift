import { describe, expect, it } from 'vitest';
import {
  advanceAccumulator,
  createFrameStats,
  FIXED_STEP,
  MAX_FRAME_TIME,
  type AccumulatorResult,
} from '../src/core/loop';

const out: AccumulatorResult = { steps: 0, acc: 0 };

describe('advanceAccumulator', () => {
  it('runs one step per 60 Hz frame', () => {
    advanceAccumulator(0, FIXED_STEP, FIXED_STEP, MAX_FRAME_TIME, out);
    expect(out.steps).toBe(1);
    expect(out.acc).toBeCloseTo(0);
  });

  it('runs no steps on a short 144 Hz frame and keeps the remainder', () => {
    advanceAccumulator(0, 1 / 144, FIXED_STEP, MAX_FRAME_TIME, out);
    expect(out.steps).toBe(0);
    expect(out.acc).toBeCloseTo(1 / 144);
  });

  it('catches up on a slow 30 Hz frame', () => {
    advanceAccumulator(0, 1 / 30 + 1e-9, FIXED_STEP, MAX_FRAME_TIME, out);
    expect(out.steps).toBe(2);
  });

  it('simulates exactly one second over many uneven frames', () => {
    let acc = 0;
    let steps = 0;
    const frames = [0.01, 0.02, 0.005, 0.03, 0.0167];
    let elapsed = 0;
    for (let i = 0; elapsed < 1 - 1e-9; i++) {
      const dt = Math.min(frames[i % frames.length] ?? 0, 1 - elapsed);
      elapsed += dt;
      advanceAccumulator(acc, dt, FIXED_STEP, MAX_FRAME_TIME, out);
      acc = out.acc;
      steps += out.steps;
    }
    expect(steps).toBeGreaterThanOrEqual(59);
    expect(steps).toBeLessThanOrEqual(60);
  });

  it('caps huge frames (tab switch) to avoid the spiral of death', () => {
    advanceAccumulator(0, 5, FIXED_STEP, MAX_FRAME_TIME, out);
    expect(out.steps).toBe(Math.floor(MAX_FRAME_TIME / FIXED_STEP));
  });

  it('ignores negative frame times', () => {
    advanceAccumulator(0.01, -1, FIXED_STEP, MAX_FRAME_TIME, out);
    expect(out.steps).toBe(0);
    expect(out.acc).toBeCloseTo(0.01);
  });
});

describe('createFrameStats', () => {
  it('averages fps and cpu over the window', () => {
    const stats = createFrameStats(0.5);
    for (let i = 0; i < 31; i++) stats.tick(1 / 60, 2);
    expect(stats.fps).toBe(60);
    expect(stats.cpuMs).toBeCloseTo(2);
  });

  it('reset forgets old readings and the partial window', () => {
    const stats = createFrameStats(0.5);
    for (let i = 0; i < 31; i++) stats.tick(1 / 60, 2);
    stats.reset();
    expect(stats.fps).toBe(0);
    expect(stats.cpuMs).toBe(0);
    for (let i = 0; i < 16; i++) stats.tick(1 / 30, 5);
    expect(stats.fps).toBe(30);
    expect(stats.cpuMs).toBeCloseTo(5);
  });
});
