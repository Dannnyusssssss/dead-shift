import type { Vec2 } from '../core/math';
import { hash2 } from '../core/rng';
import type { EnemyLook } from '../data/enemies';
import type { WeaponId } from '../data/weapons';
import { BLOCK_H, BLOCK_W, createRect, shelfInBlock, type Rect } from '../game/shelves';
import {
  ACCESSORY_STYLE,
  AMMO_BOX_STYLE,
  SHELL_BOX_STYLE,
  FLOOR_MAGNET_STYLE,
  MEDKIT_STYLE,
  CHEST_STYLE,
  COUPON_STYLE,
  CLOUD_STYLE,
  CROSSHAIR,
  ENEMY_SPRITE,
  FAINT,
  FLOOR,
  HAZARD_STYLE,
  HELD_STYLE,
  ICE_STYLE,
  MICROWAVE_STYLE,
  PLAYER_SPRITE,
  PROJECTILE_STYLE,
  SHELVES,
  SWEEP,
  TELEGRAPH,
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

const shelf = createRect();

/** Draws the solid shelves in view, from the same layout function the collision uses. */
function drawShelves(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  w: number,
  h: number,
  seed: number,
): void {
  const bx0 = Math.floor(left / BLOCK_W);
  const by0 = Math.floor(top / BLOCK_H);
  const bx1 = Math.floor((left + w) / BLOCK_W);
  const by1 = Math.floor((top + h) / BLOCK_H);
  for (let by = by0; by <= by1; by++) {
    for (let bx = bx0; bx <= bx1; bx++) {
      if (!shelfInBlock(bx, by, seed, shelf)) continue;
      const r = shelf;
      if (r.x > left + w || r.x + r.w < left || r.y > top + h || r.y + r.h < top) continue;
      drawShelf(ctx, r, bx, by, seed);
    }
  }
}

/**
 * One shelf drawn exactly on its collision footprint: a cast shadow and a dark front face give
 * it height, so it reads as solid instead of floor decoration.
 */
function drawShelf(
  ctx: CanvasRenderingContext2D,
  r: Readonly<Rect>,
  bx: number,
  by: number,
  seed: number,
): void {
  const s = SHELVES;
  const { x, y, w: len } = r;
  const front = s.frontHeight;
  const depth = r.h - front;
  const inset = s.productInset;
  const half = depth / 2;

  ctx.fillStyle = s.shadowColor;
  ctx.fillRect(x + s.shadowOffsetX, y + s.shadowOffsetY, len, r.h);
  ctx.fillStyle = s.frontColor;
  ctx.fillRect(x, y + depth, len, front);
  ctx.fillStyle = s.frameColor;
  ctx.fillRect(x, y, len, depth);
  ctx.fillStyle = s.topColor;
  ctx.fillRect(x + 2, y + 2, len - 4, depth - 4);

  const slots = Math.round(len / FLOOR.tileSize) * s.productsPerTile;
  const slotW = len / slots;
  const colors = s.productColors;
  for (let side = 0; side < 2; side++) {
    const py = side === 0 ? y + inset : y + half + 1;
    const ph = half - inset - 1;
    for (let i = 0; i < slots; i++) {
      const c = Math.floor(hash2(bx * 97 + i, by * 31 + side, seed + 4) * colors.length);
      ctx.fillStyle = colors[c] ?? s.topColor;
      ctx.fillRect(x + i * slotW + 2, py, slotW - 3, ph);
    }
  }

  ctx.fillStyle = s.dividerColor;
  ctx.fillRect(x, y + half - 1, len, 2);
  ctx.fillStyle = s.rimColor;
  ctx.fillRect(x, y, len, 2);
}

/** Top-down "Mati": body, reflective vest, head and a cap whose brim points where he faces. */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: Vec2,
  radius: number,
  held: WeaponId = 'labelGun',
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

  // What he holds, in the right hand, pointing where he faces.
  if (held === 'labelGun') {
    ctx.fillStyle = HELD_STYLE.gun;
    ctx.fillRect(radius * 0.35, radius * 0.45, radius * 0.95, radius * 0.3);
    ctx.fillStyle = HELD_STYLE.gunTip;
    ctx.fillRect(radius * 1.2, radius * 0.45, radius * 0.15, radius * 0.3);
  } else if (held === 'shotgun') {
    // Wooden stock and a long, thick barrel held with both hands.
    ctx.fillStyle = HELD_STYLE.shotgunStock;
    ctx.fillRect(-radius * 0.1, radius * 0.3, radius * 0.7, radius * 0.42);
    ctx.fillStyle = HELD_STYLE.shotgunBarrel;
    ctx.fillRect(radius * 0.55, radius * 0.34, radius * 1.25, radius * 0.34);
  } else {
    ctx.fillStyle = HELD_STYLE.broomStick;
    ctx.fillRect(-radius * 0.2, radius * 0.5, radius * 1.7, radius * 0.16);
    ctx.fillStyle = HELD_STYLE.broomHead;
    ctx.fillRect(radius * 1.45, radius * 0.25, radius * 0.35, radius * 0.66);
  }

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

// Reused line-dash patterns (setLineDash copies them, so sharing is safe).
const DASH_TELEGRAPH = [10, 8];
const DASH_TARGET = [6, 6];
const NO_DASH: number[] = [];

/** Job-specific details drawn in the enemy's local frame (facing +x). */
function drawAccessory(ctx: CanvasRenderingContext2D, r: number, look: Readonly<EnemyLook>): void {
  const a = ACCESSORY_STYLE;
  switch (look.accessory) {
    case 'cap':
      ctx.fillStyle = a.cap;
      ctx.beginPath();
      ctx.arc(r * 0.1, 0, r * 0.48, Math.PI * 0.5, Math.PI * 1.5);
      ctx.fill();
      ctx.fillRect(r * 0.1, -r * 0.3, r * 0.55, r * 0.6);
      break;
    case 'frost':
      ctx.fillStyle = a.frost;
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + 0.4;
        ctx.fillRect(Math.cos(ang) * r * 0.55 - 1.5, Math.sin(ang) * r * 0.8 - 1.5, 3, 3);
      }
      break;
    case 'cart':
      // Shopping cart pushed in front.
      ctx.fillStyle = a.cartBasket;
      ctx.strokeStyle = a.cartFrame;
      ctx.lineWidth = 2;
      ctx.fillRect(r * 1.15, -r * 0.9, r * 1.3, r * 1.8);
      ctx.strokeRect(r * 1.15, -r * 0.9, r * 1.3, r * 1.8);
      ctx.beginPath();
      for (let i = 1; i < 3; i++) {
        ctx.moveTo(r * 1.15 + (i * r * 1.3) / 3, -r * 0.9);
        ctx.lineTo(r * 1.15 + (i * r * 1.3) / 3, r * 0.9);
      }
      ctx.stroke();
      break;
    case 'apron':
      ctx.fillStyle = a.apron;
      ctx.fillRect(-r * 0.25, -r * 0.55, r * 0.5, r * 1.1);
      ctx.fillStyle = a.visor;
      ctx.fillRect(r * 0.35, -r * 0.42, r * 0.28, r * 0.84);
      break;
    case 'tie':
      ctx.fillStyle = a.tie;
      ctx.beginPath();
      ctx.moveTo(r * 0.6, 0);
      ctx.lineTo(r * 0.2, -r * 0.12);
      ctx.lineTo(-r * 0.5, 0);
      ctx.lineTo(r * 0.2, r * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = a.badge;
      ctx.fillRect(-r * 0.2, -r * 0.62, r * 0.22, r * 0.16);
      break;
    case 'none':
      break;
  }
}

/**
 * Top-down zombie: arms stretched toward where it walks; solid white while flashing.
 * `faint` (0..1) tips it over and fades it at dawn.
 */
export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  radius: number,
  look: Readonly<EnemyLook>,
  flash: boolean,
  faint = 0,
): void {
  const skin = flash ? ENEMY_SPRITE.flash : look.skin;
  const shirt = flash ? ENEMY_SPRITE.flash : look.shirt;

  ctx.fillStyle = ENEMY_SPRITE.shadow;
  ctx.beginPath();
  ctx.ellipse(x + 2, y + radius * 0.6, radius, radius * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  if (faint > 0) {
    ctx.globalAlpha = 1 - (1 - FAINT.minAlpha) * faint;
    ctx.rotate(angle + FAINT.tilt * faint);
    ctx.scale(1, 1 - 0.45 * faint);
  } else {
    ctx.rotate(angle);
  }
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
    drawAccessory(ctx, radius, look);
    ctx.fillStyle = ENEMY_SPRITE.eyes;
    ctx.fillRect(radius * 0.4, -radius * 0.25, radius * 0.16, radius * 0.16);
    ctx.fillRect(radius * 0.4, radius * 0.09, radius * 0.16, radius * 0.16);
  }

  ctx.restore();
}

