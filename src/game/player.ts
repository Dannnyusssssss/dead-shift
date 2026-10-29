import { lerp, setVec, vec2, type Vec2 } from '../core/math';
import { PLAYER_BASE, type PlayerStats } from '../data/player';
import { STARTING_WEAPON } from '../data/weapons';
import { createWeapon, type WeaponInstance } from './weapons';

export interface Player {
  pos: Vec2;
  /** Position at the previous fixed step, for render interpolation. */
  prevPos: Vec2;
  /** Unit vector of the last movement direction. */
  facing: Vec2;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  pickupRadius: number;
  /** Invulnerability granted per hit, s. */
  invulnTime: number;
  /** Remaining invulnerability, s. */
  invulnTimer: number;
  weapons: WeaponInstance[];
  /** Debug only: hits land but never reduce hp. */
  invincible: boolean;
}

export function createPlayer(stats: Readonly<PlayerStats> = PLAYER_BASE): Player {
  return {
    pos: vec2(0, 0),
    prevPos: vec2(0, 0),
    facing: vec2(1, 0),
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    speed: stats.speed,
    radius: stats.radius,
    pickupRadius: stats.pickupRadius,
    invulnTime: stats.invulnTime,
    invulnTimer: 0,
    weapons: [createWeapon(STARTING_WEAPON)],
    invincible: false,
  };
}

export function interpolatedPlayerPos(player: Player, alpha: number, out: Vec2): Vec2 {
  return setVec(
    out,
    lerp(player.prevPos.x, player.pos.x, alpha),
    lerp(player.prevPos.y, player.pos.y, alpha),
  );
}
