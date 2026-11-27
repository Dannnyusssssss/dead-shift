/**
 * Gamepad navigation of the DOM menus: the d-pad or left stick moves the focus through the
 * buttons of the open dialog, the bottom button presses the focused one and the right button
 * acts like Esc (resume, close, cancel), so every menu works without a mouse or keyboard.
 */

/** Next focus index, wrapping around; with nothing focused, the first (or last) element. */
export function stepFocusIndex(current: number, count: number, step: -1 | 1): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return step > 0 ? 0 : count - 1;
  return (current + step + count) % count;
}

/** The open dialog on top (the last visible overlay in the page), if any. */
function topOverlay(): HTMLElement | undefined {
  const open = document.querySelectorAll<HTMLElement>('.ds-overlay:not([hidden])');
  return open[open.length - 1];
}

function focusables(scope: HTMLElement): HTMLElement[] {
  return Array.from(
    scope.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'),
  ).filter((node) => !node.hidden && node.getClientRects().length > 0);
}

/** Applies one frame of gamepad menu input. Returns false when no menu is open. */
export function navigateMenus(step: -1 | 0 | 1, confirm: boolean, back: boolean): boolean {
  const overlay = topOverlay();
  if (!overlay) return false;
  const items = focusables(overlay);
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const index = active ? items.indexOf(active) : -1;
  if (step !== 0) {
    const next = items[stepFocusIndex(index, items.length, step)];
    next?.focus();
    next?.scrollIntoView({ block: 'nearest' });
  }
  if (confirm) {
    if (index >= 0) active?.click();
    else items[0]?.focus();
  }
  if (back) {
    // The same path as the Esc key, so each dialog keeps its own meaning of «back».
    (active ?? overlay).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
    );
  }
  return true;
}
