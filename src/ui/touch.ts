import { t } from '../data/texts';

/**
 * On-screen "swap weapon" button for touch play. Hidden until the first touch,
 * so mouse/keyboard players never see it.
 */
export function createTouchControls(root: HTMLElement, onSwap: () => void): void {
  const swap = document.createElement('button');
  swap.type = 'button';
  swap.className = 'ds-touch-btn';
  swap.textContent = t('swapButton');
  swap.hidden = true;
  root.append(swap);

  // pointerdown (not click) so it reacts instantly and never waits for a tap delay.
  swap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onSwap();
  });

  const reveal = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    swap.hidden = false;
    window.removeEventListener('pointerdown', reveal);
  };
  window.addEventListener('pointerdown', reveal);
}
