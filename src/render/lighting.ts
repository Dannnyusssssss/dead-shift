import { lerp } from '../core/math';
import { LIGHTING } from '../data/render';

/** Night darkness (0..1) for a shift progress (0 = 10 PM, 1 = 6 AM). */
export function darknessAt(progress: number): number {
  if (progress <= LIGHTING.liftFrom) return LIGHTING.maxDarkness;
  const t = Math.min(1, (progress - LIGHTING.liftFrom) / (1 - LIGHTING.liftFrom));
  return LIGHTING.maxDarkness * (1 - t);
}

export interface Lighting {
  /** Draws the darkness with a flashlight hole centered on (sx, sy) in screen space. */
  draw(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    viewW: number,
    viewH: number,
    progress: number,
  ): void;
}

export function createLighting(): Lighting {
  let cached: CanvasGradient | undefined;
  let cachedKey = -1;
  let cachedCtx: CanvasRenderingContext2D | undefined;

  return {
    draw(ctx, sx, sy, viewW, viewH, progress) {
      const darkness = darknessAt(progress);
      const step = Math.round(darkness * LIGHTING.steps);
      if (step > 0) {
        // The flashlight widens as the darkness lifts.
        const lift = 1 - darkness / LIGHTING.maxDarkness;
        const outer = Math.round(lerp(LIGHTING.outer, LIGHTING.outerAtDawn, lift) / 10) * 10;
        const key = step * 100_000 + outer;
        if (key !== cachedKey || cachedCtx !== ctx || !cached) {
          // Rebuilt only when the quantized darkness or radius changes, not every frame.
          const alpha = step / LIGHTING.steps;
          cached = ctx.createRadialGradient(0, 0, LIGHTING.inner, 0, 0, outer);
          cached.addColorStop(0, 'rgba(0, 0, 0, 0)');
          cached.addColorStop(1, `rgba(0, 0, 0, ${alpha.toFixed(3)})`);
          cachedKey = key;
          cachedCtx = ctx;
        }
        ctx.save();
        ctx.translate(sx, sy);
        ctx.fillStyle = cached;
        ctx.fillRect(-sx, -sy, viewW, viewH);
        ctx.restore();
      }
      if (progress > LIGHTING.dawnTintFrom) {
        ctx.globalAlpha = (progress - LIGHTING.dawnTintFrom) / (1 - LIGHTING.dawnTintFrom);
        ctx.fillStyle = LIGHTING.dawnTint;
        ctx.fillRect(0, 0, viewW, viewH);
        ctx.globalAlpha = 1;
      }
    },
  };
}
