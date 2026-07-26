/**
 * BoardEvaluator / ConditionEvaluator / RuleValidator tests, including pins
 * for known condition-evaluation bugs.
 */
import { describe, expect, it } from 'vitest';
import {
  BoardEvaluator,
  ConditionEvaluator,
  DEFAULT_WEIGHTS,
  RuleValidator,
} from '../customRules';
import type { Board } from '../types';

const EMPTY: Board = [
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
];

function boardWith(cells: Array<[number, number, number]>): Board {
  const board = EMPTY.map(r => r.slice());
  for (const [row, col, value] of cells) board[row][col] = value;
  return board;
}

describe('BoardEvaluator.countEmptyTiles', () => {
  it('counts 16 on an empty board', () => {
    expect(BoardEvaluator.countEmptyTiles(EMPTY)).toBe(16);
  });

  it('counts 0 on a full board', () => {
    const full: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(BoardEvaluator.countEmptyTiles(full)).toBe(0);
  });

  it('counts mixed boards correctly', () => {
    expect(BoardEvaluator.countEmptyTiles(boardWith([[0, 0, 2], [3, 3, 4]]))).toBe(14);
  });
});

describe('BoardEvaluator.getMaxTile', () => {
  it('finds the max tile and its position', () => {
    const board = boardWith([[1, 2, 64], [3, 0, 8]]);
    expect(BoardEvaluator.getMaxTile(board)).toEqual({ value: 64, row: 1, col: 2 });
  });
});

describe('BoardEvaluator.countMerges', () => {
  it('counts adjacent horizontal pairs', () => {
    expect(BoardEvaluator.countMerges(boardWith([[0, 0, 2], [0, 1, 2]]))).toBe(1);
  });

  it('counts adjacent vertical pairs', () => {
    expect(BoardEvaluator.countMerges(boardWith([[0, 0, 4], [1, 0, 4]]))).toBe(1);
  });

  it('ignores zeros (no empty-empty "merges")', () => {
    expect(BoardEvaluator.countMerges(EMPTY)).toBe(0);
  });

  // Gap case: [2, 0, 2] in a row. Sliding left or right DOES merge these two
  // tiles, so a merge is available on the board. The current implementation
  // only counts directly adjacent pairs and misses tiles separated by empty
  // cells. DESIRED: a pair separated only by empties counts as a potential
  // merge (this pins the "potential merges available" contract; expected to
  // FAIL until countMerges looks through gaps).
  it('counts a pair separated by an empty cell ([2,0,2] gap case)', () => {
    const board = boardWith([[0, 0, 2], [0, 2, 2]]); // row 0: [2, 0, 2, 0]
    expect(BoardEvaluator.countMerges(board)).toBe(1);
  });
});

describe('BoardEvaluator.isMaxTileInSpecificCorner', () => {
  const corners = [
    ['top-left', 0, 0],
    ['top-right', 0, 3],
    ['bottom-left', 3, 0],
    ['bottom-right', 3, 3],
  ] as const;

  it.each(corners)('%s: true when max tile is there, false elsewhere', (corner, row, col) => {
    const board = boardWith([[row, col, 128], [1, 1, 2]]);
    expect(BoardEvaluator.isMaxTileInSpecificCorner(board, corner)).toBe(true);
    for (const [other] of corners) {
      if (other !== corner) {
        expect(BoardEvaluator.isMaxTileInSpecificCorner(board, other)).toBe(false);
      }
    }
  });

  it('is false for all corners when max tile is in the middle', () => {
    const board = boardWith([[1, 2, 128]]);
    for (const [corner] of corners) {
      expect(BoardEvaluator.isMaxTileInSpecificCorner(board, corner)).toBe(false);
    }
  });

  // KNOWN BUG (RED): an invalid corner parameter falls off the end of the
  // switch and returns undefined. DESIRED: return false for unknown corners.
  it('returns false (not undefined) for an invalid corner param', () => {
    const board = boardWith([[0, 0, 128]]);
    expect(
      BoardEvaluator.isMaxTileInSpecificCorner(board, 'center' as any)
    ).toBe(false);
  });
});

