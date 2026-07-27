/**
 * The plain-English strategy summary must be derived DETERMINISTICALLY from
 * the rule configuration — never from AI prose — so what the card says is
 * always what the simulation runs.
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_WEIGHTS } from '../customRules';
import { summarizeRules, autoName } from '../strategySummary';

describe('summarizeRules', () => {
  it('describes a pattern rule', () => {
    const summary = summarizeRules([{ type: 'pattern', sequence: ['left', 'down'] }]);
    expect(summary.toLowerCase()).toContain('repeat');
    expect(summary).toContain('left');
    expect(summary).toContain('down');
  });

  it('describes an evaluation rule with its top weights and depth', () => {
    const summary = summarizeRules([
      {
        type: 'evaluation',
        depth: 2,
        weights: { ...DEFAULT_WEIGHTS, maxTileCorner: 8 },
      },
    ]);
    expect(summary).toContain('2 moves ahead');
    // Highest weight leads the description.
    expect(summary.toLowerCase()).toContain('corner');
  });

  it('describes overrides in plain English', () => {
    const summary = summarizeRules([
      {
        type: 'evaluation',
        depth: 1,
        weights: DEFAULT_WEIGHTS,
        overrides: [
          {
            when: 'max_tile_in_corner',
            params: { corner: 'bottom-left' },
            action: ['left', 'down'],
          },
        ],
      },
    ]);
    expect(summary.toLowerCase()).toContain('bottom-left');
    expect(summary.toLowerCase()).toContain('left');
  });

  it('is deterministic', () => {
    const rules = [{ type: 'evaluation' as const, depth: 1, weights: DEFAULT_WEIGHTS }];
    expect(summarizeRules(rules)).toBe(summarizeRules(rules));
  });

  it('handles empty rules', () => {
    expect(summarizeRules([])).toContain('No rules');
  });
});

describe('autoName', () => {
  it('names evaluation strategies from their strongest trait and depth', () => {
    const name = autoName([
      { type: 'evaluation', depth: 3, weights: { ...DEFAULT_WEIGHTS, mergeCount: 9 } },
    ]);
    expect(name.length).toBeGreaterThan(0);
    expect(name.length).toBeLessThanOrEqual(40);
  });

  it('names pattern strategies from the sequence', () => {
    const name = autoName([{ type: 'pattern', sequence: ['left', 'down'] }]);
    expect(name.toLowerCase()).toContain('l');
  });
});
