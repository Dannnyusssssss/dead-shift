import { lerp, setVec, vec2, type Vec2 } from '../core/math';
import { PLAYER_BASE, type PlayerStats } from '../data/player';
import { PROGRESSION } from '../data/progression';
import {
  PASSIVES,
  STAT_KIND,
  type PassiveDef,
  type PassiveId,
  type StatId,
} from '../data/upgrades';
import type { WeaponId } from '../data/weapons';
import { createManualState, type ManualState } from './manual';
import type { WeaponInstance } from './weapons';

export interface PassiveInstance {
  def: Readonly<PassiveDef>;
  /** 1-based. */
  level: number;
}

/** Totals from passives, applied by weapons, damage and status systems. */
export interface PlayerModifiers {
  /** Multiplies every weapon cooldown. */
  cooldown: number;
  /** Multiplies every weapon's damage. */
  damage: number;
  /** Subtracted from each hit taken (min 1 damage). */
  armor: number;
  /** hp per second. */
  regen: number;
}

export interface Player {
  pos: Vec2;
  /** Position at the previous fixed step, for render interpolation. */
  prevPos: Vec2;
  /** Unit vector the character faces: the aim, or the last movement direction without one. */
  facing: Vec2;
  hp: number;
  maxHp: number;
  /** Base stats before passives. */
  base: Readonly<PlayerStats>;
  /** Derived from `base` and passives by `recomputeStats`. */
  speed: number;
  radius: number;
  pickupRadius: number;
  mods: PlayerModifiers;
  /** Invulnerability granted per hit, s. */
  invulnTime: number;
  /** Remaining invulnerability, s. */
  invulnTimer: number;
  level: number;
  /** XP accumulated toward the next level. */
  xp: number;
  /** Levels gained whose upgrade has not been chosen yet. */
  pendingLevelUps: number;
  /** Boss chests picked up but not opened yet. */
  pendingChests: number;
  /** Fraction of speed removed while `slowTimer` > 0 (puddles). */
  slowFactor: number;
  slowTimer: number;
  /** Automatic weapons (the slots filled by level-ups). */
  weapons: WeaponInstance[];
  /** The always-owned manual gun and melee weapon. */
  manual: ManualState;
  passives: PassiveInstance[];
  /** Debug only: hits land but never reduce hp. */
  invincible: boolean;
}

export function createPlayer(stats: Readonly<PlayerStats> = PLAYER_BASE): Player {
  const player: Player = {
    pos: vec2(0, 0),
    prevPos: vec2(0, 0),
    facing: vec2(1, 0),
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    base: stats,
    speed: stats.speed,
    radius: stats.radius,
    pickupRadius: stats.pickupRadius,
    mods: { cooldown: 1, damage: 1, armor: 0, regen: 0 },
    invulnTime: stats.invulnTime,
    invulnTimer: 0,
    level: 1,
    xp: 0,
    pendingLevelUps: 0,
    pendingChests: 0,
    slowFactor: 0,
    slowTimer: 0,
    weapons: [],
    manual: createManualState(),
    passives: [],
    invincible: false,
  };
  recomputeStats(player);
  return player;
}

const statTotals: Record<StatId, number> = {
  moveSpeed: 0,
  cooldown: 0,
  pickupRadius: 0,
  armor: 0,
  regen: 0,
  damage: 0,
};

/** Rebuilds derived stats from base stats and passives. Call after the loadout changes. */
export function recomputeStats(player: Player): void {
  for (const stat of Object.keys(statTotals) as StatId[]) {
    statTotals[stat] = STAT_KIND[stat] === 'percent' ? 1 : 0;
  }
  for (const p of player.passives) statTotals[p.def.stat] += p.def.perLevel * p.level;

  player.speed = player.base.speed * statTotals.moveSpeed;
  player.pickupRadius = player.base.pickupRadius * statTotals.pickupRadius;
  player.mods.cooldown = Math.max(PROGRESSION.minCooldownMultiplier, statTotals.cooldown);
  player.mods.damage = statTotals.damage;
  player.mods.armor = statTotals.armor;
  player.mods.regen = statTotals.regen;
}

/** A weapon the player owns, manual or automatic. */
export function findOwnedWeapon(
  player: Readonly<Player>,
  id: WeaponId,
): WeaponInstance | undefined {
  const m = player.manual;
  if (m.gun.def.id === id) return m.gun;
  if (m.melee.def.id === id) return m.melee;
  return player.weapons.find((w) => w.def.id === id);
}

export function findPassive(player: Player, id: PassiveId): PassiveInstance | undefined {
  return player.passives.find((p) => p.def.id === id);
}

export function addPassive(player: Player, id: PassiveId): PassiveInstance {
  const instance: PassiveInstance = { def: PASSIVES[id], level: 1 };
  player.passives.push(instance);
  recomputeStats(player);
  return instance;
}

export function interpolatedPlayerPos(player: Player, alpha: number, out: Vec2): Vec2 {
  return setVec(
    out,
    lerp(player.prevPos.x, player.pos.x, alpha),
    lerp(player.prevPos.y, player.pos.y, alpha),
  );
}
