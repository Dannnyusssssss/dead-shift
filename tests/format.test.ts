import { describe, expect, it } from 'vitest';
import { formatDuration } from '../src/ui/format';

describe('formatDuration', () => {
  it('formats m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9.9)).toBe('0:09');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(600)).toBe('10:00');
  });

  it('clamps negatives', () => {
    expect(formatDuration(-3)).toBe('0:00');
  });
});
