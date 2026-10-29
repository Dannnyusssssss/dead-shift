import { t } from '../data/texts';
import type { OfferView } from './describe';

export interface LevelUpView {
  /** A level-up or the boss chest (free weapon upgrade). */
  source: 'level' | 'chest';
  level: number;
  offers: readonly OfferView[];
  rerollsLeft: number;
}

export interface LevelUpHandlers {
  onChoose(index: number): void;
  onReroll(): void;
}

export interface LevelUpScreen {
  readonly visible: boolean;
  show(view: Readonly<LevelUpView>, handlers: LevelUpHandlers): void;
  hide(): void;
}

/** Ignores clicks right after opening so a tap meant for the game doesn't pick a card. */
const INPUT_GRACE_MS = 250;

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

export function createLevelUpScreen(root: HTMLElement): LevelUpScreen {
  const overlay = el('div', 'ds-overlay');
  overlay.hidden = true;
  const panel = el('div', 'ds-panel ds-panel-wide');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  const title = el('h1', 'ds-title ds-title-level');
  const hint = el('p', 'ds-subtitle', t('levelUpHint'));
  const cards = el('div', 'ds-cards');
  const reroll = el('button', 'ds-button ds-button-secondary');
  reroll.type = 'button';
  panel.append(title, hint, cards, reroll);
  overlay.append(panel);
  root.append(overlay);

  let handlers: LevelUpHandlers | undefined;
  let shownAt = 0;
  let offerCount = 0;
  const ready = (): boolean => performance.now() - shownAt >= INPUT_GRACE_MS;

  reroll.addEventListener('click', () => {
    if (ready()) handlers?.onReroll();
  });

  window.addEventListener('keydown', (e) => {
    if (overlay.hidden || !handlers || e.repeat || !ready()) return;
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (digit) {
      const index = Number(digit[1]) - 1;
      if (index < offerCount) {
        e.preventDefault();
        handlers.onChoose(index);
      }
    } else if (e.code === 'KeyR' && !reroll.disabled) {
      e.preventDefault();
      handlers.onReroll();
    }
  });

  function renderCards(view: Readonly<LevelUpView>): void {
    cards.replaceChildren();
    view.offers.forEach((offer, i) => {
      const card = el('button', 'ds-card');
      card.type = 'button';
      const head = el('div', 'ds-card-head');
      head.append(el('span', 'ds-card-icon', offer.icon), el('span', 'ds-card-key', String(i + 1)));
      const name = el('div', 'ds-card-name', offer.name);
      card.append(head, name);
      if (offer.tag) card.append(el('div', 'ds-card-tag', offer.tag));
      card.append(el('div', 'ds-card-desc', offer.description));
      card.addEventListener('click', () => {
        if (ready()) handlers?.onChoose(i);
      });
      cards.append(card);
    });
  }

  return {
    get visible() {
      return !overlay.hidden;
    },
    show(view, nextHandlers) {
      const wasHidden = overlay.hidden;
      handlers = nextHandlers;
      offerCount = view.offers.length;
      const chest = view.source === 'chest';
      title.textContent = chest ? t('chestTitle') : t('levelUpTitle', { level: view.level });
      title.className = `ds-title ${chest ? 'ds-title-chest' : 'ds-title-level'}`;
      hint.textContent = chest ? t('chestHint') : t('levelUpHint');
      renderCards(view);
      reroll.textContent = `${t('reroll')} (R) ${t('rerollsLeft', { n: view.rerollsLeft })}`;
      reroll.disabled = view.rerollsLeft <= 0;
      overlay.hidden = false;
      if (wasHidden) shownAt = performance.now();
      cards.querySelector('button')?.focus();
    },
    hide() {
      overlay.hidden = true;
      handlers = undefined;
      (document.activeElement as HTMLElement | null)?.blur();
    },
  };
}