describe('BoardEvaluator monotonicity and smoothness', () => {
  const snake: Board = [
    [2, 4, 8, 16],
    [256, 128, 64, 32],
    [512, 1024, 2048, 4096],
    [65536, 32768, 16384, 8192],
  ];
  const scrambled: Board = [
    [16, 2, 512, 4],
    [2, 4096, 8, 32768],
    [1024, 32, 65536, 64],
    [4, 8192, 2, 256],
  ];

  it('scores a snake board higher than a scrambled board', () => {
    expect(BoardEvaluator.calculateMonotonicity(snake)).toBeGreaterThan(
      BoardEvaluator.calculateMonotonicity(scrambled)
    );
  });

  it('a fully monotonic board reaches the maximum row score contribution', () => {
    // Each of the 4 rows in the snake is strictly monotonic: 3 ordered pairs each.
    // Row contribution alone is 12; columns add more, so total >= 12.
    expect(BoardEvaluator.calculateMonotonicity(snake)).toBeGreaterThanOrEqual(12);
  });

  it('smoothness is 0 for a uniform board and negative for a rough one', () => {
    const uniform: Board = [
      [2, 2, 2, 2],
      [2, 2, 2, 2],
      [2, 2, 2, 2],
      [2, 2, 2, 2],
    ];
    expect(BoardEvaluator.calculateSmoothness(uniform)).toBe(0);
    expect(BoardEvaluator.calculateSmoothness(snake)).toBeLessThan(0);
  });
});

describe('BoardEvaluator.evaluateBoard', () => {
  it('is finite on an all-zero board (no -Infinity from log2(0))', () => {
    expect(Number.isFinite(BoardEvaluator.evaluateBoard(EMPTY, DEFAULT_WEIGHTS))).toBe(true);
  });

  it('rewards empty tiles', () => {
    const oneTile = boardWith([[0, 0, 2]]);
    const manyTiles = boardWith([[0, 0, 2], [1, 1, 4], [2, 2, 8], [3, 3, 16], [0, 2, 32]]);
    const weights = { ...DEFAULT_WEIGHTS, maxTileValue: 0, maxTileCorner: 0, mergeCount: 0, monotonicity: 0, smoothness: 0 };
    expect(BoardEvaluator.evaluateBoard(oneTile, weights)).toBeGreaterThan(
      BoardEvaluator.evaluateBoard(manyTiles, weights)
    );
  });
});

