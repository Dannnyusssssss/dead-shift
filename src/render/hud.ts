import type { JoystickConfig, JoystickState } from '../core/input';
import { HUD, JOYSTICK_STYLE, LOADOUT_HUD, XP_BAR } from '../data/render';
import { t } from '../data/texts';
import { xpToNext } from '../game/progression';
import type { World } from '../game/world';

export interface HudDebug {
  fps: number;
  /** Average CPU time of update + render per frame, ms. */
  cpuMs: number;
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  world: Readonly<World>,
  debug: Readonly<HudDebug>,
): void {
  const m = HUD.margin;
  const player = world.player;
  const barW = HUD.hpBarWidth;

  // Health.
  const hpRatio = player.maxHp > 0 ? Math.max(0, player.hp / player.maxHp) : 0;
  drawBar(ctx, m, m, barW, HUD.hpBarHeight, hpRatio, HUD.hpBg, HUD.hpFill, HUD.hpBorder);
  ctx.font = HUD.font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  drawText(
    ctx,
    `${t('hp')} ${Math.ceil(player.hp)}/${player.maxHp}`,
    m + 8,
    m + HUD.hpBarHeight / 2 + 1,
  );

  // Experience.
  const xpY = m + HUD.hpBarHeight + 6;
  const xpRatio = Math.min(1, player.xp / xpToNext(player));
  drawBar(ctx, m, xpY, barW, XP_BAR.height, xpRatio, XP_BAR.bg, XP_BAR.fill, XP_BAR.border);
  drawText(ctx, `${t('level')} ${player.level}`, m + barW + 8, xpY + XP_BAR.height / 2);

  const killsY = xpY + XP_BAR.height + 14;
  drawText(ctx, `${t('kills')}: ${world.kills}`, m, killsY);

  // Loadout: weapons row, then passives row.
  const rowY = killsY + 14;
  const step = LOADOUT_HUD.iconSize + LOADOUT_HUD.gap;
  for (let i = 0; i < player.weapons.length; i++) {
    const w = player.weapons[i];
    if (w) drawSlot(ctx, m + i * step, rowY, w.def.icon, w.level);
  }
  for (let i = 0; i < player.passives.length; i++) {
    const p = player.passives[i];
    if (p) drawSlot(ctx, m + i * step, rowY + step, p.def.icon, p.level);
  }

  ctx.font = HUD.smallFont;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  drawText(
    ctx,
    `${t('fps')} ${debug.fps} · ${debug.cpuMs.toFixed(1)} ms · ${world.enemies.count} ${t('zombies')}`,
    viewW - m,
    m + HUD.hpBarHeight / 2,
  );
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  bg: string,
  fill: string,
  border: string,
): void {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * ratio, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function drawSlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  icon: string,
  level: number,
): void {
  const s = LOADOUT_HUD.iconSize;
  ctx.fillStyle = LOADOUT_HUD.slotBg;
  ctx.fillRect(x, y, s, s);
  ctx.font = LOADOUT_HUD.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = HUD.textColor;
  ctx.fillText(icon, x + s / 2, y + s / 2 + 1);
  ctx.font = LOADOUT_HUD.levelFont;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  drawText(ctx, String(level), x + s + 1, y + s + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.fillStyle = HUD.textShadow;
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = HUD.textColor;
  ctx.fillText(text, x, y);
}

export function drawJoystick(
  ctx: CanvasRenderingContext2D,
  joy: Readonly<JoystickState>,
  cfg: Readonly<JoystickConfig>,
): void {
  if (!joy.active) return;
  ctx.fillStyle = JOYSTICK_STYLE.baseColor;
  ctx.strokeStyle = JOYSTICK_STYLE.baseStroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(joy.originX, joy.originY, cfg.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = JOYSTICK_STYLE.knobColor;
  ctx.beginPath();
  ctx.arc(joy.knobX, joy.knobY, JOYSTICK_STYLE.knobRadius, 0, Math.PI * 2);
  ctx.fill();
}