/** Red line showing where a cart is about to charge. */
export function drawTelegraph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  length: number,
  progress: number,
): void {
  ctx.strokeStyle = TELEGRAPH.color;
  ctx.lineWidth = TELEGRAPH.width;
  ctx.setLineDash(DASH_TELEGRAPH);
  ctx.globalAlpha = 0.5 + 0.5 * progress;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dirX * length, y + dirY * length);
  ctx.stroke();
  ctx.setLineDash(NO_DASH);
  ctx.globalAlpha = 1;
}

export function drawPuddle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  lifeLeft: number,
): void {
  ctx.globalAlpha = Math.min(1, lifeLeft / 0.8);
  ctx.fillStyle = HAZARD_STYLE.puddleFill;
  ctx.strokeStyle = HAZARD_STYLE.puddleEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Flying receipt plus the red circle where it will explode. */
export function drawReceipt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  targetX: number,
  targetY: number,
  explosionRadius: number,
  age: number,
): void {
  ctx.strokeStyle = HAZARD_STYLE.targetColor;
  ctx.lineWidth = 2;
  ctx.setLineDash(DASH_TARGET);
  ctx.beginPath();
  ctx.arc(targetX, targetY, explosionRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash(NO_DASH);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(age * HAZARD_STYLE.receiptSpin);
  ctx.fillStyle = HAZARD_STYLE.receiptFill;
  ctx.fillRect(-5, -8, 10, 16);
  ctx.fillStyle = HAZARD_STYLE.receiptLine;
  for (let i = 0; i < 4; i++) ctx.fillRect(-3, -5 + i * 3.5, 6, 1);
  ctx.restore();
}

/** Boss shockwave: pulsing warning disc, then an expanding ring. */
export function drawShockwave(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ringRadius: number,
  maxRadius: number,
  warning: boolean,
  time: number,
): void {
  if (warning) {
    ctx.fillStyle = HAZARD_STYLE.shockWarn;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 30);
    ctx.beginPath();
    ctx.arc(x, y, maxRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  ctx.strokeStyle = HAZARD_STYLE.shockRing;
  ctx.lineWidth = 10;
  ctx.globalAlpha = 1 - ringRadius / maxRadius / 2;
  ctx.beginPath();
  ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawChest(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const s = CHEST_STYLE;
  const by = y + Math.sin(time * 4) * 2;
  ctx.fillStyle = s.glow;
  ctx.beginPath();
  ctx.arc(x, by, s.width * (0.95 + 0.1 * Math.sin(time * 6)), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = s.body;
  ctx.fillRect(x - s.width / 2, by - s.height / 2 + 6, s.width, s.height - 6);
  ctx.fillStyle = s.lid;
  ctx.fillRect(x - s.width / 2, by - s.height / 2, s.width, 8);
  ctx.fillStyle = s.trim;
  ctx.fillRect(x - s.width / 2, by - s.height / 2 + 7, s.width, 2);
  ctx.fillRect(x - 3, by - 2, 6, 7);
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

/** Shotgun pellet: a small round shot. */
export function drawPellet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = PROJECTILE_STYLE.pelletFill;
  ctx.strokeStyle = PROJECTILE_STYLE.pelletStroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Red box of shotgun shells, bobbing like the ammo boxes. */
export function drawShellBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
): void {
  const s = SHELL_BOX_STYLE;
  const by = y + Math.sin(time * 5 + x * 0.05) * 1.5;
  ctx.fillStyle = s.body;
  ctx.strokeStyle = s.edge;
  ctx.lineWidth = 2;
  ctx.fillRect(x - s.width / 2, by - s.height / 2, s.width, s.height);
  ctx.strokeRect(x - s.width / 2, by - s.height / 2, s.width, s.height);
  ctx.fillStyle = s.shell;
  ctx.fillRect(x - 5, by - 3, 3, 6);
  ctx.fillRect(x + 1, by - 3, 3, 6);
}

/** Small green crate with a bullet mark. */
export function drawAmmoBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
): void {
  const s = AMMO_BOX_STYLE;
  const by = y + Math.sin(time * 5 + x * 0.05) * 1.5;
  ctx.fillStyle = s.body;
  ctx.strokeStyle = s.edge;
  ctx.lineWidth = 2;
  ctx.fillRect(x - s.width / 2, by - s.height / 2, s.width, s.height);
  ctx.strokeRect(x - s.width / 2, by - s.height / 2, s.width, s.height);
  ctx.fillStyle = s.bullet;
  ctx.fillRect(x - 5, by - 2, 8, 4);
  ctx.beginPath();
  ctx.arc(x + 3, by, 2, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
}

/** White first-aid box with a red cross, bobbing like the ammo boxes. */
export function drawMedkit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
): void {
  const s = MEDKIT_STYLE;
  const by = y + Math.sin(time * 5 + x * 0.05) * 1.5;
  const h = s.size / 2;
  ctx.fillStyle = s.body;
  ctx.strokeStyle = s.edge;
  ctx.lineWidth = 2;
  ctx.fillRect(x - h, by - h, s.size, s.size);
  ctx.strokeRect(x - h, by - h, s.size, s.size);
  ctx.fillStyle = s.cross;
  const len = s.size - 6;
  ctx.fillRect(x - s.arm / 2, by - len / 2, s.arm, len);
  ctx.fillRect(x - len / 2, by - s.arm / 2, len, s.arm);
}

/** Horseshoe magnet with a pulsing halo so the rare drop stands out. */
export function drawFloorMagnet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
): void {
  const s = FLOOR_MAGNET_STYLE;
  const pulse = 0.5 + 0.5 * Math.sin(time * 6);
  ctx.fillStyle = s.halo;
  ctx.beginPath();
  ctx.arc(x, y, s.radius + 4 + pulse * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = s.thickness;
  ctx.strokeStyle = s.body;
  ctx.beginPath();
  ctx.arc(x, y, s.radius, Math.PI, 0, true);
  ctx.stroke();
  ctx.strokeStyle = s.tips;
  ctx.beginPath();
  ctx.moveTo(x - s.radius, y);
  ctx.lineTo(x - s.radius, y - 4);
  ctx.moveTo(x + s.radius, y);
  ctx.lineTo(x + s.radius, y - 4);
  ctx.stroke();
}

/** Screen-space crosshair at the mouse position. */
export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  firing: boolean,
): void {
  const r = CROSSHAIR.radius;
  const g = CROSSHAIR.gap;
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass === 0 ? CROSSHAIR.shadow : firing ? CROSSHAIR.firing : CROSSHAIR.color;
    ctx.lineWidth = pass === 0 ? 4 : 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.moveTo(x - r - g, y);
    ctx.lineTo(x - g, y);
    ctx.moveTo(x + g, y);
    ctx.lineTo(x + r + g, y);
    ctx.moveTo(x, y - r - g);
    ctx.lineTo(x, y - g);
    ctx.moveTo(x, y + g);
    ctx.lineTo(x, y + r + g);
    ctx.stroke();
  }
}
