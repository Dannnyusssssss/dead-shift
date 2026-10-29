import { t } from '../data/texts';
import { formatDuration } from './format';

export interface RunStats {
  timeSurvived: number;
  kills: number;
  level: number;
  /** In-game clock at the end, e.g. "1:36 AM". */
  clock: string;
}

export type EndVariant = 'victory' | 'defeat';

export interface EndScreen {
  readonly visible: boolean;
  show(variant: EndVariant, stats: Readonly<RunStats>, onRetry: () => void): void;
  hide(): void;
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

function statRow(label: string): { row: HTMLElement; value: HTMLElement } {
  const row = el('div', 'ds-stat');
  const value = el('span', 'ds-stat-value');
  row.append(el('span', 'ds-stat-label', label), value);
  return { row, value };
}

/** Victory / defeat screen with run stats and a retry button. */
export function createEndScreen(root: HTMLElement): EndScreen {
  const overlay = el('div', 'ds-overlay');
  overlay.hidden = true;
  const panel = el('div', 'ds-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  const title = el('h1', 'ds-title');
  const subtitle = el('p', 'ds-subtitle');
  const time = statRow(t('statTime'));
  const kills = statRow(t('statKills'));
  const level = statRow(t('statLevel'));
  const retry = el('button', 'ds-button', t('retry'));
  retry.type = 'button';
  panel.append(title, subtitle, time.row, kills.row, level.row, retry);
  overlay.append(panel);
  root.append(overlay);

  let onRetry: (() => void) | undefined;
  retry.addEventListener('click', () => onRetry?.());

  return {
    get visible() {
      return !overlay.hidden;
    },
    show(variant, stats, retryHandler) {
      onRetry = retryHandler;
      const won = variant === 'victory';
      title.textContent = won ? t('victoryTitle') : t('gameOverTitle');
      title.className = `ds-title ${won ? 'ds-title-victory' : 'ds-title-danger'}`;
      subtitle.textContent = won
        ? t('victorySubtitle')
        : t('gameOverSubtitle', { clock: stats.clock });
      time.value.textContent = formatDuration(stats.timeSurvived);
      kills.value.textContent = String(stats.kills);
      level.value.textContent = String(stats.level);
      overlay.hidden = false;
      retry.focus();
    },
    hide() {
      retry.blur();
      overlay.hidden = true;
      onRetry = undefined;
    },
  };
}
