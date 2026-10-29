import type { TextKey } from './texts';

export type PassiveId = 'shoes' | 'coffee' | 'magnet' | 'vest' | 'soup' | 'calculator';

/**
 * Player stats a passive can change. `percent` stats add `perLevel` to a multiplier
 * that starts at 1; `flat` stats add `perLevel` to a value that starts at 0.
 */
export type StatId = 'moveSpeed' | 'cooldown' | 'pickupRadius' | 'armor' | 'regen' | 'damage';

export const STAT_KIND: Readonly<Record<StatId, 'percent' | 'flat'>> = {
  moveSpeed: 'percent',
  cooldown: 'percent',
  pickupRadius: 'percent',
  armor: 'flat',
  regen: 'flat',
  damage: 'percent',
};

export interface PassiveDef {
  id: PassiveId;
  icon: string;
  nameKey: TextKey;
  /** Effect of one level, shown both when new and when upgrading. */
  descKey: TextKey;
  stat: StatId;
  perLevel: number;
}

export const PASSIVE_IDS: readonly PassiveId[] = [
  'shoes',
  'coffee',
  'magnet',
  'vest',
  'soup',
  'calculator',
];

export const PASSIVES: Readonly<Record<PassiveId, Readonly<PassiveDef>>> = {
  shoes: {
    id: 'shoes',
    icon: '👟',
    nameKey: 'passiveShoes',
    descKey: 'passiveShoesDesc',
    stat: 'moveSpeed',
    perLevel: 0.08,
  },
  coffee: {
    id: 'coffee',
    icon: '☕',
    nameKey: 'passiveCoffee',
    descKey: 'passiveCoffeeDesc',
    stat: 'cooldown',
    perLevel: -0.08,
  },
  magnet: {
    id: 'magnet',
    icon: '🧲',
    nameKey: 'passiveMagnet',
    descKey: 'passiveMagnetDesc',
    stat: 'pickupRadius',
    perLevel: 0.2,
  },
  vest: {
    id: 'vest',
    icon: '🦺',
    nameKey: 'passiveVest',
    descKey: 'passiveVestDesc',
    stat: 'armor',
    perLevel: 1,
  },
  soup: {
    id: 'soup',
    icon: '🍲',
    nameKey: 'passiveSoup',
    descKey: 'passiveSoupDesc',
    stat: 'regen',
    perLevel: 0.5,
  },
  calculator: {
    id: 'calculator',
    icon: '🧮',
    nameKey: 'passiveCalculator',
    descKey: 'passiveCalculatorDesc',
    stat: 'damage',
    perLevel: 0.1,
  },
};
