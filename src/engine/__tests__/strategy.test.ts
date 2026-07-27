/**
 * Built-in strategy contracts:
 *  - selectMove returns null only when no valid moves exist
 *  - selectMove never returns an invalid direction
 * Plus pins for known bugs in LookAheadStrategy and createStrategy.
 */
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../gameEngine';
import {
  ConditionalStrategy,
  CornerAnchorStrategy,
  createStrategy,
  DirectionalPriorityStrategy,
  LookAheadStrategy,
  MergeMaxStrategy,
  type Strategy,
} from '../strategy';
import { BoardEvaluator, DEFAULT_WEIGHTS, RuleValidator } from '../customRules';
import type { Board, Direction } from '../types';

/**
 * Force a specific board position onto an engine. The engine exposes no
 * board-injection API, so this reaches into private state (same deliberate
 * pattern as gameEngine.test.ts).
 */
function engineWithBoard(board: Board): GameEngine {
  const engine = new GameEngine('INJECT-SEED');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const internal = (engine as any).state;
  internal.board = board.map(r => r.slice());
  internal.maxTile = Math.max(...board.flat());
  return engine;
}

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

const evaluate = (board: Board) =>
  BoardEvaluator.evaluateBoard(board, DEFAULT_WEIGHTS);

/**
 * Drive a real game with the strategy, asserting the move contract at every
 * board state. Returns the number of board states checked.
 */
function assertMoveContract(
  makeStrategy: () => Strategy,
  seeds: string[],
  maxStepsPerGame: number
): number {
  let statesChecked = 0;
  for (const seed of seeds) {
    const strategy = makeStrategy();
    const engine = new GameEngine(seed);
    for (let step = 0; step < maxStepsPerGame; step++) {
      if (engine.getState().gameOver) break;
      const move = strategy.selectMove(engine);
      statesChecked++;
      if (move === null) {
        expect(engine.getValidMoves(), `${seed} step ${step}: null returned while moves exist`).toEqual([]);
        break;
      }
      expect(DIRECTIONS, `${seed} step ${step}`).toContain(move);
      expect(engine.isValidMove(move), `${seed} step ${step}: strategy returned invalid move ${move}`).toBe(true);
      engine.move(move);
    }
  }
  return statesChecked;
}

const CHEAP_SEEDS = ['STRAT-A', 'STRAT-B', 'STRAT-C'];

describe('strategy move contract (valid or null-only-when-stuck)', () => {
  it('DirectionalPriorityStrategy', () => {
    const n = assertMoveContract(() => createStrategy('directional_priority'), CHEAP_SEEDS, 100);
    expect(n).toBeGreaterThanOrEqual(200);
  });

  it('CornerAnchorStrategy (all four corners)', () => {
    let n = 0;
    for (const corner of ['bottom-left', 'bottom-right', 'top-left', 'top-right'] as const) {
      n += assertMoveContract(() => createStrategy('corner_anchor', { corner }), CHEAP_SEEDS.slice(0, 2), 60);
    }
    expect(n).toBeGreaterThanOrEqual(200);
  });

  it('MergeMaxStrategy', () => {
    const n = assertMoveContract(() => createStrategy('merge_max'), CHEAP_SEEDS, 100);
    expect(n).toBeGreaterThanOrEqual(200);
  });

  it('RandomStrategy', () => {
    // Nondeterministic move choice, but the contract must hold on every state.
    const n = assertMoveContract(() => createStrategy('random'), CHEAP_SEEDS, 100);
    expect(n).toBeGreaterThanOrEqual(200);
  });

  it('PatternStrategy', () => {
    const n = assertMoveContract(
      () => createStrategy('pattern', { pattern: ['left', 'down', 'right', 'up'] }),
      CHEAP_SEEDS,
      100
    );
    expect(n).toBeGreaterThanOrEqual(200);
  });

  it('ConditionalStrategy (empty rules falls back to directional priority)', () => {
    const n = assertMoveContract(() => createStrategy('conditional', { rules: [] }), CHEAP_SEEDS, 100);
    expect(n).toBeGreaterThanOrEqual(200);
  });

  it('EvaluationStrategy (depth 1, replaces WeightedStrategy)', () => {
    const n = assertMoveContract(
      () => createStrategy('evaluation'),
      CHEAP_SEEDS.slice(0, 2),
      40
    );
    expect(n).toBeGreaterThanOrEqual(80);
  });

  it('LookAheadStrategy (depth 1)', () => {
    const n = assertMoveContract(
      () => createStrategy('lookahead', { depth: 1, evaluateBoard: evaluate }),
      CHEAP_SEEDS.slice(0, 2),
      40
    );
    expect(n).toBeGreaterThanOrEqual(80);
  });

  it('CustomStrategy container delegates to sub-strategies', () => {
    const n = assertMoveContract(
      () =>
        createStrategy('custom', {
          strategies: [
            createStrategy('merge_max'),
            createStrategy('directional_priority'),
          ],
        }),
      CHEAP_SEEDS,
      100
    );
    expect(n).toBeGreaterThanOrEqual(200);
  });
});

