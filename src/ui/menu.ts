import { DIFFICULTIES, DIFFICULTY_IDS, type DifficultyId } from '../data/difficulty';
import { t } from '../data/texts';
import { formatDuration } from './format';

export interface RunStats {
  timeSurvived: number;
  kills: number;
  level: number;
  /** In-game clock at the end, e.g. "1:36 AM". */
  clock: string;
  /** The run beat the stored best time of its difficulty. */
  newRecord: boolean;
  difficulty: DifficultyId;
}

export type EndVariant = 'victory' | 'defeat';

export interface EndScreen {
  readonly visible: boolean;
  show(
    variant: EndVariant,
    stats: Readonly<RunStats>,
    onRetry: () => void,
    onMenu: () => void,
  ): void;
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

function button(className: string, text: string): HTMLButtonElement {
  const b = el('button', className, text);
  b.type = 'button';
  return b;
}

function statRow(label: string): { row: HTMLElement; value: HTMLElement } {
  const row = el('div', 'ds-stat');
  const value = el('span', 'ds-stat-value');
  row.append(el('span', 'ds-stat-label', label), value);
  return { row, value };
}

/** Full-screen overlay with a centered dialog panel, hidden at first. */
function dialog(root: HTMLElement): { overlay: HTMLElement; panel: HTMLElement } {
  const overlay = el('div', 'ds-overlay');
  overlay.hidden = true;
  const panel = el('div', 'ds-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  overlay.append(panel);
  root.append(overlay);
  return { overlay, panel };
}

const soundLabel = (muted: boolean): string => (muted ? t('soundOff') : t('soundOn'));

const difficultyName = (id: DifficultyId): string => t(DIFFICULTIES[id].nameKey);

/** Victory / defeat screen with run stats, retry and back-to-menu buttons. */
export function createEndScreen(root: HTMLElement): EndScreen {
  const { overlay, panel } = dialog(root);
  const title = el('h1', 'ds-title');
  const subtitle = el('p', 'ds-subtitle');
  const record = el('p', 'ds-record', t('newRecord'));
  const clock = statRow(t('statClock'));
  const time = statRow(t('statTime'));
  const kills = statRow(t('statKills'));
  const level = statRow(t('statLevel'));
  const difficulty = statRow(t('statDifficulty'));
  const retry = button('ds-button', t('retry'));
  const menu = button('ds-button ds-button-secondary', t('menuButton'));
  panel.append(
    title,
    subtitle,
    record,
    clock.row,
    time.row,
    kills.row,
    level.row,
    difficulty.row,
    retry,
    menu,
  );

  let onRetry: (() => void) | undefined;
  let onMenu: (() => void) | undefined;
  retry.addEventListener('click', () => onRetry?.());
  menu.addEventListener('click', () => onMenu?.());

  return {
    get visible() {
      return !overlay.hidden;
    },
    show(variant, stats, retryHandler, menuHandler) {
      onRetry = retryHandler;
      onMenu = menuHandler;
      const won = variant === 'victory';
      title.textContent = won ? t('victoryTitle') : t('gameOverTitle');
      title.className = `ds-title ${won ? 'ds-title-victory' : 'ds-title-danger'}`;
      subtitle.textContent = won
        ? t('victorySubtitle')
        : t('gameOverSubtitle', { clock: stats.clock });
      record.hidden = !stats.newRecord;
      clock.value.textContent = stats.clock;
      time.value.textContent = formatDuration(stats.timeSurvived);
      kills.value.textContent = String(stats.kills);
      level.value.textContent = String(stats.level);
      difficulty.value.textContent = difficultyName(stats.difficulty);
      overlay.hidden = false;
      retry.focus();
    },
    hide() {
      retry.blur();
      overlay.hidden = true;
      onRetry = onMenu = undefined;
    },
  };
}

export interface MainMenuInfo {
  /** Selected difficulty; the best clock and wins are the ones of this difficulty. */
  difficulty: DifficultyId;
  /** Best in-game clock reached, or null before the first run. */
  bestClock: string | null;
  wins: number;
  totalKills: number;
  muted: boolean;
  /** Show the touch controls summary instead of the keyboard one. */
  touch: boolean;
}

export interface MainMenu {
  readonly visible: boolean;
  show(info: Readonly<MainMenuInfo>): void;
  hide(): void;
  setMuted(muted: boolean): void;
}

export interface MainMenuHandlers {
  onPlay(): void;
  onToggleMute(): void;
  /** A difficulty button was pressed; the host saves it and shows the menu again. */
  onSelectDifficulty(id: DifficultyId): void;
}

/**
 * Title screen: difficulty, play, best clock and wins on that difficulty, lifetime kills, sound
 * toggle and a controls summary.
 */
export function createMainMenu(root: HTMLElement, handlers: MainMenuHandlers): MainMenu {
  const { overlay, panel } = dialog(root);
  panel.classList.add('ds-panel-menu');
  const title = el('h1', 'ds-title ds-title-game', t('gameTitle'));
  const tagline = el('p', 'ds-subtitle', t('menuTagline'));
  const goal = el('p', 'ds-goal', t('menuGoal'));
  const difficultyRow = el('div', 'ds-segmented');
  difficultyRow.setAttribute('role', 'group');
  difficultyRow.setAttribute('aria-label', t('difficultyTitle'));
  const difficultyButtons = DIFFICULTY_IDS.map((id) => {
    const b = button('ds-segment', difficultyName(id));
    b.addEventListener('click', () => handlers.onSelectDifficulty(id));
    difficultyRow.append(b);
    return { id, b };
  });
  const play = button('ds-button', t('play'));
  const best = statRow(t('bestClock'));
  const wins = statRow(t('statWins'));
  const kills = statRow(t('totalKills'));
  const sound = button('ds-button ds-button-secondary', '');
  const controls = el('p', 'ds-controls');
  panel.append(
    title,
    tagline,
    goal,
    el('p', 'ds-segmented-label', t('difficultyTitle')),
    difficultyRow,
    play,
    best.row,
    wins.row,
    kills.row,
    sound,
    controls,
  );

  play.addEventListener('click', handlers.onPlay);
  sound.addEventListener('click', handlers.onToggleMute);

  return {
    get visible() {
      return !overlay.hidden;
    },
    show(info) {
      for (const { id, b } of difficultyButtons) {
        b.setAttribute('aria-pressed', String(id === info.difficulty));
      }
      best.value.textContent = info.bestClock ?? t('bestNone');
      wins.value.textContent = String(info.wins);
      kills.value.textContent = String(info.totalKills);
      sound.textContent = soundLabel(info.muted);
      controls.textContent = info.touch ? t('controlsTouch') : t('controlsDesktop');
      // Shown again after picking a difficulty: the focus stays on that button.
      if (!overlay.hidden) return;
      overlay.hidden = false;
      play.focus();
    },
    hide() {
      play.blur();
      overlay.hidden = true;
    },
    setMuted(muted) {
      sound.textContent = soundLabel(muted);
    },
  };
}

export interface PauseMenu {
  readonly visible: boolean;
  show(muted: boolean, showDebug: boolean, difficulty: DifficultyId): void;
  hide(): void;
  setMuted(muted: boolean): void;
  setShowDebug(showDebug: boolean): void;
}

export interface PauseHandlers {
  onResume(): void;
  onToggleMute(): void;
  /** The metrics checkbox changed; the host decides the new state and calls `setShowDebug`. */
  onToggleDebug(): void;
  onQuit(): void;
}

export function createPauseMenu(root: HTMLElement, handlers: PauseHandlers): PauseMenu {
  const { overlay, panel } = dialog(root);
  const title = el('h1', 'ds-title', t('pauseTitle'));
  const difficulty = el('p', 'ds-subtitle');
  const resume = button('ds-button', t('resume'));
  const sound = button('ds-button ds-button-secondary', '');
  const debugRow = el('label', 'ds-check');
  const debugBox = el('input', 'ds-check-box');
  debugBox.type = 'checkbox';
  debugRow.append(debugBox, el('span', '', t('showDebug')));
  const quit = button('ds-button ds-button-secondary', t('quitToMenu'));
  panel.append(title, difficulty, resume, sound, debugRow, quit);

  resume.addEventListener('click', handlers.onResume);
  sound.addEventListener('click', handlers.onToggleMute);
  debugBox.addEventListener('change', handlers.onToggleDebug);
  quit.addEventListener('click', handlers.onQuit);

  return {
    get visible() {
      return !overlay.hidden;
    },
    show(muted, showDebug, difficultyId) {
      difficulty.textContent = t('difficultyLabel', { name: difficultyName(difficultyId) });
      sound.textContent = soundLabel(muted);
      debugBox.checked = showDebug;
      overlay.hidden = false;
      resume.focus();
    },
    hide() {
      resume.blur();
      overlay.hidden = true;
    },
    setMuted(muted) {
      sound.textContent = soundLabel(muted);
    },
    setShowDebug(showDebug) {
      debugBox.checked = showDebug;
    },
  };
}
