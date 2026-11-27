import {
  DEFAULT_KEY_BINDINGS,
  DEFAULT_PAD_BINDINGS,
  EXTRA_ASSIGNABLE_KEYS,
  KEY_ACTIONS,
  PAD_ACTIONS,
  PAD_ASSIGNABLE_MAX,
  type KeyActionId,
  type KeyBindings,
  type PadActionId,
  type PadBindings,
} from '../data/controls';

const EXTRA_KEYS: ReadonlySet<string> = new Set(EXTRA_ASSIGNABLE_KEYS);

/** A `KeyboardEvent.code` the player may assign: letters A-Z or one of the listed extras. */
export function isAssignableKey(code: unknown): code is string {
  return typeof code === 'string' && (/^Key[A-Z]$/.test(code) || EXTRA_KEYS.has(code));
}

/** A standard-mapping button index the player may assign (0-11). */
export function isAssignablePadButton(index: unknown): index is number {
  return (
    typeof index === 'number' &&
    Number.isInteger(index) &&
    index >= 0 &&
    index <= PAD_ASSIGNABLE_MAX
  );
}

/** Two actions share a key or button. */
export function hasDuplicates(values: readonly (string | number)[]): boolean {
  return new Set(values).size !== values.length;
}

export interface Assignment<B, A> {
  bindings: B;
  /** The action that had the new key and now takes the old one, if any. */
  swappedWith: A | undefined;
}

/** Gives `value` to `action`; the action that held it (if any) takes `action`'s old value. */
function assign<A extends string, V>(
  bindings: Readonly<Record<A, V>>,
  actions: readonly A[],
  action: A,
  value: V,
): Assignment<Record<A, V>, A> {
  const next = { ...bindings } as Record<A, V>;
  const old = next[action];
  const holder = actions.find((a) => a !== action && next[a] === value);
  if (holder !== undefined) next[holder] = old;
  next[action] = value;
  return { bindings: next, swappedWith: holder };
}

/** New key bindings with `code` on `action`, or null if the key cannot be assigned. */
export function assignKey(
  bindings: Readonly<KeyBindings>,
  action: KeyActionId,
  code: string,
): Assignment<KeyBindings, KeyActionId> | null {
  return isAssignableKey(code) ? assign(bindings, KEY_ACTIONS, action, code) : null;
}

/** New gamepad bindings with `button` on `action`, or null if it cannot be assigned. */
export function assignPadButton(
  bindings: Readonly<PadBindings>,
  action: PadActionId,
  button: number,
): Assignment<PadBindings, PadActionId> | null {
  return isAssignablePadButton(button) ? assign(bindings, PAD_ACTIONS, action, button) : null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Own property only: `__proto__`, `constructor` and friends are never read from stored data. */
function own(obj: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

/**
 * Validates stored bindings action by action (unknown actions are ignored, invalid values fall
 * back to the default). If that leaves two actions on the same input, all go back to the defaults.
 */
function parseBindings<A extends string, V extends string | number>(
  raw: unknown,
  actions: readonly A[],
  defaults: Readonly<Record<A, V>>,
  valid: (v: unknown) => v is V,
): Record<A, V> {
  const stored = isPlainObject(raw) ? raw : {};
  const out = { ...defaults } as Record<A, V>;
  for (const action of actions) {
    const v = own(stored, action);
    if (valid(v)) out[action] = v;
  }
  return hasDuplicates(actions.map((a) => out[a])) ? { ...defaults } : out;
}

export function parseKeyBindings(raw: unknown): KeyBindings {
  return parseBindings(raw, KEY_ACTIONS, DEFAULT_KEY_BINDINGS, isAssignableKey);
}

export function parsePadBindings(raw: unknown): PadBindings {
  return parseBindings(raw, PAD_ACTIONS, DEFAULT_PAD_BINDINGS, isAssignablePadButton);
}

/** Reverse lookup used by the keyboard handler; rebuilt only when the bindings change. */
export function keyLookup(bindings: Readonly<KeyBindings>): ReadonlyMap<string, KeyActionId> {
  return new Map(KEY_ACTIONS.map((a) => [bindings[a], a]));
}
