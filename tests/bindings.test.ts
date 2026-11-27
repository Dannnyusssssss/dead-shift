import { describe, expect, it } from 'vitest';
import {
  assignKey,
  assignPadButton,
  hasDuplicates,
  isAssignableKey,
  isAssignablePadButton,
  keyLookup,
  parseKeyBindings,
  parsePadBindings,
} from '../src/core/bindings';
import {
  DEFAULT_KEY_BINDINGS,
  DEFAULT_PAD_BINDINGS,
  FIXED_MOVE_KEYS,
  KEY_ACTIONS,
  PAD_ACTIONS,
  PAD_BUTTON,
} from '../src/data/controls';
import { keyLabel, padButtonLabel } from '../src/ui/key-labels';

describe('assignable keys', () => {
  it('accepts letters and the listed extras', () => {
    for (const code of ['KeyA', 'KeyZ', 'Space', 'ShiftLeft', 'Comma', 'F1', 'F10', 'Numpad0']) {
      expect(isAssignableKey(code)).toBe(true);
    }
  });

  it('rejects the fixed keys so the keyboard never gets stuck', () => {
    const fixed = ['Escape', 'Tab', 'F3', ...Object.keys(FIXED_MOVE_KEYS)];
    for (let d = 1; d <= 9; d++) fixed.push(`Digit${d}`, `Numpad${d}`);
    for (const code of fixed) expect(isAssignableKey(code)).toBe(false);
  });

  it('rejects browser keys, junk and non-strings', () => {
    for (const v of [
      'F5',
      'F11',
      'F12',
      'MetaLeft',
      'Keya',
      'KeyAA',
      '',
      ' KeyA',
      'key',
      42,
      null,
      {},
    ]) {
      expect(isAssignableKey(v)).toBe(false);
    }
  });

  it('every default key is assignable and unique', () => {
    const values = KEY_ACTIONS.map((a) => DEFAULT_KEY_BINDINGS[a]);
    for (const v of values) expect(isAssignableKey(v)).toBe(true);
    expect(hasDuplicates(values)).toBe(false);
  });
});

describe('assignable pad buttons', () => {
  it('accepts 0-11 only (the d-pad and system button stay fixed)', () => {
    expect(isAssignablePadButton(0)).toBe(true);
    expect(isAssignablePadButton(11)).toBe(true);
    for (const v of [12, 15, 16, -1, 1.5, NaN, Infinity, '3', null]) {
      expect(isAssignablePadButton(v)).toBe(false);
    }
  });

  it('every default button is assignable and unique', () => {
    const values = PAD_ACTIONS.map((a) => DEFAULT_PAD_BINDINGS[a]);
    for (const v of values) expect(isAssignablePadButton(v)).toBe(true);
    expect(hasDuplicates(values)).toBe(false);
  });
});

describe('assignKey', () => {
  it('sets a free key without touching the rest or the input', () => {
    const r = assignKey(DEFAULT_KEY_BINDINGS, 'fire', 'KeyF');
    expect(r?.bindings.fire).toBe('KeyF');
    expect(r?.swappedWith).toBeUndefined();
    expect(r?.bindings.reload).toBe('KeyR');
    expect(DEFAULT_KEY_BINDINGS.fire).toBe('Space');
  });

  it('swaps with the action that already had the key', () => {
    const r = assignKey(DEFAULT_KEY_BINDINGS, 'fire', 'KeyR');
    expect(r?.bindings.fire).toBe('KeyR');
    expect(r?.bindings.reload).toBe('Space');
    expect(r?.swappedWith).toBe('reload');
    expect(hasDuplicates(KEY_ACTIONS.map((a) => r?.bindings[a] ?? ''))).toBe(false);
  });

  it('re-assigning the same key changes nothing', () => {
    const r = assignKey(DEFAULT_KEY_BINDINGS, 'up', 'KeyW');
    expect(r?.bindings).toEqual(DEFAULT_KEY_BINDINGS);
    expect(r?.swappedWith).toBeUndefined();
  });

  it('refuses fixed or unknown keys', () => {
    expect(assignKey(DEFAULT_KEY_BINDINGS, 'fire', 'Escape')).toBeNull();
    expect(assignKey(DEFAULT_KEY_BINDINGS, 'fire', 'Tab')).toBeNull();
    expect(assignKey(DEFAULT_KEY_BINDINGS, 'up', 'ArrowUp')).toBeNull();
    expect(assignKey(DEFAULT_KEY_BINDINGS, 'up', 'Digit1')).toBeNull();
  });
});

