import type { Vec2 } from '../core/math';
import { hash2 } from '../core/rng';
import type { EnemyLook } from '../data/enemies';
import {
  COUPON_STYLE,
  CLOUD_STYLE,
  ENEMY_SPRITE,
  FLOOR,
  ICE_STYLE,
  MICROWAVE_STYLE,
  PLAYER_SPRITE,
  PROJECTILE_STYLE,
  SHELVES,
  SWEEP,
} from '../data/render';

/** Draws the supermarket floor covering the world-space rect [left, left+w] x [top, top+h]. */
export function drawFloor(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  w: number,
  h: number,
  seed: number,
): void {
  const T = FLOOR.tileSize;
  const tx0 = Math.floor(left / T);
  const ty0 = Math.floor(top / T);
  const tx1 = Math.floor((left + w) / T);
  const ty1 = Math.floor((top + h) / T);

  ctx.fillStyle = FLOOR.colorA;
  ctx.fillRect(left, top, w, h);

  ctx.fillStyle = FLOOR.colorB;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0 + (((tx0 + ty) & 1) ^ 1); tx <= tx1; tx += 2) {
      ctx.fillRect(tx * T, ty * T, T, T);
    }
  }

  ctx.strokeStyle = FLOOR.groutColor;
  ctx.lineWidth = FLOOR.groutWidth;
  ctx.beginPath();
  for (let tx = tx0; tx <= tx1 + 1; tx++) {
    ctx.moveTo(tx * T, top);
    ctx.lineTo(tx * T, top + h);
  }
  for (let ty = ty0; ty <= ty1 + 1; ty++) {
    ctx.moveTo(left, ty * T);
    ctx.lineTo(left + w, ty * T);
  }
  ctx.stroke();

  drawShelves(ctx, left, top, w, h, seed);
}

function drawShelves(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  w: number,
  h: number,
  seed: number,
): void {
  const T = FLOOR.tileSize;
  const blockW = SHELVES.blockTilesX * T;
  const blockH = SHELVES.blockTilesY * T;
  const bx0 = Math.floor(left / blockW);
  const by0 = Math.floor(top / blockH);
  const bx1 = Math.floor((left + w) / blockW);
  const by1 = Math.floor((top + h) / blockH);
  const lengthRange = SHELVES.maxLengthTiles - SHELVES.minLengthTiles + 1;

  for (let by = by0; by <= by1; by++) {
    for (let bx = bx0; bx <= bx1; bx++) {
      if (hash2(bx, by, seed) >= SHELVES.density) continue;
      const lenTiles = SHELVES.minLengthTiles + Math.floor(hash2(bx, by, seed + 1) * lengthRange);
      const offX = Math.floor(hash2(bx, by, seed + 2) * (SHELVES.blockTilesX - lenTiles));
      const offY = 1 + Math.floor(hash2(bx, by, seed + 3) * (SHELVES.blockTilesY - 2));
      const x = bx * blockW + offX * T;
      const y = by * blockH + offY * T + (T - SHELVES.depth) / 2;
      const len = lenTiles * T;
      if (x > left + w || x + len < left || y > top + h || y + SHELVES.depth < top) continue;
      drawShelf(ctx, x, y, lenTiles, bx, by, seed);
    }
  }
}

function drawShelf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lenTiles: number,
  bx: number,
  by: number,
  seed: number,
): void {
  const T = FLOOR.tileSize;
  const len = lenTiles * T;
  const depth = SHELVES.depth;
  const inset = SHELVES.productInset;
  const half = depth / 2;

  ctx.fillStyle = SHELVES.shadowColor;
  ctx.fillRect(x + 4, y + 6, len, depth);
  ctx.fillStyle = SHELVES.frameColor;
  ctx.fillRect(x, y, len, depth);
  ctx.fillStyle = SHELVES.topColor;
  ctx.fillRect(x + 2, y + 2, len - 4, depth - 4);

  const slots = lenTiles * SHELVES.productsPerTile;
  const slotW = len / slots;
  const colors = SHELVES.productColors;
  for (let side = 0; side < 2; side++) {
    const py = side === 0 ? y + inset : y + half + 1;
    const ph = half - inset - 1;
    for (let i = 0; i < slots; i++) {
      const c = Math.floor(hash2(bx * 97 + i, by * 31 + side, seed + 4) * colors.length);
      ctx.fillStyle = colors[c] ?? SHELVES.topColor;
      ctx.fillRect(x + i * slotW + 2, py, slotW - 3, ph);
    }
  }

  ctx.fillStyle = SHELVES.dividerColor;
  ctx.fillRect(x, y + half - 1, len, 2);
}

