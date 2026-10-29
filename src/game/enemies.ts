import { setVec, vec2, type Vec2 } from '../core/math';
import { COMBAT } from '../data/combat';
import { ENEMIES, type EnemyBehaviorId, type EnemyDef } from '../data/enemies';
import type { World } from './world';

export interface Enemy {
  def: Readonly<EnemyDef>;
  pos: Vec2;
  prevPos: Vec2;
  /** Velocity chosen by the behavior, px/s. */
  vel: Vec2;
  /** Knockback velocity, decays over time, px/s. */
  knockback: Vec2;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  /** Remaining white-flash time after being hit, s. */
  hitTimer: number;
}

/** Largest enemy radius; pads spatial queries so big enemies are not missed. */
export const MAX_ENEMY_RADIUS = Math.max(...Object.values(ENEMIES).map((d) => d.radius));

export function createEnemyObject(): Enemy {
  return {
    def: ENEMIES.client,
    pos: vec2(),
    prevPos: vec2(),
    vel: vec2(),
    knockback: vec2(),
    hp: 0,
    maxHp: 0,
    speed: 0,
    damage: 0,
    radius: 0,
    hitTimer: 0,
  };
}

/** Takes an enemy from the pool and initializes it. Returns undefined at the cap. */
export function spawnEnemy(
  world: World,
  def: Readonly<EnemyDef>,
  x: number,
  y: number,
): Enemy | undefined {
  if (world.enemies.count >= COMBAT.maxEnemies) return undefined;
  const e = world.enemies.acquire();
  if (!e) return undefined;
  e.def = def;
  setVec(e.pos, x, y);
  setVec(e.prevPos, x, y);
  setVec(e.vel, 0, 0);
  setVec(e.knockback, 0, 0);
  e.hp = e.maxHp = def.hp;
  e.speed = def.speed;
  e.damage = def.damage;
  e.radius = def.radius;
  e.hitTimer = 0;
  return e;
}

type EnemyBehavior = (enemy: Enemy, world: World, dt: number) => void;

function chase(enemy: Enemy, world: World): void {
  const dx = world.player.pos.x - enemy.pos.x;
  const dy = world.player.pos.y - enemy.pos.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-6) {
    setVec(enemy.vel, 0, 0);
    return;
  }
  setVec(enemy.vel, (dx / d) * enemy.speed, (dy / d) * enemy.speed);
}

const BEHAVIORS: Readonly<Record<EnemyBehaviorId, EnemyBehavior>> = { chase };

export function enemyBehaviorSystem(world: World, dt: number): void {
  const { items, count } = world.enemies;
  for (let i = 0; i < count; i++) {
    const e = items[i] as Enemy;
    BEHAVIORS[e.def.behavior](e, world, dt);
  }
}

export function enemyMovementSystem(world: World, dt: number): void {
  const { items, count } = world.enemies;
  const decay = Math.exp(-COMBAT.knockbackDecay * dt);
  for (let i = 0; i < count; i++) {
    const e = items[i] as Enemy;
    e.prevPos.x = e.pos.x;
    e.prevPos.y = e.pos.y;
    e.pos.x += (e.vel.x + e.knockback.x) * dt;
    e.pos.y += (e.vel.y + e.knockback.y) * dt;
    e.knockback.x *= decay;
    e.knockback.y *= decay;
  }
}
