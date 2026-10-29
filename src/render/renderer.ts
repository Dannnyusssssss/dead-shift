import type { Camera } from '../core/camera';
import type { Input } from '../core/input';
import { lerp, type Vec2 } from '../core/math';
import {
  BACKGROUND_COLOR,
  MAX_DPR,
  MICROWAVE_STYLE,
  PLAYER_BLINK_RATE,
  PROJECTILE_STYLE,
  STATUS_TINT,
  SWEEP,
} from '../data/render';
import { CHARGE_STATE, type Enemy } from '../game/enemies';
import { shockwaveRadius, type Hazard } from '../game/hazards';
import { meleeStats } from '../game/manual';
import type { AmmoBox, Chest, Coupon } from '../game/pickups';
import { shiftProgress } from '../game/shift';
import type { Projectile } from '../game/projectiles';
import type { Turret } from '../game/turrets';
import { orbitBagAngle, statsAt } from '../game/weapons';
import type { World } from '../game/world';
import { drawHud, drawJoystick, type HudDebug } from './hud';
import { createLighting } from './lighting';
import type { Particles } from './particles';
import {
  drawAmmoBox,
  drawBeam,
  drawCan,
  drawChest,
  drawCrosshair,
  drawCloud,
  drawCoupon,
  drawEnemy,
  drawFloor,
  drawIceBag,
  drawLabel,
  drawMicrowave,
  drawPlayer,
  drawPuddle,
  drawReceipt,
  drawShockwave,
  drawStatusTint,
  drawSweep,
  drawTelegraph,
} from './sprites';

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
  /** 0..1 progress of the dawn "fainting" animation (0 while the night goes on). */
  faint: number;
}

export interface Renderer {
  render(frame: RenderFrame): void;
  /** Current view size in CSS pixels. */
  readonly viewW: number;
  readonly viewH: number;
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;
/** Off-screen margin for culling, px. */
const CULL_PAD = 40;

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const maybeCtx = canvas.getContext('2d', { alpha: false });
  if (!maybeCtx) throw new Error('Canvas 2D no disponible');
  const ctx: CanvasRenderingContext2D = maybeCtx;

  let viewW = 0;
  let viewH = 0;
  let dpr = 1;
  let left = 0;
  let top = 0;
  const lighting = createLighting();

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

  const visible = (x: number, y: number, pad = CULL_PAD): boolean =>
    x >= left - pad && x <= left + viewW + pad && y >= top - pad && y <= top + viewH + pad;

  function drawGroundHazards(world: Readonly<World>): void {
    const { items, count } = world.hazards;
    for (let i = 0; i < count; i++) {
      const h = items[i] as Hazard;
      if (h.kind === 'puddle' && visible(h.pos.x, h.pos.y, h.radius)) {
        drawPuddle(ctx, h.pos.x, h.pos.y, h.radius, h.duration - h.age);
      }
    }
  }

  function drawAirHazards(world: Readonly<World>, alpha: number): void {
    const { items, count } = world.hazards;
    for (let i = 0; i < count; i++) {
      const h = items[i] as Hazard;
      if (h.kind === 'receipt') {
        const x = lerp(h.prevPos.x, h.pos.x, alpha);
        const y = lerp(h.prevPos.y, h.pos.y, alpha);
        drawReceipt(ctx, x, y, h.target.x, h.target.y, h.radius, h.age);
      } else if (h.kind === 'shockwave') {
        const warning = h.age < h.windup;
        drawShockwave(ctx, h.pos.x, h.pos.y, shockwaveRadius(h), h.radius, warning, world.time);
      }
    }
  }

  function drawChests(world: Readonly<World>): void {
    const { items, count } = world.chests;
    for (let i = 0; i < count; i++) {
      const c = items[i] as Chest;
      drawChest(ctx, c.pos.x, c.pos.y, world.time);
    }
  }

  function drawCoupons(world: Readonly<World>): void {
    const { items, count } = world.coupons;
    for (let i = 0; i < count; i++) {
      const c = items[i] as Coupon;
      if (visible(c.pos.x, c.pos.y)) drawCoupon(ctx, c.pos.x, c.pos.y, c.value, world.time);
    }
  }

  function drawEnemies(world: Readonly<World>, alpha: number, faint: number): void {
    const { items, count } = world.enemies;
    for (let i = 0; i < count; i++) {
      const e = items[i] as Enemy;
      const x = lerp(e.prevPos.x, e.pos.x, alpha);
      const y = lerp(e.prevPos.y, e.pos.y, alpha);
      // Accessories (the cart) reach ~2.5 radii ahead.
      if (!visible(x, y, CULL_PAD + e.radius * 2.5)) continue;
      const b = e.def.behavior;
      if (b.kind === 'charge' && e.aiState === CHARGE_STATE.windup && faint === 0) {
        const length = b.chargeSpeed * b.chargeTime;
        drawTelegraph(ctx, x, y, e.aiDir.x, e.aiDir.y, length, 1 - e.aiTimer / b.windup);
      }
      // A cart winding up faces where it will charge, not where it last walked.
      const facing =
        b.kind === 'charge' && e.aiState !== CHARGE_STATE.approach
          ? Math.atan2(e.aiDir.y, e.aiDir.x)
          : Math.atan2(e.vel.y, e.vel.x);
      drawEnemy(ctx, x, y, facing, e.radius, e.def.look, e.hitTimer > 0, faint);
      if (faint > 0) continue;
      if (e.poisonTimer > 0) drawStatusTint(ctx, x, y, e.radius, STATUS_TINT.poison);
      else if (e.slowTimer > 0) drawStatusTint(ctx, x, y, e.radius, STATUS_TINT.slow);
    }
  }

