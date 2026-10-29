import type { JoystickConfig, JoystickState } from '../core/input';
import {
  AIM_STICK_STYLE,
  BOSS_BAR,
  CLOCK_HUD,
  HUD,
  JOYSTICK_STYLE,
  LOADOUT_HUD,
  DEBUG_HUD,
  MANUAL_HUD,
  XP_BAR,
} from '../data/render';
import { t } from '../data/texts';
import type { Enemy } from '../game/enemies';
import { gunStats, hasAmmo, isReloading } from '../game/manual';
import { cooldownFraction } from '../game/weapons';
import { xpToNext } from '../game/progression';
import { shiftClock } from '../game/shift';
import type { World } from '../game/world';

export interface HudDebug {
  /** Draw the performance line (F3, the pause-menu checkbox or `?debug`). */
  visible: boolean;
  fps: number;
  /** Average CPU time of update + render per frame, ms. */
  cpuMs: number;
}

export interface HudOptions {
  debug: HudDebug;
  /** The last pointer was a finger: show touch hints instead of keys. */
  touch: boolean;
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  world: Readonly<World>,
  options: Readonly<HudOptions>,
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

  // Loadout: automatic weapons row (shaded while recharging), then passives row.
  const rowY = killsY + 14;
  const step = LOADOUT_HUD.iconSize + LOADOUT_HUD.gap;
  for (let i = 0; i < player.weapons.length; i++) {
    const w = player.weapons[i];
    if (!w) continue;
    drawSlot(ctx, m + i * step, rowY, w.def.icon, w.level);
    const frac = cooldownFraction(w, player.mods.cooldown);
    if (frac > 0) {
      const s = LOADOUT_HUD.iconSize;
      ctx.fillStyle = MANUAL_HUD.cooldownShade;
      ctx.fillRect(m + i * step, rowY + s * (1 - frac), s, s * frac);
    }
  }
  for (let i = 0; i < player.passives.length; i++) {
    const p = player.passives[i];
    if (p) drawSlot(ctx, m + i * step, rowY + step, p.def.icon, p.level);
  }

  // Shift clock: centered on wide screens, top-right on narrow ones (clear of the left column).
  const wide = viewW >= HUD.wideLayoutMinWidth;
  ctx.font = CLOCK_HUD.font;
  ctx.textAlign = wide ? 'center' : 'right';
  const clockY = wide ? CLOCK_HUD.y : CLOCK_HUD.narrowY;
  drawText(ctx, shiftClock(world.time), wide ? viewW / 2 : viewW - m, clockY);

  drawBossBar(ctx, viewW, world, wide);
  drawManualPanel(ctx, viewH, world, options.touch);

  const debug = options.debug;
  if (!debug.visible) return;
  ctx.font = HUD.smallFont;
  ctx.textBaseline = 'middle';
  // Touch: the bottom-right corner holds the swap / reload buttons, so it goes above the weapon panel.
  const touch = options.touch;
  ctx.textAlign = touch ? 'left' : 'right';
  drawText(
    ctx,
    `${t('fps')} ${debug.fps} · ${debug.cpuMs.toFixed(1)} ms · ${world.enemies.count} ${t('zombies')} · ${world.kills} ${t('killsShort')}`,
    touch ? m : viewW - m,
    touch ? viewH - m - MANUAL_HUD.height - DEBUG_HUD.gapAbovePanel : viewH - m,
  );
}

