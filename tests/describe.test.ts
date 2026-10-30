import { describe, expect, it } from 'vitest';
import { WEAPON_IDS, WEAPONS } from '../src/data/weapons';
import { addPassive, createPlayer } from '../src/game/player';
import { describeOffer, describeWeaponUpgrade } from '../src/ui/describe';

describe('describeWeaponUpgrade', () => {
  it('lists what changes between levels', () => {
    expect(describeWeaponUpgrade(WEAPONS.broom, 1)).toBe('+4 daño');
    expect(describeWeaponUpgrade(WEAPONS.broom, 2)).toBe('+30° arco · +10 alcance');
    expect(describeWeaponUpgrade(WEAPONS.broom, 4)).toBe('barre ambos lados');
    expect(describeWeaponUpgrade(WEAPONS.labelGun, 1)).toBe('+2 daño');
    expect(describeWeaponUpgrade(WEAPONS.labelGun, 2)).toBe(
      '+6 balas por cargador · -0.2s recarga',
    );
  });

  it('upgrading the manual gun shows its level tag', () => {
    const p = createPlayer();
    const view = describeOffer({ kind: 'upgradeWeapon', weaponId: 'labelGun' }, p);
    expect(view.tag).toBe('Nv 1 → 2');
  });

  it('describes every level of every weapon', () => {
    for (const id of WEAPON_IDS) {
      for (let lvl = 1; lvl < 5; lvl++) {
        expect(describeWeaponUpgrade(WEAPONS[id], lvl), `${id} ${lvl}`).not.toBe('');
      }
    }
  });

  it('returns empty past the last level', () => {
    expect(describeWeaponUpgrade(WEAPONS.broom, WEAPONS.broom.levels.length)).toBe('');
  });
});

describe('describeOffer', () => {
  it('tags new items and level changes', () => {
    const p = createPlayer();
    expect(describeOffer({ kind: 'newWeapon', weaponId: 'cans' }, p).tag).toBe('Nuevo');
    expect(describeOffer({ kind: 'upgradeWeapon', weaponId: 'broom' }, p).tag).toBe('Nv 1 → 2');
    addPassive(p, 'coffee');
    const coffee = describeOffer({ kind: 'upgradePassive', passiveId: 'coffee' }, p);
    expect(coffee.tag).toBe('Nv 1 → 2');
    expect(coffee.description).toContain('8%');
  });

  it('describes the heal fallback with its percentage', () => {
    const view = describeOffer({ kind: 'heal' }, createPlayer());
    expect(view.description).toContain('30%');
  });
});
