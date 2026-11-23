import { COVER } from '../src/data/cover';
import { ENEMIES } from '../src/data/enemies';
import { PLAYER_BASE } from '../src/data/player';
import { BACKGROUND_COLOR, ENEMY_SPRITE } from '../src/data/render';
import { t } from '../src/data/texts';
import { createLighting } from '../src/render/lighting';
import { drawEnemy, drawFloor, drawLabel, drawPlayer } from '../src/render/sprites';
import { buildCoverScene, type CoverZombie } from './cover-scene';

/** Glowing eyes of a zombie lost in the dark, at the same spot the sprite draws them. */
function drawEyeGlow(ctx: CanvasRenderingContext2D, z: CoverZombie): void {
  const r = ENEMIES[z.id].radius;
  const g = COVER.eyeGlow;
  ctx.save();
  ctx.translate(z.x, z.y);
  ctx.rotate(z.angle);
  ctx.fillStyle = ENEMY_SPRITE.eyes;
  ctx.shadowColor = ENEMY_SPRITE.eyes;
  ctx.shadowBlur = g.blur;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(r * 0.48, side * r * 0.17, g.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTitle(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  px: number,
  py: number,
): void {
  const s = COVER.shade;
  const shade = ctx.createLinearGradient(0, H * s.startY, 0, H);
  shade.addColorStop(0, s.from);
  shade.addColorStop(1, s.to);
  ctx.fillStyle = shade;
  ctx.fillRect(0, H * s.startY, W, H * (1 - s.startY));

  const v = COVER.vignette;
  const vig = ctx.createRadialGradient(px, py, W * v.inner, px, py, W * v.outer);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, v.color);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  const ti = COVER.title;
  const right = W - ti.marginRight;
  const base = H - ti.baselineFromBottom;
  const text = t('gameTitle').toUpperCase();
  ctx.font = ti.font;
  ctx.letterSpacing = ti.letterSpacing;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';

  const m = ctx.measureText(text);
  const fill = ctx.createLinearGradient(0, base - m.actualBoundingBoxAscent, 0, base);
  ti.fill.forEach((c, i) => fill.addColorStop(i / (ti.fill.length - 1), c));

  ctx.lineWidth = ti.strokeWidth;
  ctx.strokeStyle = ti.stroke;
  ctx.strokeText(text, right, base);
  ctx.shadowColor = ti.glow;
  ctx.shadowBlur = ti.glowBlur;
  ctx.fillStyle = fill;
  ctx.fillText(text, right, base);
  ctx.shadowBlur = 0;
  ctx.fillText(text, right, base);
  ctx.letterSpacing = '0px';

  const tg = COVER.tagline;
  ctx.font = tg.font;
  ctx.fillStyle = tg.color;
  ctx.shadowColor = tg.shadow;
  ctx.shadowBlur = 6;
  ctx.fillText(t('coverTagline'), right, H - tg.baselineFromBottom);
  ctx.shadowBlur = 0;
}

function drawCover(canvas: HTMLCanvasElement): void {
  const W = COVER.width;
  const H = COVER.height;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const scene = buildCoverScene();
  const zoom = COVER.zoom;
  const viewW = W / zoom;
  const viewH = H / zoom;
  const left = scene.player.x - viewW * COVER.playerScreen.x;
  const top = scene.player.y - viewH * COVER.playerScreen.y;

  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-left, -top);
  drawFloor(ctx, left, top, viewW, viewH, COVER.mapSeed);
  for (const z of scene.zombies) {
    drawEnemy(ctx, z.x, z.y, z.angle, ENEMIES[z.id].radius, ENEMIES[z.id].look, false);
  }
  for (const l of scene.labels) drawLabel(ctx, l.x, l.y, l.angle);
  drawPlayer(ctx, scene.player.x, scene.player.y, scene.facing, PLAYER_BASE.radius, 'labelGun');
  ctx.restore();

  // Same darkness and flashlight as in the game, in the zoomed view.
  ctx.save();
  ctx.scale(zoom, zoom);
  createLighting().draw(
    ctx,
    scene.player.x - left,
    scene.player.y - top,
    viewW,
    viewH,
    COVER.lightingProgress,
  );
  ctx.translate(-left, -top);
  for (const z of scene.zombies) if (z.dist >= COVER.eyeGlowFrom) drawEyeGlow(ctx, z);
  ctx.restore();

  drawTitle(ctx, W, H, (scene.player.x - left) * zoom, (scene.player.y - top) * zoom);
}

const canvas = document.getElementById('cover');
const button = document.getElementById('download');
if (canvas instanceof HTMLCanvasElement && button instanceof HTMLButtonElement) {
  button.textContent = t('coverDownload');
  // Fonts are system fonts; wait for them anyway so the title never falls back mid-draw.
  void document.fonts.ready.then(() => drawCover(canvas));
  button.addEventListener('click', () => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dead-shift-portada.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  });
}
