/**
 * Built-in strategy contracts:
 *  - selectMove returns null only when no valid moves exist
 *  - selectMove never returns an invalid direction
 * Plus pins for known bugs in LookAheadStrategy and createStrategy.
 */
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../gameEngine';
import {
  createStrategy,
  LookAheadStrategy,
  type Strategy,
} from '../strategy';
import { BoardEvaluator, DEFAULT_WEIGHTS, RuleValidator } from '../customRules';
import type { Board, Direction } from '../types';

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
    for (const corner of ['bottom-left', 'bottom-right', 'top-left', 'top-right']) {
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

  it('WeightedStrategy', () => {
    // Weighted replays the full move history per candidate move (O(n^2)),
    // so keep games short.
    const n = assertMoveContract(
      () => createStrategy('weighted', { evaluateBoard: evaluate }),
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
    expect(createStrategy('weighted').id).toBe('weighted');
    expect(createStrategy('custom').id).toBe('custom');
  });
});