describe('CornerAnchorStrategy corner-keeping (simulated, not just priority order)', () => {
  // Board where directional priority and genuine corner-keeping diverge for
  // a bottom-left anchor (max 16 at [3][0]):
  //   - 'left' and 'down' are invalid (rows packed left, columns packed down)
  //   - 'right' is valid but shifts the bottom row right, evicting the max
  //     tile from the corner
  //   - 'up' is valid (col 1's lone 2 slides up) and leaves col 0 untouched,
  //     keeping the max tile in the corner
  const cornerBoard: Board = [
    [2, 0, 0, 0],
    [4, 0, 0, 0],
    [8, 0, 0, 0],
    [16, 2, 0, 0],
  ];

  it('picks a move verified to keep the max tile in the corner over raw priority order', () => {
    const anchor = new CornerAnchorStrategy('bottom-left');
    const engine = engineWithBoard(cornerBoard);
    expect(engine.getValidMoves().sort()).toEqual(['right', 'up']);
    expect(anchor.selectMove(engine)).toBe('up');
  });

  it('behaves differently from DirectionalPriorityStrategy on the same board', () => {
    const directional = new DirectionalPriorityStrategy(); // left > down > right > up
    expect(directional.selectMove(engineWithBoard(cornerBoard))).toBe('right');

    const anchor = new CornerAnchorStrategy('bottom-left');
    expect(anchor.selectMove(engineWithBoard(cornerBoard))).toBe('up');
  });

  it('falls back to priority order when no corner-safe move exists', () => {
    // Left and down are invalid (everything packed bottom-left, no merges).
    // The only valid moves — 'up' (col 0 slides up, corner empties) and
    // 'right' (bottom row slides right) — both evict the max tile from the
    // corner, so the strategy must fall back to plain priority order
    // (left > down > right > up for bottom-left) and return 'right', not null.
    const board: Board = [
      [0, 0, 0, 0],
      [2, 0, 0, 0],
      [4, 0, 0, 0],
      [16, 0, 0, 0],
    ];
    const anchor = new CornerAnchorStrategy('bottom-left');
    const engine = engineWithBoard(board);
    expect(engine.getValidMoves().sort()).toEqual(['right', 'up']);
    expect(anchor.selectMove(engine)).toBe('right');
  });
});