  function drawProjectiles(world: Readonly<World>, alpha: number): void {
    const { items, count } = world.projectiles;
    for (let i = 0; i < count; i++) {
      const p = items[i] as Projectile;
      const x = lerp(p.prevPos.x, p.pos.x, alpha);
      const y = lerp(p.prevPos.y, p.pos.y, alpha);
      if (!visible(x, y)) continue;
      if (p.look === 'can') drawCan(ctx, x, y, p.radius, p.life * PROJECTILE_STYLE.canSpin);
      else drawLabel(ctx, x, y, Math.atan2(p.vel.y, p.vel.x));
    }
  }

  function drawTurrets(world: Readonly<World>): void {
    const { items, count } = world.turrets;
    for (let i = 0; i < count; i++) {
      const t = items[i] as Turret;
      drawMicrowave(ctx, t.pos.x, t.pos.y, t.life, world.time);
      const since = world.time - t.lastFireTime;
      if (since >= MICROWAVE_STYLE.beamTime) continue;
      const a = 1 - since / MICROWAVE_STYLE.beamTime;
      for (let b = 0; b < t.beamCount; b++) {
        drawBeam(ctx, t.pos.x, t.pos.y, t.beamX[b] ?? t.pos.x, t.beamY[b] ?? t.pos.y, a);
      }
    }
  }

  function drawBroomSwing(world: Readonly<World>, pp: Readonly<Vec2>): void {
    const m = world.player.manual;
    const progress = (world.time - m.melee.lastFireTime) / SWEEP.fadeTime;
    if (progress >= 1) return;
    const s = meleeStats(m);
    const half = toRad(s.arcDegrees / 2);
    const a = m.melee.fireAngle;
    drawSweep(ctx, pp.x, pp.y, a, half, s.range, progress);
    if (s.bothSides) drawSweep(ctx, pp.x, pp.y, a + Math.PI, half, s.range, progress);
  }

  function drawAmmoBoxes(world: Readonly<World>): void {
    const { items, count } = world.ammoBoxes;
    for (let i = 0; i < count; i++) {
      const b = items[i] as AmmoBox;
      if (visible(b.pos.x, b.pos.y)) drawAmmoBox(ctx, b.pos.x, b.pos.y, world.time);
    }
  }

  /** Effects attached to the player (swing, cloud, orbiting bags). */
  function drawWeaponEffects(world: Readonly<World>, pp: Readonly<Vec2>): void {
    drawBroomSwing(world, pp);
    for (const w of world.player.weapons) {
      const def = w.def;
      switch (def.behavior) {
        case 'cone': {
          if (w.activeTimer <= 0) break;
          const s = statsAt(def.levels, w.level);
          drawCloud(ctx, pp.x, pp.y, w.fireAngle, toRad(s.angleDegrees / 2), s.range, world.time);
          break;
        }
        case 'orbit': {
          const s = statsAt(def.levels, w.level);
          for (let b = 0; b < s.bags; b++) {
            const a = orbitBagAngle(w, b, s.bags);
            const x = pp.x + Math.cos(a) * s.orbitRadius;
            const y = pp.y + Math.sin(a) * s.orbitRadius;
            drawIceBag(ctx, x, y, s.bagRadius, a + Math.PI / 2);
          }
          break;
        }
        default:
          break;
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
      left = camX - viewW / 2;
      top = camY - viewH / 2;

      ctx.save();
      ctx.translate(-left, -top);
      drawFloor(ctx, left, top, viewW, viewH, world.seed);
      drawGroundHazards(world);
      frame.particles.draw(ctx);
      drawCoupons(world);
      drawAmmoBoxes(world);
      drawChests(world);
      drawTurrets(world);
      drawEnemies(world, frame.alpha, frame.faint);
      drawProjectiles(world, frame.alpha);
      drawAirHazards(world, frame.alpha);
      drawWeaponEffects(world, playerPos);
      const blinkOff =
        player.invulnTimer > 0 && Math.floor(world.time * PLAYER_BLINK_RATE * 2) % 2 === 1;
      if (!blinkOff) {
        const held = player.manual.active;
        drawPlayer(ctx, playerPos.x, playerPos.y, player.facing, player.radius, held);
      }
      ctx.restore();

      lighting.draw(
        ctx,
        playerPos.x - left,
        playerPos.y - top,
        viewW,
        viewH,
        shiftProgress(world.time),
      );
      const input = frame.input;
      drawJoystick(ctx, input.joystick, input.joystickConfig);
      drawJoystick(ctx, input.aimStick, input.joystickConfig, true);
      if (input.mouse.seen && !input.aimStick.active && world.status === 'playing') {
        drawCrosshair(ctx, input.mouse.x, input.mouse.y, input.mouse.down);
      }
      drawHud(ctx, viewW, viewH, world, frame.debug);
    },
  };
}
