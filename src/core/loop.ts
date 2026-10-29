export const FIXED_STEP = 1 / 60;
/** Longest frame we simulate; anything longer (tab switch, breakpoint) is dropped. */
export const MAX_FRAME_TIME = 0.25;

export interface AccumulatorResult {
  steps: number;
  acc: number;
}

/**
 * Pure accumulator step: adds `frameDt` (clamped) to `acc` and returns how many
 * fixed steps to run plus the leftover. Writes into `out` to avoid allocations.
 */
export function advanceAccumulator(
  acc: number,
  frameDt: number,
  step: number,
  maxFrame: number,
  out: AccumulatorResult,
): AccumulatorResult {
  let total = acc + Math.min(Math.max(frameDt, 0), maxFrame);
  let steps = 0;
  while (total >= step) {
    total -= step;
    steps++;
  }
  out.steps = steps;
  out.acc = total;
  return out;
}

export interface LoopHandlers {
  update(dt: number): void;
  /** `alpha` in [0, 1) is how far we are between the last and the next fixed step. */
  render(alpha: number, frameDt: number): void;
}

export interface Loop {
  start(): void;
  stop(): void;
}

export function createFixedLoop(handlers: LoopHandlers, step = FIXED_STEP): Loop {
  const result: AccumulatorResult = { steps: 0, acc: 0 };
  let acc = 0;
  let last = 0;
  let rafId = 0;
  let running = false;

  const frame = (now: number): void => {
    if (!running) return;
    const frameDt = (now - last) / 1000;
    last = now;
    advanceAccumulator(acc, frameDt, step, MAX_FRAME_TIME, result);
    acc = result.acc;
    for (let i = 0; i < result.steps; i++) handlers.update(step);
    handlers.render(acc / step, Math.min(frameDt, MAX_FRAME_TIME));
    rafId = requestAnimationFrame(frame);
  };

  return {
    start() {
      if (running) return;
      running = true;
      acc = 0;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
  };
}

/** Rolling frames-per-second estimate, refreshed every `window` seconds. */
export interface FpsMeter {
  readonly fps: number;
  tick(frameDt: number): void;
}

export function createFpsMeter(window = 0.5): FpsMeter {
  let frames = 0;
  let elapsed = 0;
  let fps = 0;
  return {
    get fps() {
      return fps;
    },
    tick(frameDt) {
      frames++;
      elapsed += frameDt;
      if (elapsed >= window) {
        fps = Math.round(frames / elapsed);
        frames = 0;
        elapsed = 0;
      }
    },
  };
}
