export type EnemyId = 'client';
export type EnemyBehaviorId = 'chase';

export interface EnemyLook {
  shirt: string;
  skin: string;
  /** Color of the death splat. */
  blood: string;
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
  behavior: EnemyBehaviorId;
  look: EnemyLook;
}

export const ENEMIES: Readonly<Record<EnemyId, Readonly<EnemyDef>>> = {
  client: {
    id: 'client',
    hp: 20,
    speed: 55,
    damage: 6,
    radius: 12,
    behavior: 'chase',
    look: { shirt: '#8a5a9e', skin: '#8fbf6a', blood: '#4f9a2f' },
  },
};
