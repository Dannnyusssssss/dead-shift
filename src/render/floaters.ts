import { createPool } from '../core/pool';
import { createRng } from '../core/rng';
import { FLOATERS } from '../data/render';

interface Floater {
  x: number;
  y: number;
  vx: number;
  life: number;
  text: string;
  big: boolean;
}

/** Floating damage numbers. Render-side state only. */
export interface Floaters {
  spawn(x: number, y: number, amount: number): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  clear(): void;
}

/** Shown value: rounded, never 0 for a hit that landed. */
export function displayDamage(amount: number): number {
  return Math.max(1, Math.round(amount));
}

export function createFloaters(capacity: number = FLOATERS.capacity): Floaters {
  const pool = createPool<Floater>(capacity, () => ({
    x: 0,
    y: 0,
    vx: 0,
    life: 0,
    text: '',
    big: false,
  }));
  // Strings are built once per value, not per hit.
  const texts: string[] = [];
  const textFor = (n: number): string => {
    if (n >= FLOATERS.cachedValues) return String(n);
    let s = texts[n];
    if (s === undefined) {
      s = String(n);
      texts[n] = s;
    }
    return s;
  };
  const rng = createRng(0x51f15e);

  return {
    spawn(x, y, amount) {
      const f = pool.acquire();
      if (!f) return;
      const value = displayDamage(amount);
      f.x = x + rng.range(-FLOATERS.jitter, FLOATERS.jitter);
      f.y = y;
      f.vx = rng.range(-FLOATERS.drift, FLOATERS.drift);
      f.life = FLOATERS.life;
      f.text = textFor(value);
      f.big = value >= FLOATERS.bigThreshold;
    },
    update(dt) {
      for (let i = pool.count - 1; i >= 0; i--) {
        const f = pool.items[i] as Floater;
        f.life -= dt;
        if (f.life <= 0) {
          pool.releaseAt(i);
          continue;
        }
        f.x += f.vx * dt;
        f.y -= FLOATERS.rise * dt;
      }
    },
    draw(ctx) {
      if (pool.count === 0) return;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = FLOATERS.outlineWidth;
      ctx.strokeStyle = FLOATERS.outline;
      ctx.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {
        // Two passes so the font and color change twice per frame, not per number.
        const big = pass === 1;
        ctx.font = big ? FLOATERS.bigFont : FLOATERS.font;
        ctx.fillStyle = big ? FLOATERS.bigColor : FLOATERS.color;
        for (let i = 0; i < pool.count; i++) {
          const f = pool.items[i] as Floater;
          if (f.big !== big) continue;
          ctx.globalAlpha = Math.min(1, f.life / FLOATERS.fadeTime);
          ctx.strokeText(f.text, f.x, f.y);
          ctx.fillText(f.text, f.x, f.y);
        }
      }
      ctx.globalAlpha = 1;
    },
    clear() {
      pool.clear();
    },
  };
}