/** Bottom-left panel: active manual weapon, ammo, reload progress and controls hint. */
function drawManualPanel(
  ctx: CanvasRenderingContext2D,
  viewH: number,
  world: Readonly<World>,
  touch: boolean,
): void {
  const s = MANUAL_HUD;
  const mState = world.player.manual;
  const x = HUD.margin;
  const y = viewH - HUD.margin - s.height;
  const gun = mState.active === 'gun';
  const weapon = gun ? mState.gun : mState.melee;

  ctx.fillStyle = s.bg;
  ctx.fillRect(x, y, s.width, s.height);
  ctx.strokeStyle = s.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, s.width, s.height);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = s.iconFont;
  ctx.fillStyle = HUD.textColor;
  ctx.fillText(weapon.def.icon, x + 8, y + 22);
  ctx.font = s.nameFont;
  drawText(ctx, `${t(weapon.def.nameKey)} · ${t('level')} ${weapon.level}`, x + 42, y + 14);

  ctx.font = s.ammoFont;
  if (gun) {
    const low = mState.mag <= gunStats(mState).magazine * s.lowAmmoFraction;
    drawText(
      ctx,
      `${mState.mag} / ${mState.reserve}`,
      x + 42,
      y + 34,
      low ? s.lowAmmoColor : undefined,
    );
  } else if (!hasAmmo(mState)) {
    drawText(ctx, t('noAmmo'), x + 42, y + 34, s.emptyColor);
  } else {
    // Melee by choice: show the gun's ammo in brackets so the player knows they can swap back.
    drawText(ctx, `(${mState.mag} / ${mState.reserve})`, x + 42, y + 34, s.lowAmmoColor);
  }

  if (gun && isReloading(mState)) {
    const total = gunStats(mState).reloadTime;
    const done = 1 - mState.reloadTimer / total;
    ctx.fillStyle = s.reloadBg;
    ctx.fillRect(x + 42, y + 47, s.width - 52, 5);
    ctx.fillStyle = s.reloadFill;
    ctx.fillRect(x + 42, y + 47, (s.width - 52) * done, 5);
    ctx.font = s.hintFont;
    ctx.textAlign = 'right';
    drawText(ctx, t('reloading'), x + s.width - 8, y + 34);
  } else {
    ctx.font = s.hintFont;
    ctx.textAlign = 'left';
    const hint = touch ? t('touchHint') : `${t('swapHint')} · ${t('reloadHint')}`;
    drawText(ctx, hint, x + 8, y + s.height - 7);
  }
  ctx.textAlign = 'left';
}

/** Health of the strongest living boss, if any. */
function drawBossBar(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  world: Readonly<World>,
  wide: boolean,
): void {
  let boss: Enemy | undefined;
  const { items, count } = world.enemies;
  for (let i = 0; i < count; i++) {
    const e = items[i] as Enemy;
    if (e.def.dropsChest && e.hp > 0 && (!boss || e.maxHp > boss.maxHp)) boss = e;
  }
  if (!boss) return;
  const w = Math.min(BOSS_BAR.width, viewW - HUD.margin * 2);
  const x = (viewW - w) / 2;
  const y = wide ? BOSS_BAR.y : BOSS_BAR.narrowY;
  drawBar(
    ctx,
    x,
    y,
    w,
    BOSS_BAR.height,
    boss.hp / boss.maxHp,
    BOSS_BAR.bg,
    BOSS_BAR.fill,
    BOSS_BAR.border,
  );
  ctx.font = BOSS_BAR.font;
  ctx.textAlign = 'center';
  drawText(ctx, t('bossName'), viewW / 2, y + BOSS_BAR.height + 10);
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

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string = HUD.textColor,
): void {
  ctx.fillStyle = HUD.textShadow;
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** Virtual stick; the aim stick (right side) uses a warmer color. */
export function drawJoystick(
  ctx: CanvasRenderingContext2D,
  joy: Readonly<JoystickState>,
  cfg: Readonly<JoystickConfig>,
  aim = false,
): void {
  if (!joy.active) return;
  const style = aim ? AIM_STICK_STYLE : JOYSTICK_STYLE;
  ctx.fillStyle = style.baseColor;
  ctx.strokeStyle = style.baseStroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(joy.originX, joy.originY, cfg.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = style.knobColor;
  ctx.beginPath();
  ctx.arc(joy.knobX, joy.knobY, JOYSTICK_STYLE.knobRadius, 0, Math.PI * 2);
  ctx.fill();
}
