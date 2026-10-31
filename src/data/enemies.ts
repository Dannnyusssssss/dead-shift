export type EnemyId = 'client' | 'delivery' | 'frozen' | 'cart' | 'cashier' | 'manager' | 'guard';

export type EnemyAccessory = 'none' | 'cap' | 'frost' | 'cart' | 'apron' | 'tie' | 'helmet';

export interface EnemyLook {
  shirt: string;
  skin: string;
  /** Color of the death splat. */
  blood: string;
  accessory: EnemyAccessory;
}

/** Walks straight at the player. */
export interface ChaseBehavior {
  kind: 'chase';
}

/** Chases while weaving sideways. */
export interface ZigzagBehavior {
  kind: 'zigzag';
  /** Strength of the sideways weave relative to forward speed. */
  weave: number;
  /** Weave oscillations per second. */
  frequency: number;
}

/** Approaches, stops to aim (telegraphed), then rams in a straight line. */
export interface ChargeBehavior {
  kind: 'charge';
  /** Starts the wind-up when the player is this close, px. */
  triggerRange: number;
  /** Standing still, aiming, s. */
  windup: number;
  chargeSpeed: number;
  chargeTime: number;
  /** Slow chase after a charge before it can charge again, s. */
  recover: number;
}

/** Keeps its distance and lobs exploding receipts at the player's position. */
export interface RangedBehavior {
  kind: 'ranged';
  preferredDistance: number;
  /** Tolerance around the preferred distance where it strafes instead, px. */
  band: number;
  fireInterval: number;
  projectileSpeed: number;
  explosionRadius: number;
  /** Explosion damage before scaling. */
  explosionDamage: number;
}

/** Boss: chases, summons minions and releases shockwaves. */
export interface BossBehavior {
  kind: 'boss';
  summonInterval: number;
  summonCount: number;
  summonId: EnemyId;
  /** Distance from the boss where minions appear, px. */
  summonRadius: number;
  shockwaveInterval: number;
  /** Warning before the ring starts expanding, s. */
  shockwaveWindup: number;
  shockwaveRadius: number;
  /** Seconds the ring takes to reach full radius. */
  shockwaveDuration: number;
  shockwaveDamage: number;
}

export type EnemyBehavior =
  ChaseBehavior | ZigzagBehavior | ChargeBehavior | RangedBehavior | BossBehavior;

export type EnemyBehaviorKind = EnemyBehavior['kind'];

/** Leaves slowing puddles behind while it walks. */
export interface TrailSpec {
  interval: number;
  radius: number;
  duration: number;
  /** Fraction of the player's speed removed while standing in one. */
  slowFactor: number;
}

export interface EnemyDef {
  id: EnemyId;
  hp: number;
  /** px/s */
  speed: number;
  /** Damage per contact hit. */
  damage: number;
  /** Collision radius in px. */
  radius: number;
  /** Value of the coupon dropped on death (1, 5 or 20). */
  xp: number;
  /** 0 = full knockback, 1 = immune. */
  knockbackResist: number;
  /** Armor: multiplier on damage (hits, poison, burn) from automatic weapons. Default 1. */
  autoDamageTaken?: number;
  /** Plows through the horde: other zombies never push it, it pushes them. */
  plowsThrough?: boolean;
  behavior: EnemyBehavior;
  trail?: TrailSpec;
  /** Drops the boss chest on death. */
  dropsChest?: boolean;
  look: EnemyLook;
}

export const ENEMIES: Readonly<Record<EnemyId, Readonly<EnemyDef>>> = {
  client: {
    id: 'client',
    hp: 20,
    speed: 55,
    damage: 6,
    radius: 12,
    xp: 1,
    knockbackResist: 0,
    behavior: { kind: 'chase' },
    look: { shirt: '#8a5a9e', skin: '#8fbf6a', blood: '#4f9a2f', accessory: 'none' },
  },
  delivery: {
    id: 'delivery',
    hp: 12,
    speed: 130,
    damage: 4,
    radius: 10,
    xp: 1,
    knockbackResist: 0,
    behavior: { kind: 'zigzag', weave: 1.2, frequency: 1.1 },
    look: { shirt: '#e8a020', skin: '#9cc46e', blood: '#5aa032', accessory: 'cap' },
  },
  frozen: {
    id: 'frozen',
    hp: 90,
    speed: 35,
    damage: 12,
    radius: 16,
    xp: 5,
    knockbackResist: 0.6,
    behavior: { kind: 'chase' },
    trail: { interval: 0.8, radius: 28, duration: 4, slowFactor: 0.4 },
    look: { shirt: '#3d6f9e', skin: '#a9d8e6', blood: '#5fb6d6', accessory: 'frost' },
  },
  cart: {
    id: 'cart',
    hp: 45,
    speed: 50,
    damage: 15,
    radius: 15,
    xp: 5,
    knockbackResist: 0.3,
    behavior: {
      kind: 'charge',
      triggerRange: 260,
      windup: 0.6,
      chargeSpeed: 380,
      chargeTime: 0.8,
      recover: 1,
    },
    look: { shirt: '#c0392b', skin: '#8fbf6a', blood: '#4f9a2f', accessory: 'cart' },
  },
  cashier: {
    id: 'cashier',
    hp: 30,
    speed: 45,
    damage: 8,
    radius: 12,
    xp: 5,
    knockbackResist: 0,
    behavior: {
      kind: 'ranged',
      preferredDistance: 260,
      band: 50,
      fireInterval: 2.5,
      projectileSpeed: 260,
      explosionRadius: 45,
      explosionDamage: 8,
    },
    look: { shirt: '#2e8b57', skin: '#8fbf6a', blood: '#4f9a2f', accessory: 'apron' },
  },
  manager: {
    id: 'manager',
    hp: 1500,
    speed: 60,
    damage: 20,
    radius: 30,
    xp: 20,
    knockbackResist: 0.9,
    dropsChest: true,
    behavior: {
      kind: 'boss',
      summonInterval: 10,
      summonCount: 6,
      summonId: 'client',
      summonRadius: 70,
      shockwaveInterval: 6,
      shockwaveWindup: 0.5,
      shockwaveRadius: 220,
      shockwaveDuration: 0.6,
      shockwaveDamage: 15,
    },
    look: { shirt: '#2b2f3a', skin: '#7fae5c', blood: '#3f8a24', accessory: 'tie' },
  },
  guard: {
    id: 'guard',
    hp: 140,
    speed: 50,
    damage: 14,
    radius: 17,
    xp: 5,
    knockbackResist: 1,
    autoDamageTaken: 0.3,
    plowsThrough: true,
    behavior: { kind: 'chase' },
    look: { shirt: '#2b3a55', skin: '#86b062', blood: '#4f9a2f', accessory: 'helmet' },
  },
};