/** Top-down "Mati": body, reflective vest, head and a cap whose brim points where he faces. */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: Vec2,
  radius: number,
): void {
  const angle = Math.atan2(facing.y, facing.x);

  ctx.fillStyle = PLAYER_SPRITE.shadow;
  ctx.beginPath();
  ctx.ellipse(x + 2, y + radius * 0.6, radius * 1.05, radius * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.lineWidth = 2;
  ctx.strokeStyle = PLAYER_SPRITE.outline;

  // Shoulders / body, wider than deep.
  ctx.fillStyle = PLAYER_SPRITE.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.8, radius, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Vest stripes across the shoulders.
  ctx.fillStyle = PLAYER_SPRITE.vest;
  ctx.fillRect(-radius * 0.35, -radius * 0.85, radius * 0.22, radius * 1.7);

  // Head.
  ctx.fillStyle = PLAYER_SPRITE.skin;
  ctx.beginPath();
  ctx.arc(radius * 0.1, 0, radius * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cap crown + brim towards facing.
  ctx.fillStyle = PLAYER_SPRITE.cap;
  ctx.beginPath();
  ctx.arc(radius * 0.05, 0, radius * 0.45, Math.PI * 0.5, Math.PI * 1.5);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(radius * 0.55, 0, radius * 0.25, radius * 0.4, 0, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.fill();

  ctx.restore();
}

/** Top-down zombie: arms stretched toward where it walks; solid white while flashing. */
export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  radius: number,
  look: Readonly<EnemyLook>,
  flash: boolean,
): void {
  const skin = flash ? ENEMY_SPRITE.flash : look.skin;
  const shirt = flash ? ENEMY_SPRITE.flash : look.shirt;

  ctx.fillStyle = ENEMY_SPRITE.shadow;
  ctx.beginPath();
  ctx.ellipse(x + 2, y + radius * 0.6, radius, radius * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = ENEMY_SPRITE.outline;

  // Arms reaching forward.
  ctx.fillStyle = skin;
  ctx.fillRect(radius * 0.1, -radius * 0.85, radius * 1.05, radius * 0.32);
  ctx.fillRect(radius * 0.1, radius * 0.53, radius * 1.05, radius * 0.32);

  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.75, radius, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(radius * 0.15, 0, radius * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (!flash) {
    ctx.fillStyle = ENEMY_SPRITE.eyes;
    ctx.fillRect(radius * 0.4, -radius * 0.25, radius * 0.16, radius * 0.16);
    ctx.fillRect(radius * 0.4, radius * 0.09, radius * 0.16, radius * 0.16);
  }

  ctx.restore();
}

/** Fading wedge showing a melee swing. `progress` goes 0 -> 1 over the fade time. */
export function drawSweep(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  halfArc: number,
  range: number,
  progress: number,
): void {
  const alpha = 1 - progress;
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = SWEEP.color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfArc, angle + halfArc);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = SWEEP.edgeColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, range, angle - halfArc, angle + halfArc);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Ring around a slowed or poisoned enemy. */
export function drawStatusTint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
  ctx.stroke();
}

/** Discount coupon: a small ticket with a notch, colored by value tier. */
export function drawCoupon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  value: number,
  time: number,
): void {
  const tiers = COUPON_STYLE.tiers;
  let tier = tiers[tiers.length - 1];
  for (const t of tiers) {
    if (value >= t.min) {
      tier = t;
      break;
    }
  }
  if (!tier) return;
  const w = COUPON_STYLE.width;
  const h = COUPON_STYLE.height;
  const by = y + Math.sin(time * COUPON_STYLE.bobSpeed + x * 0.05) * COUPON_STYLE.bob;
  ctx.fillStyle = tier.fill;
  ctx.strokeStyle = tier.stroke;
  ctx.lineWidth = 1.5;
  ctx.fillRect(x - w / 2, by - h / 2, w, h);
  ctx.strokeRect(x - w / 2, by - h / 2, w, h);
  // Perforation line.
  ctx.beginPath();
  ctx.moveTo(x + w * 0.15, by - h / 2);
  ctx.lineTo(x + w * 0.15, by + h / 2);
  ctx.stroke();
}

export function drawCan(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  spin: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = PROJECTILE_STYLE.canBody;
  ctx.strokeStyle = PROJECTILE_STYLE.canOutline;
  ctx.lineWidth = 1.5;
  ctx.fillRect(-r, -r * 0.8, r * 2, r * 1.6);
  ctx.fillStyle = PROJECTILE_STYLE.canBand;
  ctx.fillRect(-r, -r * 0.35, r * 2, r * 0.7);
  ctx.strokeRect(-r, -r * 0.8, r * 2, r * 1.6);
  ctx.restore();
}

export function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
): void {
  const l = PROJECTILE_STYLE.labelLength;
  const w = PROJECTILE_STYLE.labelWidth;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = PROJECTILE_STYLE.labelFill;
  ctx.strokeStyle = PROJECTILE_STYLE.labelStroke;
  ctx.lineWidth = 1;
  ctx.fillRect(-l / 2, -w / 2, l, w);
  ctx.strokeRect(-l / 2, -w / 2, l, w);
  ctx.restore();
}

