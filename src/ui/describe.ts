import { PROGRESSION } from '../data/progression';
import { PASSIVES } from '../data/upgrades';
import { WEAPONS, type WeaponDef } from '../data/weapons';
import { t, type TextKey } from '../data/texts';
import { findOwnedWeapon, type Player } from '../game/player';
import type { Offer } from '../game/progression';

export interface OfferView {
  icon: string;
  name: string;
  /** "Nuevo" or "Nv 2 → 3". */
  tag: string;
  description: string;
}

/** Level fields worth showing, with the text that follows the number. */
const STAT_LABELS: Readonly<Record<string, TextKey>> = {
  damage: 'statDamage',
  cooldown: 'statCooldown',
  arcDegrees: 'statArc',
  range: 'statRange',
  bothSides: 'statBothSides',
  count: 'statCount',
  pierce: 'statPierce',
  spreadDegrees: 'statSpread',
  bags: 'statBags',
  orbitRadius: 'statOrbitRadius',
  angularSpeed: 'statAngularSpeed',
  activeTime: 'statActiveTime',
  poisonDps: 'statPoison',
  rays: 'statRays',
  duration: 'statDuration',
  units: 'statUnits',
  magazine: 'statMagazine',
  reloadTime: 'statReload',
};

/** Units glued to the number instead of separated by a space. */
const GLUED: ReadonlySet<string> = new Set([
  'cooldown',
  'arcDegrees',
  'spreadDegrees',
  'activeTime',
  'duration',
  'reloadTime',
]);

function formatDelta(delta: number): string {
  const n = parseFloat(delta.toFixed(2));
  return n > 0 ? `+${n}` : String(n);
}

/** "+4 daño · +30° arco": what changes going from `fromLevel` to the next level. */
export function describeWeaponUpgrade(def: Readonly<WeaponDef>, fromLevel: number): string {
  const levels: readonly object[] = def.levels;
  const prev = levels[fromLevel - 1] as Record<string, unknown> | undefined;
  const next = levels[fromLevel] as Record<string, unknown> | undefined;
  if (!prev || !next) return '';
  const parts: string[] = [];
  for (const [field, key] of Object.entries(STAT_LABELS)) {
    const a = prev[field];
    const b = next[field];
    if (a === b) continue;
    if (typeof b === 'boolean') {
      if (b) parts.push(t(key));
    } else if (typeof a === 'number' && typeof b === 'number') {
      const sep = GLUED.has(field) ? '' : ' ';
      parts.push(`${formatDelta(b - a)}${sep}${t(key)}`);
    }
  }
  return parts.join(' · ');
}

const levelTag = (from: number): string => t('tagLevel', { from, to: from + 1 });

export function describeOffer(offer: Readonly<Offer>, player: Readonly<Player>): OfferView {
  switch (offer.kind) {
    case 'newWeapon': {
      const def = WEAPONS[offer.weaponId];
      return {
        icon: def.icon,
        name: t(def.nameKey),
        tag: t('tagNew'),
        description: t(def.descKey),
      };
    }
    case 'upgradeWeapon': {
      const def = WEAPONS[offer.weaponId];
      const level = findOwnedWeapon(player, def.id)?.level ?? 1;
      return {
        icon: def.icon,
        name: t(def.nameKey),
        tag: levelTag(level),
        description: describeWeaponUpgrade(def, level),
      };
    }
    case 'newPassive':
    case 'upgradePassive': {
      const def = PASSIVES[offer.passiveId];
      const owned = player.passives.find((p) => p.def.id === def.id);
      return {
        icon: def.icon,
        name: t(def.nameKey),
        tag: owned ? levelTag(owned.level) : t('tagNew'),
        description: t(def.descKey),
      };
    }
    case 'heal':
      return {
        icon: '🥪',
        name: t('healName'),
        tag: '',
        description: t('healDesc', { pct: Math.round(PROGRESSION.healFraction * 100) }),
      };
  }
}
