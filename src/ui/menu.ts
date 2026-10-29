import { t } from '../data/texts';
import { formatDuration } from './format';

export interface RunStats {
  timeSurvived: number;
  kills: number;
}

export interface GameOverScreen {
  readonly visible: boolean;
  show(stats: Readonly<RunStats>, onRetry: () => void): void;
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

export function createGameOverScreen(root: HTMLElement): GameOverScreen {
  const overlay = el('div', 'ds-overlay');
  overlay.hidden = true;
  const panel = el('div', 'ds-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  const title = el('h1', 'ds-title ds-title-danger', t('gameOverTitle'));
  const subtitle = el('p', 'ds-subtitle', t('gameOverSubtitle'));
  const time = statRow(t('statTime'));
  const kills = statRow(t('statKills'));
  const retry = el('button', 'ds-button', t('retry'));
  retry.type = 'button';
  panel.append(title, subtitle, time.row, kills.row, retry);
  overlay.append(panel);
  root.append(overlay);

  let onRetry: (() => void) | undefined;
  retry.addEventListener('click', () => onRetry?.());

  return {
    get visible() {
      return !overlay.hidden;
    },
    show(stats, retryHandler) {
      onRetry = retryHandler;
      time.value.textContent = formatDuration(stats.timeSurvived);
      kills.value.textContent = String(stats.kills);
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
