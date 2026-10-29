import { t, type TextKey } from '../data/texts';

export interface TouchHandlers {
  onSwap(): void;
  onReload(): void;
  onPause(): void;
}

export interface TouchControls {
  /** Buttons only show during play (not on menus or end screens). */
  setPlaying(playing: boolean): void;
}

function makeButton(
  root: HTMLElement,
  className: string,
  text: string,
  label: TextKey,
  onPress: () => void,
): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = text;
  b.setAttribute('aria-label', t(label));
  b.hidden = true;
  root.append(b);
  // pointerdown (not click) so it reacts instantly and never waits for a tap delay.
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onPress();
  });
  // Keyboard / screen-reader activation still works through click.
  b.addEventListener('click', (e) => {
    if (e.detail === 0) onPress();
  });
  return b;
}

/**
 * On-screen buttons. Pause is always available during play (mouse or touch);
 * swap and reload appear after the first touch, so mouse/keyboard players never see them.
 */
export function createTouchControls(root: HTMLElement, handlers: TouchHandlers): TouchControls {
  // The two bars are drawn in CSS: the ❚❚ glyph is missing from many system fonts.
  const pause = makeButton(root, 'ds-pause-btn', '', 'pauseButton', handlers.onPause);
  const swap = makeButton(root, 'ds-touch-btn', t('swapButton'), 'swapButton', handlers.onSwap);
  const reload = makeButton(
    root,
    'ds-touch-btn ds-touch-btn-reload',
    t('reloadButton'),
    'reloadButton',
    handlers.onReload,
  );

  let playing = false;
  let touched = false;
  const sync = (): void => {
    pause.hidden = !playing;
    swap.hidden = reload.hidden = !(playing && touched);
  };

  const reveal = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    touched = true;
    sync();
    window.removeEventListener('pointerdown', reveal);
  };
  window.addEventListener('pointerdown', reveal);

  return {
    setPlaying(value) {
      if (value === playing) return;
      playing = value;
      sync();
    },
  };
}
