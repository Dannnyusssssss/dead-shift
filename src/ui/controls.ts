import { assignKey, assignPadButton } from '../core/bindings';
import {
  DEFAULT_KEY_BINDINGS,
  DEFAULT_PAD_BINDINGS,
  KEY_ACTIONS,
  PAD_ACTIONS,
  SENSITIVITY_LEVELS,
  VIEW_SCALES,
  type FireMode,
  type KeyActionId,
  type KeyBindings,
  type PadActionId,
  type PadBindings,
  type SensitivityLevel,
  type ViewScale,
} from '../data/controls';
import { t, type TextKey } from '../data/texts';
import { KEY_ACTION_LABELS, PAD_ACTION_LABELS, keyLabel, padButtonLabel } from './key-labels';

/** Everything the «Controles» menu edits (stored in the save). */
export interface ControlSettings {
  keyBindings: KeyBindings;
  padBindings: PadBindings;
  viewScale: ViewScale;
  touchSensitivity: SensitivityLevel;
  padSensitivity: SensitivityLevel;
  aimAssist: boolean;
  fireMode: FireMode;
}

export interface ControlsPanel {
  readonly visible: boolean;
  /** Waiting for a gamepad button: the host passes presses to `padButton` and drops the rest. */
  readonly capturingPad: boolean;
  show(settings: Readonly<ControlSettings>, padConnected: boolean, onClose: () => void): void;
  /** A gamepad button pressed while capturing. */
  padButton(index: number): void;
  setPadConnected(connected: boolean): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(className: string, text: string): HTMLButtonElement {
  const b = el('button', className, text);
  b.type = 'button';
  return b;
}

/** A row of mutually exclusive choices (aria-pressed marks the chosen one). */
function segmented<T extends number>(
  label: TextKey,
  values: readonly T[],
  text: (v: T) => string,
  onPick: (v: T) => void,
): { nodes: HTMLElement[]; set(v: T): void } {
  const title = el('p', 'ds-segmented-label', t(label));
  const row = el('div', 'ds-segmented');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', t(label));
  const buttons = values.map((v) => {
    const b = button('ds-segment', text(v));
    b.addEventListener('click', () => onPick(v));
    row.append(b);
    return { v, b };
  });
  return {
    nodes: [title, row],
    set(current) {
      for (const { v, b } of buttons) b.setAttribute('aria-pressed', String(v === current));
    },
  };
}

type Capture = { kind: 'key'; action: KeyActionId } | { kind: 'pad'; action: PadActionId };

/**
 * «Controles»: keys and gamepad buttons (press «Cambiar», then the new key), field of view,
 * sensitivities, aim assist and fire mode. Esc cancels a capture and Tab is never captured, so the
 * keyboard can always leave. Every change goes to `onChange`, which saves and applies it.
 */
export function createControlsPanel(
  root: HTMLElement,
  onChange: (next: Readonly<ControlSettings>) => void,
): ControlsPanel {
  const overlay = el('div', 'ds-overlay');
  overlay.hidden = true;
  const panel = el('div', 'ds-panel ds-panel-wide ds-controls-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', t('controlsTitle'));
  overlay.append(panel);
  root.append(overlay);

  let settings: ControlSettings = {
    keyBindings: { ...DEFAULT_KEY_BINDINGS },
    padBindings: { ...DEFAULT_PAD_BINDINGS },
    viewScale: 100,
    touchSensitivity: 3,
    padSensitivity: 3,
    aimAssist: false,
    fireMode: 'hold',
  };
  let capture: Capture | undefined;
  let onClose: (() => void) | undefined;

  const status = el('p', 'ds-controls ds-controls-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const say = (text: string): void => {
    status.textContent = text;
  };

  const change = (next: ControlSettings): void => {
    settings = next;
    onChange(settings);
    refresh();
  };

  // Keyboard rows.
  const keyRows = KEY_ACTIONS.map((action) => {
    const row = el('div', 'ds-bind');
    const name = el('span', 'ds-bind-name', t(KEY_ACTION_LABELS[action]));
    const b = button('ds-bind-key', '');
    row.append(name, b);
    b.addEventListener('click', () => startCapture({ kind: 'key', action }, b));
    b.addEventListener('blur', () => {
      if (capture?.kind === 'key' && capture.action === action) cancelCapture(false);
    });
    return { action, b, row };
  });

  // Gamepad rows.
  const padStatus = el('p', 'ds-controls');
  const padRows = PAD_ACTIONS.map((action) => {
    const row = el('div', 'ds-bind');
    const name = el('span', 'ds-bind-name', t(PAD_ACTION_LABELS[action]));
    const b = button('ds-bind-key', '');
    row.append(name, b);
    b.addEventListener('click', () => startCapture({ kind: 'pad', action }, b));
    b.addEventListener('blur', () => {
      if (capture?.kind === 'pad' && capture.action === action) cancelCapture(false);
    });
    return { action, b, row };
  });

  const reset = button('ds-button ds-button-secondary', t('resetControls'));
  reset.addEventListener('click', () => {
    cancelCapture(false);
    change({
      ...settings,
      keyBindings: { ...DEFAULT_KEY_BINDINGS },
      padBindings: { ...DEFAULT_PAD_BINDINGS },
    });
    say(t('resetControlsDone'));
  });

  const view = segmented(
    'viewScaleTitle',
    VIEW_SCALES,
    (n) => t('viewScaleOption', { n }),
    (viewScale) => change({ ...settings, viewScale }),
  );
  const touch = segmented('touchSensitivityTitle', SENSITIVITY_LEVELS, String, (touchSensitivity) =>
    change({ ...settings, touchSensitivity }),
  );
  const pad = segmented('padSensitivityTitle', SENSITIVITY_LEVELS, String, (padSensitivity) =>
    change({ ...settings, padSensitivity }),
  );
  const aim = button('ds-button ds-button-secondary', '');
  aim.addEventListener('click', () => change({ ...settings, aimAssist: !settings.aimAssist }));
  const fire = button('ds-button ds-button-secondary', '');
  fire.addEventListener('click', () =>
    change({ ...settings, fireMode: settings.fireMode === 'hold' ? 'toggle' : 'hold' }),
  );
  const back = button('ds-button', t('back'));

  const keyGrid = el('div', 'ds-bind-grid');
  keyGrid.append(...keyRows.map((r) => r.row));
  const padGrid = el('div', 'ds-bind-grid');
  padGrid.append(...padRows.map((r) => r.row));
  panel.append(
    el('h1', 'ds-title', t('controlsTitle')),
    el('h2', 'ds-legal-heading', t('controlsKeyboard')),
    el('p', 'ds-controls', t('controlsKeyboardHint')),
    keyGrid,
    el('h2', 'ds-legal-heading', t('controlsPad')),
    padStatus,
    el('p', 'ds-controls', t('controlsPadHint')),
    padGrid,
    reset,
    el('h2', 'ds-legal-heading', t('controlsOptions')),
    ...view.nodes,
    ...touch.nodes,
    ...pad.nodes,
    aim,
    fire,
    status,
    back,
  );

  function refresh(): void {
    for (const { action, b } of keyRows) {
      const capturing = capture?.kind === 'key' && capture.action === action;
      const key = keyLabel(settings.keyBindings[action]);
      b.textContent = capturing ? t('captureKey') : key;
      b.setAttribute(
        'aria-label',
        t('changeBinding', { action: t(KEY_ACTION_LABELS[action]), key }),
      );
    }
    for (const { action, b } of padRows) {
      const capturing = capture?.kind === 'pad' && capture.action === action;
      const key = padButtonLabel(settings.padBindings[action]);
      b.textContent = capturing ? t('capturePad') : key;
      b.setAttribute(
        'aria-label',
        t('changeBinding', { action: t(PAD_ACTION_LABELS[action]), key }),
      );
    }
    view.set(settings.viewScale);
    touch.set(settings.touchSensitivity);
    pad.set(settings.padSensitivity);
    aim.textContent = settings.aimAssist ? t('aimAssistOn') : t('aimAssistOff');
    fire.textContent = settings.fireMode === 'toggle' ? t('fireModeToggle') : t('fireModeHold');
  }

  function startCapture(next: Capture, from: HTMLButtonElement): void {
    capture = next;
    const action =
      next.kind === 'key' ? t(KEY_ACTION_LABELS[next.action]) : t(PAD_ACTION_LABELS[next.action]);
    say(t(next.kind === 'key' ? 'captureKeyStatus' : 'capturePadStatus', { action }));
    refresh();
    from.focus();
  }

  function cancelCapture(announce: boolean): void {
    if (!capture) return;
    capture = undefined;
    if (announce) say(t('captureCancelled'));
    refresh();
  }

  /** Reports a finished assignment, naming the action that took the old key in a swap. */
  function announce(action: string, key: string, other: string | undefined, old: string): void {
    say(
      other ? t('bindingSwapped', { action, key, other, old }) : t('bindingSet', { action, key }),
    );
  }

  // Capture phase: a key pressed while capturing never reaches the game or the menus behind.
  window.addEventListener(
    'keydown',
    (e) => {
      if (overlay.hidden || !capture) return;
      if (e.code === 'Tab') {
        // Tab keeps moving the focus (the blur cancels the capture).
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        cancelCapture(true);
        return;
      }
      if (capture.kind !== 'key' || e.repeat) return;
      const action = capture.action;
      const old = settings.keyBindings[action];
      const result = assignKey(settings.keyBindings, action, e.code);
      if (!result) {
        say(t('keyNotAllowed'));
        return;
      }
      capture = undefined;
      change({ ...settings, keyBindings: result.bindings });
      announce(
        t(KEY_ACTION_LABELS[action]),
        keyLabel(e.code),
        result.swappedWith && t(KEY_ACTION_LABELS[result.swappedWith]),
        keyLabel(old),
      );
    },
    true,
  );

  const close = (): void => {
    cancelCapture(false);
    overlay.hidden = true;
    const done = onClose;
    onClose = undefined;
    done?.();
  };
  back.addEventListener('click', close);
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  });

  return {
    get visible() {
      return !overlay.hidden;
    },
    get capturingPad() {
      return !overlay.hidden && capture?.kind === 'pad';
    },
    show(current, padConnected, closeHandler) {
      settings = {
        ...current,
        keyBindings: { ...current.keyBindings },
        padBindings: { ...current.padBindings },
      };
      capture = undefined;
      onClose = closeHandler;
      say('');
      this.setPadConnected(padConnected);
      refresh();
      overlay.hidden = false;
      panel.scrollTop = 0;
      keyRows[0]?.b.focus();
    },
    padButton(index) {
      if (capture?.kind !== 'pad') return;
      const action = capture.action;
      const old = settings.padBindings[action];
      const result = assignPadButton(settings.padBindings, action, index);
      if (!result) {
        say(t('padNotAllowed'));
        return;
      }
      capture = undefined;
      change({ ...settings, padBindings: result.bindings });
      announce(
        t(PAD_ACTION_LABELS[action]),
        padButtonLabel(index),
        result.swappedWith && t(PAD_ACTION_LABELS[result.swappedWith]),
        padButtonLabel(old),
      );
    },
    setPadConnected(connected) {
      padStatus.textContent = connected ? t('padConnected') : t('padNone');
    },
  };
}
