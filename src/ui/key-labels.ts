import type { KeyActionId, KeyBindings, PadActionId, PadBindings } from '../data/controls';
import { t, type TextKey } from '../data/texts';

/** Keys whose name is a word (shown in Spanish). */
const NAMED_KEYS: Readonly<Record<string, TextKey>> = {
  Space: 'keySpace',
  Enter: 'keyEnter',
  NumpadEnter: 'keyNumpadEnter',
  Backspace: 'keyBackspace',
  ShiftLeft: 'keyShiftLeft',
  ShiftRight: 'keyShiftRight',
  ControlLeft: 'keyControlLeft',
  ControlRight: 'keyControlRight',
  AltLeft: 'keyAltLeft',
  AltRight: 'keyAltRight',
};

/** Symbol keys as printed on a US keyboard; replaced by the real layout when the browser tells it. */
const SYMBOL_KEYS: Readonly<Record<string, string>> = {
  Digit0: '0',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
  IntlBackslash: '<',
  Numpad0: 'Num 0',
  NumpadDecimal: 'Num .',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
};

/** Characters the keyboard layout prints on each key (`code` → character), when known. */
let layout: ReadonlyMap<string, string> = new Map();

/**
 * Asks the browser which character each physical key prints (so a Spanish keyboard shows «Ñ»
 * instead of «;»). Not every browser offers it, and an iframe may block it: then the US names stay.
 */
export async function loadKeyboardLayout(): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      keyboard?: { getLayoutMap?: () => Promise<ReadonlyMap<string, unknown>> };
    };
    const map = await nav.keyboard?.getLayoutMap?.();
    if (!map) return;
    const clean = new Map<string, string>();
    map.forEach((value, code) => {
      // Only single visible characters are used, and always as plain text.
      if (typeof value === 'string' && value.length === 1 && value.trim() !== '') {
        clean.set(code, value.toUpperCase());
      }
    });
    layout = clean;
  } catch {
    // Not available: the US names stay.
  }
}

/** Name of a key to show the player, from its `KeyboardEvent.code`. */
export function keyLabel(code: string): string {
  const named = NAMED_KEYS[code];
  if (named) return t(named);
  if (!code.startsWith('Numpad')) {
    const printed = layout.get(code);
    if (printed) return printed;
  }
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter?.[1]) return letter[1];
  const symbol = SYMBOL_KEYS[code];
  if (symbol) return symbol;
  return /^F\d{1,2}$/.test(code) ? code : '?';
}

const PAD_BUTTON_LABELS: readonly TextKey[] = [
  'padButton0',
  'padButton1',
  'padButton2',
  'padButton3',
  'padButton4',
  'padButton5',
  'padButton6',
  'padButton7',
  'padButton8',
  'padButton9',
  'padButton10',
  'padButton11',
];

/** Name of a gamepad button (by position, with the Xbox and PlayStation names). */
export function padButtonLabel(index: number): string {
  const key = PAD_BUTTON_LABELS[index];
  return key ? t(key) : '?';
}

export const KEY_ACTION_LABELS: Readonly<Record<KeyActionId, TextKey>> = {
  up: 'actionUp',
  down: 'actionDown',
  left: 'actionLeft',
  right: 'actionRight',
  fire: 'actionFire',
  reload: 'actionReload',
  swap: 'actionSwap',
  pause: 'actionPause',
  mute: 'actionMute',
};

export const PAD_ACTION_LABELS: Readonly<Record<PadActionId, TextKey>> = {
  fire: 'actionFire',
  reload: 'actionReload',
  swap: 'actionSwap',
  pause: 'actionPause',
  mute: 'actionMute',
};

/** Which summary of the controls to show: the device the player is using. */
export type ControlsDevice = 'keyboard' | 'touch' | 'pad';

/** Controls summary for the menu, with the keys or buttons currently assigned. */
export function controlsSummary(
  keys: Readonly<KeyBindings>,
  pad: Readonly<PadBindings>,
  device: ControlsDevice,
): string {
  if (device === 'touch') return t('controlsTouch');
  if (device === 'pad') {
    return t('controlsPadSummary', {
      fire: padButtonLabel(pad.fire),
      reload: padButtonLabel(pad.reload),
      swap: padButtonLabel(pad.swap),
      pause: padButtonLabel(pad.pause),
    });
  }
  // «WASD» when every movement key is a single character; otherwise the names with slashes.
  const move = [keys.up, keys.left, keys.down, keys.right].map(keyLabel);
  return t('controlsDesktop', {
    move: move.every((k) => k.length === 1) ? move.join('') : move.join(' / '),
    fire: keyLabel(keys.fire),
    reload: keyLabel(keys.reload),
    swap: keyLabel(keys.swap),
    pause: keyLabel(keys.pause),
    mute: keyLabel(keys.mute),
  });
}
