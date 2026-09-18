import { describe, expect, it } from 'vitest';
import { describeTuning, parseTuningNames, presetsFor } from './tuning';

describe('tunings', () => {
  it('offers presets for 6 strings including drop tunings', () => {
    const names = presetsFor(6).map((p) => p.name);
    expect(names).toContain('Drop D');
    expect(names).toContain('Drop C');
    expect(names).toContain('Drop B');
  });

  it('offers presets for extended range instruments', () => {
    expect(presetsFor(7).length).toBeGreaterThan(0);
    expect(presetsFor(8).length).toBeGreaterThan(0);
  });

  it('offers bass presets for 4 and 5 strings', () => {
    expect(presetsFor(4).length).toBeGreaterThan(0);
    expect(presetsFor(5).length).toBeGreaterThan(0);
  });

  it('drop D lowers only the lowest string by a tone', () => {
    const dropD = presetsFor(6).find((p) => p.name === 'Drop D')!;
    expect(dropD.tunings).toEqual([64, 59, 55, 50, 45, 38]);
  });

  it('describes a tuning as note names, highest string first', () => {
    expect(describeTuning([64, 59, 55, 50, 45, 40])).toBe('E4 B3 G3 D3 A2 E2');
  });

  it('parses note names back into midi values', () => {
    expect(parseTuningNames(['E4', 'B3', 'G3', 'D3', 'A2', 'E2'])).toEqual([
      64, 59, 55, 50, 45, 40
    ]);
  });
});
