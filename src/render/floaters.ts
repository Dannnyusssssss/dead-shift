import { createPool } from '../core/pool';
import { createRng } from '../core/rng';
import { FLOATERS } from '../data/render';

interface Floater {
  x: number;
  y: number;
  vx: number;
  life: number;
  text: string;
  /** Draw pass: normal, big or armored. */
  style: number;
}

const STYLE_NORMAL = 0;
const STYLE_BIG = 1;
const STYLE_ARMORED = 2;
const STYLE_COUNT = 3;

/** Floating damage numbers. Render-side state only. */
export interface Floaters {
  spawn(x: number, y: number, amount: number, armored?: boolean): void;
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
    style: STYLE_NORMAL,
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
    spawn(x, y, amount, armored = false) {
      const f = pool.acquire();
      if (!f) return;
      const value = displayDamage(amount);
      f.x = x + rng.range(-FLOATERS.jitter, FLOATERS.jitter);
      f.y = y;
      f.vx = rng.range(-FLOATERS.drift, FLOATERS.drift);
      f.life = FLOATERS.life;
      f.text = textFor(value);
      f.style = armored ? STYLE_ARMORED : value >= FLOATERS.bigThreshold ? STYLE_BIG : STYLE_NORMAL;
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
      for (let style = 0; style < STYLE_COUNT; style++) {
        // One pass per style so the font and color change a few times per frame, not per number.
        ctx.font = style === STYLE_BIG ? FLOATERS.bigFont : FLOATERS.font;
        ctx.fillStyle =
          style === STYLE_BIG
            ? FLOATERS.bigColor
            : style === STYLE_ARMORED
              ? FLOATERS.armoredColor
              : FLOATERS.color;
        for (let i = 0; i < pool.count; i++) {
          const f = pool.items[i] as Floater;
          if (f.style !== style) continue;
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
