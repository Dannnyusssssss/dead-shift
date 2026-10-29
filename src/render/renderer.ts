import type { Camera } from '../core/camera';
import type { Input } from '../core/input';
import type { Vec2 } from '../core/math';
import { BACKGROUND_COLOR, MAX_DPR } from '../data/render';
import type { World } from '../game/world';
import { drawHud, drawJoystick } from './hud';
import { drawFloor, drawPlayer } from './sprites';

export interface RenderFrame {
  world: Readonly<World>;
  camera: Readonly<Camera>;
  /** Interpolated player position for this frame. */
  playerPos: Readonly<Vec2>;
  input: Readonly<Input>;
  fps: number;
}

export interface Renderer {
  render(frame: RenderFrame): void;
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

  return {
    render(frame) {
      syncSize();
      const { world, camera, playerPos } = frame;

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
      drawPlayer(ctx, playerPos.x, playerPos.y, world.player.facing, world.player.radius);
      ctx.restore();

      drawJoystick(ctx, frame.input.joystick, frame.input.joystickConfig);
      drawHud(ctx, viewW, world.player, frame.fps);
    },
  };
}
