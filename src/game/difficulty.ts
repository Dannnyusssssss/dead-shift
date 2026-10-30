import { DIFFICULTY_IDS, type DifficultyId } from '../data/difficulty';
import type { EnemyId } from '../data/enemies';
import type { WaveEntry } from '../data/waves';

/** A difficulty id from untrusted input (URL, save), or undefined. */
export function parseDifficulty(raw: unknown): DifficultyId | undefined {
  return DIFFICULTY_IDS.find((id) => id === raw);
}

/** The one the menu starts on: the URL parameter if valid, else the last one chosen. */
export function initialDifficulty(param: string | null, saved: DifficultyId): DifficultyId {
  return parseDifficulty(param) ?? saved;
}

const startOf = (e: Readonly<WaveEntry>): number => e.minute * 60 + (e.offset ?? 0);

/**
 * The wave table with each enemy type's first appearance brought forward by `lead` (fraction of
 * its start time). The first row starts earlier, inside its own minute or in new rows that copy it
 * for the minutes in between. With `lead` 0 it returns `waves` itself, untouched.
 */
export function wavesFor(
  waves: readonly Readonly<WaveEntry>[],
  lead: number,
): readonly Readonly<WaveEntry>[] {
  if (lead <= 0) return waves;
  const out: WaveEntry[] = waves.map((e) => ({ ...e }));
  const first = new Map<EnemyId, number>();
  waves.forEach((e, i) => {
    const prev = first.get(e.enemyId);
    if (prev === undefined || startOf(e) < startOf(waves[prev] as WaveEntry))
      first.set(e.enemyId, i);
  });
  for (const i of first.values()) {
    const row = out[i] as WaveEntry;
    const start = startOf(row);
    if (start <= 0) continue;
    const early = start * (1 - lead);
    const earlyMinute = Math.floor(early / 60);
    if (earlyMinute === row.minute) {
      row.offset = early - row.minute * 60;
      continue;
    }
    for (let m = earlyMinute; m < row.minute; m++) {
      out.push({ ...row, minute: m, offset: m === earlyMinute ? early - m * 60 : 0 });
    }
    row.offset = 0;
  }
  return out;
}