describe('MergeMaxStrategy real-merge scoring (simulated, not adjacency counts)', () => {
  it('prefers the move with the highest actual merge points, including gapped merges', () => {
    // col 0 holds an adjacent 2,2 pair (merge worth 4 points, up or down).
    // Row 3 holds a GAPPED 8,_,8 pair (merge worth 16 points, left or right)
    // that naive adjacency counting misses entirely — the old implementation
    // scored up/down at 1 pair and left/right at 0 pairs and picked 'up'.
    // Real simulation scores up/down at 4 points and left/right at 16.
    const board: Board = [
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [8, 0, 8, 0],
    ];
    const strategy = new MergeMaxStrategy();
    expect(strategy.selectMove(engineWithBoard(board))).toBe('left');
  });

  it('picks down over up when up is invalid (down beats up)', () => {
    // Note: when BOTH vertical moves are valid, their merge scores are always
    // equal (per-line merge points are direction-symmetric in 2048), so
    // "down strictly beats up" requires up to be invalid. Here every column
    // is packed to the top with no vertical merges (up invalid), rows are
    // packed left with no horizontal merges (left invalid), and down/right
    // are valid with 0 merge points — down wins the tie by direction order.
    const board: Board = [
      [2, 4, 0, 0],
      [4, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const strategy = new MergeMaxStrategy();
    const engine = engineWithBoard(board);
    expect(engine.isValidMove('up')).toBe(false);
    expect(engine.isValidMove('down')).toBe(true);
    expect(strategy.selectMove(engine)).toBe('down');
  });
});

describe('ConditionalStrategy rules array handling', () => {
  it('does not reorder the caller\'s rules array in place', () => {
    const rules = [
      { condition: () => false, actions: ['left'] as Direction[], priority: 1 },
      { condition: () => false, actions: ['down'] as Direction[], priority: 9 },
      { condition: () => false, actions: ['right'] as Direction[], priority: 5 },
    ];
    const originalOrder = [...rules];

    new ConditionalStrategy(rules);

    expect(rules).toEqual(originalOrder);
    expect(rules.map(r => r.priority)).toEqual([1, 9, 5]);
  });
});

describe('LookAheadStrategy scoring (known bug: averages instead of best outcome)', () => {
  // KNOWN BUG (RED): strategy.ts:339-346 averages the recursive scores of all
  // follow-up moves. DESIRED: since the player chooses the follow-up move, the
  // strategy must credit each candidate move with the BEST reachable outcome
  // (max over follow-ups), not the average.
  //
  // The reference computation below mirrors the strategy's own simulation
  // exactly (fresh engine per line, seed replay, same direction order and
  // strict-> tie-breaking), computing both the argmax-of-average and the
  // argmax-of-max first move. We search seeds until the two disagree
  // (seed 'LA-4' is known to diverge: avg picks left, max picks right),
  // then require the strategy to make the max-based choice.
  it('picks the move whose best follow-up outcome is highest (pins strategy.ts:339-346)', () => {
    let divergentSeed: string | null = null;
    let avgChoice: Direction | null = null;
    let maxChoice: Direction | null = null;

    for (let i = 0; i < 3000 && !divergentSeed; i++) {
      const seed = `LA-${i}`;
      const root = new GameEngine(seed);
      let bestAvgDir: Direction | null = null;
      let bestAvg = -Infinity;
      let bestMaxDir: Direction | null = null;
      let bestMax = -Infinity;

      for (const d of DIRECTIONS) {
        if (!root.isValidMove(d)) continue;
        const afterFirst = new GameEngine(seed);
        afterFirst.move(d);

        let total = 0;
        let count = 0;
        let best = -Infinity;
        for (const d2 of DIRECTIONS) {
          if (!afterFirst.isValidMove(d2)) continue;
          const afterSecond = new GameEngine(seed);
          afterSecond.move(d);
          afterSecond.move(d2);
          const s = evaluate(afterSecond.getState().board);
          total += s;
          count++;
          if (s > best) best = s;
        }
        const leaf = evaluate(afterFirst.getState().board);
        const avgScore = count > 0 ? total / count : leaf;
        const maxScore = count > 0 ? best : leaf;
        if (avgScore > bestAvg) { bestAvg = avgScore; bestAvgDir = d; }
        if (maxScore > bestMax) { bestMax = maxScore; bestMaxDir = d; }
      }

      if (bestAvgDir && bestMaxDir && bestAvgDir !== bestMaxDir) {
        divergentSeed = seed;
        avgChoice = bestAvgDir;
        maxChoice = bestMaxDir;
      }
    }

    // A divergent position must exist within the scanned seeds.
    expect(divergentSeed).not.toBeNull();
    expect(avgChoice).not.toBe(maxChoice);

    const strategy = new LookAheadStrategy(2, evaluate);
    const picked = strategy.selectMove(new GameEngine(divergentSeed!));

    // DESIRED: the strategy makes the best-outcome (max) choice.
    expect(
      picked,
      `seed ${divergentSeed}: strategy picked the average-based move (${avgChoice}) instead of the best-outcome move (${maxChoice})`
    ).toBe(maxChoice);
  });

  // KNOWN BUG (RED): customRules.ts:349 validates depth 1-5 as legal, but
  // LookAheadStrategy (strategy.ts:288) silently clamps depth to 1-3. A user
  // configuring depth 5 passes validation yet runs at depth 3.
  // DESIRED: the validator and the strategy agree — every depth the validator
  // accepts must be honored by the strategy (or the validator must reject it).
  it('RuleValidator and LookAheadStrategy agree on supported depths (pins customRules.ts:349 vs strategy.ts:288)', () => {
    for (const depth of [1, 2, 3, 4, 5]) {
      const accepted =
        RuleValidator.validateLookAheadRule({
          type: 'lookahead',
          depth,
          evaluationWeights: DEFAULT_WEIGHTS,
        }) === null;

      const strategy = new LookAheadStrategy(depth, evaluate);
      const honored = (strategy as any).depth === depth;

      expect(
        honored,
        `depth ${depth}: validator accepted=${accepted}, but strategy runs at depth ${(strategy as any).depth}`
      ).toBe(accepted);
    }
  });
});

describe('createStrategy factory (known bug: silent fallback)', () => {
  // KNOWN BUG (RED): strategy.ts:449 default-cases to DirectionalPriority.
  // DESIRED: an unknown strategy type is a programming error and must throw,
  // not silently simulate a different strategy.
  it('throws for an unknown strategy type (pins strategy.ts:449 silent default)', () => {
    expect(() => createStrategy('nonexistent_type')).toThrow();
  });

  it('creates every known strategy type', () => {
    expect(createStrategy('directional_priority').id).toBe('directional_priority');
    expect(createStrategy('corner_anchor').id).toBe('corner_anchor');
    expect(createStrategy('merge_max').id).toBe('merge_max');
    expect(createStrategy('random').id).toBe('random');
    expect(createStrategy('pattern').id).toBe('pattern');
    expect(createStrategy('conditional').id).toBe('conditional');
    expect(createStrategy('lookahead').id).toBe('lookahead');
    expect(createStrategy('evaluation').id).toBe('evaluation');
    expect(createStrategy('custom').id).toBe('custom');
  });
});