describe('ConditionEvaluator', () => {
  it('max_tile_in_corner with and without a specific corner', () => {
    const board = boardWith([[3, 0, 128], [1, 1, 2]]);
    expect(ConditionEvaluator.evaluate(board, 'max_tile_in_corner')).toBe(true);
    expect(ConditionEvaluator.evaluate(board, 'max_tile_in_corner', { corner: 'bottom-left' })).toBe(true);
    expect(ConditionEvaluator.evaluate(board, 'max_tile_in_corner', { corner: 'top-right' })).toBe(false);
  });

  it('max_tile_on_edge', () => {
    expect(ConditionEvaluator.evaluate(boardWith([[0, 2, 64]]), 'max_tile_on_edge')).toBe(true);
    expect(ConditionEvaluator.evaluate(boardWith([[1, 2, 64]]), 'max_tile_on_edge')).toBe(false);
  });

  it('empty_cells_count honors an explicit threshold, including 0', () => {
    const full: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(ConditionEvaluator.evaluate(full, 'empty_cells_count', { threshold: 0 })).toBe(true); // 0 >= 0
    expect(ConditionEvaluator.evaluate(full, 'empty_cells_count', { threshold: 1 })).toBe(false);
    expect(ConditionEvaluator.evaluate(EMPTY, 'empty_cells_count', { threshold: 16 })).toBe(true);
  });

  it('merge_available', () => {
    expect(ConditionEvaluator.evaluate(boardWith([[0, 0, 2], [0, 1, 2]]), 'merge_available')).toBe(true);
    expect(ConditionEvaluator.evaluate(boardWith([[0, 0, 2], [0, 1, 4]]), 'merge_available')).toBe(false);
  });

  // KNOWN BUG (RED): customRules.ts:295-303 — monotonic_rows and
  // monotonic_cols run IDENTICAL code (both use the combined row+column
  // monotonicity score), so they can never disagree.
  // DESIRED: on a board whose rows are all strictly monotonic but whose
  // columns are not, monotonic_rows is true and monotonic_cols is false.
  it('monotonic_rows and monotonic_cols are distinguishable (pins customRules.ts:295-303)', () => {
    // Every row strictly monotonic; every column alternates (not monotonic).
    const rowsOnly: Board = [
      [2, 4, 8, 16],
      [16, 8, 4, 2],
      [2, 4, 8, 16],
      [16, 8, 4, 2],
    ];
    const rowsResult = ConditionEvaluator.evaluate(rowsOnly, 'monotonic_rows');
    const colsResult = ConditionEvaluator.evaluate(rowsOnly, 'monotonic_cols');
    expect(rowsResult).toBe(true);
    expect(colsResult).toBe(false);
  });

  // KNOWN BUG (RED): customRules.ts:297 uses `params?.threshold || 12`, so a
  // caller-provided threshold of 0 is discarded and replaced by 12.
  // DESIRED: threshold 0 means "any monotonicity > 0 passes".
  it('monotonic_rows honors an explicit threshold of 0 (pins customRules.ts:297 || fallback)', () => {
    // Exactly one ordered pair (2,4) => monotonicity score 1.
    const slightlyMonotonic = boardWith([[0, 0, 2], [0, 1, 4]]);
    expect(
      ConditionEvaluator.evaluate(slightlyMonotonic, 'monotonic_rows', { threshold: 0 })
    ).toBe(true);
  });

  it('returns false for an unknown condition type', () => {
    expect(ConditionEvaluator.evaluate(EMPTY, 'nonsense' as any)).toBe(false);
  });
});

describe('RuleValidator', () => {
  it('accepts a valid pattern rule and rejects empty/invalid sequences', () => {
    expect(RuleValidator.validatePatternRule({ type: 'pattern', sequence: ['left', 'down'] })).toBeNull();
    expect(RuleValidator.validatePatternRule({ type: 'pattern', sequence: [] })).not.toBeNull();
    expect(
      RuleValidator.validatePatternRule({ type: 'pattern', sequence: ['diagonal' as any] })
    ).not.toBeNull();
  });

  it('validates conditional rules', () => {
    expect(
      RuleValidator.validateConditionalRule({
        type: 'conditional',
        condition: 'merge_available',
        action: ['left'],
        priority: 1,
      })
    ).toBeNull();
    expect(
      RuleValidator.validateConditionalRule({
        type: 'conditional',
        condition: 'merge_available',
        action: [],
        priority: 1,
      })
    ).not.toBeNull();
  });

  it('rejects out-of-range lookahead depths', () => {
    expect(
      RuleValidator.validateLookAheadRule({ type: 'lookahead', depth: 0, evaluationWeights: DEFAULT_WEIGHTS })
    ).not.toBeNull();
    expect(
      RuleValidator.validateLookAheadRule({ type: 'lookahead', depth: 6, evaluationWeights: DEFAULT_WEIGHTS })
    ).not.toBeNull();
  });

  it('routes validateRule by type and rejects unknown types', () => {
    expect(RuleValidator.validateRule({ type: 'weighted', weights: DEFAULT_WEIGHTS })).toBeNull();
    expect(RuleValidator.validateRule({ type: 'bogus' } as any)).toBe('Unknown rule type');
  });
});