describe('assignPadButton', () => {
  it('swaps with the action that had the button', () => {
    const r = assignPadButton(DEFAULT_PAD_BINDINGS, 'fire', PAD_BUTTON.rb);
    expect(r?.bindings.fire).toBe(PAD_BUTTON.rb);
    expect(r?.bindings.swap).toBe(PAD_BUTTON.rt);
    expect(r?.swappedWith).toBe('swap');
  });

  it('refuses the d-pad', () => {
    expect(assignPadButton(DEFAULT_PAD_BINDINGS, 'fire', PAD_BUTTON.dpadUp)).toBeNull();
  });
});

describe('parseKeyBindings', () => {
  it('defaults when missing or not an object', () => {
    for (const raw of [undefined, null, 'KeyW', 3, ['KeyW']]) {
      expect(parseKeyBindings(raw)).toEqual(DEFAULT_KEY_BINDINGS);
    }
  });

  it('keeps valid keys and defaults invalid ones field by field', () => {
    const b = parseKeyBindings({ fire: 'KeyF', reload: 'Escape', swap: 7, up: 'ArrowUp' });
    expect(b.fire).toBe('KeyF');
    expect(b.reload).toBe('KeyR');
    expect(b.swap).toBe('KeyQ');
    expect(b.up).toBe('KeyW');
  });

  it('resets everything when two actions end on the same key', () => {
    expect(parseKeyBindings({ fire: 'KeyW' })).toEqual(DEFAULT_KEY_BINDINGS);
    expect(parseKeyBindings({ fire: 'KeyF', reload: 'KeyF' })).toEqual(DEFAULT_KEY_BINDINGS);
  });

  it('ignores unknown actions and prototype keys', () => {
    const raw = JSON.parse('{"__proto__":{"fire":"KeyZ"},"constructor":"KeyX","hack":"KeyY"}');
    const b = parseKeyBindings(raw);
    expect(b).toEqual(DEFAULT_KEY_BINDINGS);
    expect(Object.keys(b).sort()).toEqual([...KEY_ACTIONS].sort());
    expect(({} as Record<string, unknown>).fire).toBeUndefined();
  });

  it('returns a copy, never the defaults object', () => {
    const b = parseKeyBindings(undefined);
    b.fire = 'KeyF';
    expect(DEFAULT_KEY_BINDINGS.fire).toBe('Space');
  });
});

describe('parsePadBindings', () => {
  it('validates button by button and resets on duplicates', () => {
    expect(parsePadBindings({ fire: 0 }).fire).toBe(0);
    expect(parsePadBindings({ fire: 99 }).fire).toBe(DEFAULT_PAD_BINDINGS.fire);
    expect(parsePadBindings({ fire: '7' }).fire).toBe(DEFAULT_PAD_BINDINGS.fire);
    expect(parsePadBindings({ fire: DEFAULT_PAD_BINDINGS.pause })).toEqual(DEFAULT_PAD_BINDINGS);
  });
});

describe('keyLookup', () => {
  it('maps every bound key back to its action', () => {
    const map = keyLookup(DEFAULT_KEY_BINDINGS);
    for (const a of KEY_ACTIONS) expect(map.get(DEFAULT_KEY_BINDINGS[a])).toBe(a);
    expect(map.get('Escape')).toBeUndefined();
  });
});

describe('labels', () => {
  it('names letters, words, symbols and function keys', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('Space')).toBe('Espacio');
    expect(keyLabel('Comma')).toBe(',');
    expect(keyLabel('F4')).toBe('F4');
    expect(keyLabel('Numpad0')).toBe('Num 0');
    expect(keyLabel('Nonsense')).toBe('?');
  });

  it('names pad buttons by position', () => {
    expect(padButtonLabel(PAD_BUTTON.bottom)).toContain('A');
    expect(padButtonLabel(PAD_BUTTON.rt)).toContain('RT');
    expect(padButtonLabel(42)).toBe('?');
  });
});
