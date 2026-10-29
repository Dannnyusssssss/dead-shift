import type { JoystickConfig, JoystickState } from '../core/input';
import { HUD, JOYSTICK_STYLE } from '../data/render';
import { t } from '../data/texts';
import type { Player } from '../game/player';

export function drawHud(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  player: Readonly<Player>,
  fps: number,
): void {
  const m = HUD.margin;
  const ratio = player.maxHp > 0 ? Math.max(0, player.hp / player.maxHp) : 0;

  ctx.fillStyle = HUD.hpBg;
  ctx.fillRect(m, m, HUD.hpBarWidth, HUD.hpBarHeight);
  ctx.fillStyle = HUD.hpFill;
  ctx.fillRect(m, m, HUD.hpBarWidth * ratio, HUD.hpBarHeight);
  ctx.strokeStyle = HUD.hpBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(m, m, HUD.hpBarWidth, HUD.hpBarHeight);

  ctx.font = HUD.font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  drawText(
    ctx,
    `${t('hp')} ${Math.ceil(player.hp)}/${player.maxHp}`,
    m + 8,
    m + HUD.hpBarHeight / 2 + 1,
  );

  ctx.font = HUD.smallFont;
  ctx.textAlign = 'right';
  drawText(ctx, `${t('fps')} ${fps}`, viewW - m, m + HUD.hpBarHeight / 2);
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
