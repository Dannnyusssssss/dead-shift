import { COMBAT } from '../data/combat';
import { SHIFT } from '../data/shift';
import { parseDifficulty } from './difficulty';

/**
 * Debug switches from the URL: `?spawn=300` starts with a horde, `?god` disables death,
 * `?weapons=all` starts with every weapon at max level (ignores the slot limit),
 * `?weapons=evolved` the same with every weapon evolved, `?t=540` starts the shift clock at that
 * many seconds, `?ammo=N` starts with an empty magazine and N rounds in reserve,
 * `?difficulty=easy|normal|hard` plays on that difficulty (an invalid value is ignored).
 * Any of them (or `?debug`) skips the main menu and shows the performance line for this session.
 * See docs/DEBUG.md.
 */
export interface DebugOptions {
  /** Any switch present: skip the menu and show the metrics for this session. */
  enabled: boolean;
  /**
   * A switch that changes the run itself (horde, invincibility, weapons, clock, ammo). Such a run
   * never touches the save: no records, wins or kills. `?debug` and `?difficulty=` alone do not
   * count, since they give no advantage.
   */
  assisted: boolean;
  spawn: number;
  god: boolean;
  allWeapons: boolean;
  /** `?weapons=evolved`: every weapon already evolved. */
  evolved: boolean;
  startTime: number;
  /** Starting reserve with an empty magazine, or null to keep the normal start. */
  ammo: number | null;
  /** Raw `?difficulty=` value (validated by `initialDifficulty`). */
  difficulty: string | null;
}

/** A non-negative finite number from a parameter; anything else (missing, text, NaN) is 0. */
function nonNegative(params: URLSearchParams, key: string): number {
  const n = Number(params.get(key) ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Reads the debug switches from a query string (`location.search`), each one validated. */
export function parseDebugOptions(search: string): DebugOptions {
  const params = new URLSearchParams(search);
  const spawn = Math.min(Math.floor(nonNegative(params, 'spawn')), COMBAT.maxEnemies);
  const startTime = Math.min(nonNegative(params, 't'), SHIFT.durationSeconds - 1);
  const god = params.has('god');
  const weapons = params.get('weapons');
  const evolved = weapons === 'evolved';
  const allWeapons = evolved || weapons === 'all';
  const ammo = params.has('ammo') ? Math.floor(nonNegative(params, 'ammo')) : null;
  const difficulty = params.get('difficulty');
  const assisted = spawn > 0 || god || allWeapons || startTime > 0 || ammo !== null;
  const enabled = assisted || parseDifficulty(difficulty) !== undefined || params.has('debug');
  return { enabled, assisted, spawn, god, allWeapons, evolved, startTime, ammo, difficulty };
}