export function drawIceBag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  angle: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = ICE_STYLE.fill;
  ctx.strokeStyle = ICE_STYLE.stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-r, -r * 0.85, r * 2, r * 1.7, r * 0.5);
  ctx.fill();
  ctx.stroke();
  // Knot of the bag.
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(r * 1.45, -r * 0.3);
  ctx.lineTo(r * 1.45, r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ICE_STYLE.shine;
  ctx.fillRect(-r * 0.55, -r * 0.5, r * 0.4, r * 0.3);
  ctx.restore();
}

/** Insecticide cloud: translucent wedge plus puffs that drift outwards. */
export function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  halfArc: number,
  range: number,
  time: number,
): void {
  ctx.fillStyle = CLOUD_STYLE.color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfArc, angle + halfArc);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = CLOUD_STYLE.edge;
  const n = CLOUD_STYLE.puffs;
  for (let i = 0; i < n; i++) {
    const t = (time * 1.5 + i / n) % 1;
    const a = angle + (((i * 37) % n) / (n - 1) - 0.5) * halfArc * 1.6;
    const d = range * (0.25 + t * 0.7);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 6 + t * 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawMicrowave(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lifeLeft: number,
  time: number,
): void {
  const s = MICROWAVE_STYLE;
  if (lifeLeft < s.blinkWhenLeft && Math.floor(time * 10) % 2 === 0) return;
  const w = s.width;
  const h = s.height;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.fillRect(x - w / 2 + 3, y - h / 2 + 4, w, h);
  ctx.fillStyle = s.body;
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 2;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = s.window;
  ctx.fillRect(x - w / 2 + 3, y - h / 2 + 3, w * 0.62, h - 6);
  ctx.fillStyle = s.glow;
  ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 8);
  ctx.fillRect(x - w / 2 + 5, y - h / 2 + 5, w * 0.62 - 4, h - 10);
  ctx.globalAlpha = 1;
}

export function drawBeam(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  alpha: number,
): void {
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.strokeStyle = MICROWAVE_STYLE.beamGlow;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = MICROWAVE_STYLE.beam;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.globalAlpha = 1;
}
