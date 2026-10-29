import { createPool } from '../core/pool';
import { createRng } from '../core/rng';
import { PARTICLES } from '../data/render';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface BurstSpec {
  count: number;
  speedMin: number;
  speedMax: number;
  lifeMin: number;
  lifeMax: number;
  sizeMin: number;
  sizeMax: number;
}

/** Cosmetic particles. Render-side state only; never affects gameplay. */
export interface Particles {
  burst(x: number, y: number, color: string, spec: Readonly<BurstSpec>): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  clear(): void;
}

export function createParticles(capacity: number = PARTICLES.capacity): Particles {
  const pool = createPool<Particle>(capacity, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 1,
    color: '',
  }));
  // Separate stream from gameplay so effects never change the simulation.
  const rng = createRng(0x9e3779b9);

  return {
    burst(x, y, color, spec) {
      for (let i = 0; i < spec.count; i++) {
        const p = pool.acquire();
        if (!p) return;
        const angle = rng.range(0, Math.PI * 2);
        const speed = rng.range(spec.speedMin, spec.speedMax);
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = p.maxLife = rng.range(spec.lifeMin, spec.lifeMax);
        p.size = rng.range(spec.sizeMin, spec.sizeMax);
        p.color = color;
      }
    },
    update(dt) {
      const drag = Math.exp(-PARTICLES.drag * dt);
      for (let i = pool.count - 1; i >= 0; i--) {
        const p = pool.items[i] as Particle;
        p.life -= dt;
        if (p.life <= 0) {
          pool.releaseAt(i);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= drag;
        p.vy *= drag;
      }
    },
    draw(ctx) {
      for (let i = 0; i < pool.count; i++) {
        const p = pool.items[i] as Particle;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    },
    clear() {
      pool.clear();
    },
  };
}
