import type { Camera } from '../core/camera';
import type { Input } from '../core/input';
import { lerp, type Vec2 } from '../core/math';
import { BACKGROUND_COLOR, MAX_DPR, PLAYER_BLINK_RATE, SWEEP } from '../data/render';
import type { Enemy } from '../game/enemies';
import { levelStats } from '../game/weapons';
import type { World } from '../game/world';
import { drawHud, drawJoystick, type HudDebug } from './hud';
import type { Particles } from './particles';
import { drawEnemy, drawFloor, drawPlayer, drawSweep } from './sprites';

export interface RenderFrame {
  world: Readonly<World>;
  camera: Readonly<Camera>;
  /** Interpolated player position for this frame. */
  playerPos: Readonly<Vec2>;
  /** Fraction between the last two fixed steps, for interpolation. */
  alpha: number;
  input: Readonly<Input>;
  particles: Particles;
  debug: HudDebug;
}

export interface Renderer {
  render(frame: RenderFrame): void;
  /** Current view size in CSS pixels. */
  readonly viewW: number;
  readonly viewH: number;
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const maybeCtx = canvas.getContext('2d', { alpha: false });
  if (!maybeCtx) throw new Error('Canvas 2D no disponible');
  const ctx: CanvasRenderingContext2D = maybeCtx;

  let viewW = 0;
  let viewH = 0;
  let dpr = 1;

  /** Cheap per-frame check; handles window resize, rotation and DPR changes (zoom). */
  function syncSize(): void {
    const nextDpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === viewW && h === viewH && nextDpr === dpr) return;
    viewW = w;
    viewH = h;
    dpr = nextDpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function drawEnemies(world: Readonly<World>, alpha: number, left: number, top: number): void {
    const { items, count } = world.enemies;
    const pad = 40;
    for (let i = 0; i < count; i++) {
      const e = items[i] as Enemy;
      const x = lerp(e.prevPos.x, e.pos.x, alpha);
      const y = lerp(e.prevPos.y, e.pos.y, alpha);
      if (x < left - pad || x > left + viewW + pad || y < top - pad || y > top + viewH + pad) {
        continue;
      }
      const angle = Math.atan2(e.vel.y, e.vel.x);
      drawEnemy(ctx, x, y, angle, e.radius, e.def.look, e.hitTimer > 0);
    }
  }

  function drawWeaponEffects(world: Readonly<World>, playerPos: Readonly<Vec2>): void {
    for (const w of world.player.weapons) {
      if (w.def.behavior !== 'arc') continue;
      const progress = (world.time - w.lastFireTime) / SWEEP.fadeTime;
      if (progress >= 1) continue;
      const stats = levelStats(w);
      const halfArc = ((stats.arcDegrees / 2) * Math.PI) / 180;
      drawSweep(ctx, playerPos.x, playerPos.y, w.fireAngle, halfArc, stats.range, progress);
      if (stats.bothSides) {
        drawSweep(
          ctx,
          playerPos.x,
          playerPos.y,
          w.fireAngle + Math.PI,
          halfArc,
          stats.range,
          progress,
        );
      }
    }
  }

  return {
    get viewW() {
      return viewW;
    },
    get viewH() {
      return viewH;
    },
    render(frame) {
      syncSize();
      const { world, camera, playerPos } = frame;
      const player = world.player;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = BACKGROUND_COLOR;
      ctx.fillRect(0, 0, viewW, viewH);

      // Snap the camera to device pixels to avoid shimmering tile lines.
      const camX = Math.round(camera.x * dpr) / dpr;
      const camY = Math.round(camera.y * dpr) / dpr;
      const left = camX - viewW / 2;
      const top = camY - viewH / 2;

      ctx.save();
      ctx.translate(-left, -top);
      drawFloor(ctx, left, top, viewW, viewH, world.seed);
      frame.particles.draw(ctx);
      drawEnemies(world, frame.alpha, left, top);
      drawWeaponEffects(world, playerPos);
      const blinkOff =
        player.invulnTimer > 0 && Math.floor(world.time * PLAYER_BLINK_RATE * 2) % 2 === 1;
      if (!blinkOff) drawPlayer(ctx, playerPos.x, playerPos.y, player.facing, player.radius);
      ctx.restore();

      drawJoystick(ctx, frame.input.joystick, frame.input.joystickConfig);
      drawHud(ctx, viewW, world, frame.debug);
    },
  };
}
