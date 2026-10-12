/**
 * Testable pieces of the batch-simulation path.
 *
 * The Web Worker itself (self.onmessage) can't run under plain vitest, but its
 * game loop is the shared runGame() in src/engine/gameRunner.ts — the same
 * function playGameWithStrategy delegates to. Pinning the loop behavior on
 * playGameWithStrategy therefore pins the worker's loop too.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SimulationJob, SimulationProgress } from '../simulationWorker';
import { playGameWithStrategy, type Strategy } from '../../engine/strategy';
import { CustomStrategyFactory } from '../../engine/customStrategyFactory';
import { GameEngine } from '../../engine/gameEngine';
import type { CustomRule } from '../../engine/customRules';
import type { Direction } from '../../engine/types';

describe('game loop termination (known bug: rejected moves spin the loop)', () => {
  // KNOWN BUG (RED): the loop is
  //   while (!gameOver && moveCount < maxMoves) {
  //     const move = strategy.selectMove(engine);
  //     if (!move) break;
  //     engine.move(move);   // <-- return value ignored
  //     moveCount++;
  //   }
  // If a (buggy or custom) strategy keeps returning a direction that
  // engine.move() rejects, the board never changes and the loop spins for all
  // 10000 iterations instead of terminating.
  // DESIRED: a rejected move terminates the game loop promptly, so the
  // strategy is only consulted about as many times as moves are applied.
  it('terminates promptly when the strategy repeatedly returns an invalid move (pins strategy.ts:471-477 and the worker copy at simulationWorker.ts:55-60)', () => {
    let selectMoveCalls = 0;
    const stubbornLeft: Strategy = {
      id: 'stubborn_left',
      name: 'Always Left',
      selectMove() {
        selectMoveCalls++;
        return 'left';
      },
    };

    const result = playGameWithStrategy('STUCK-SEED', stubbornLeft, 10000);

    // Only genuinely applied moves are recorded; once 'left' stops being
    // valid the board is frozen, so this is far below 10000.
    expect(result.moveCount).toBeLessThan(10000);

    // DESIRED: the loop stops when a move is rejected, so the strategy is
    // consulted at most once more than the number of applied moves.
    expect(
      selectMoveCalls,
      `strategy was consulted ${selectMoveCalls} times for ${result.moveCount} applied moves — loop spun on rejected moves instead of terminating`
    ).toBeLessThanOrEqual(result.moveCount + 1);
  });

  it('finishes immediately with 0 moves when the strategy returns null (passes today)', () => {
    const giveUp: Strategy = {
      id: 'give_up',
      name: 'Give Up',
      selectMove: () => null,
    };
    const result = playGameWithStrategy('NULL-SEED', giveUp, 10000);
    expect(result.moveCount).toBe(0);
    expect(result.moves).toBe('');
  });

  it('respects the maxMoves cap for a strategy that always moves validly', () => {
    const priority: Direction[] = ['left', 'down', 'right', 'up'];
    const directional: Strategy = {
      id: 'dir',
      name: 'Directional',
      selectMove: (engine: GameEngine) => priority.find(d => engine.isValidMove(d)) ?? null,
    };
    const result = playGameWithStrategy('CAP-SEED', directional, 25);
    expect(result.moveCount).toBeLessThanOrEqual(25);
  });
});

describe('worker strategy construction (CustomStrategyFactory path)', () => {
  it('builds a runnable strategy from a single pattern rule', () => {
    const rules: CustomRule[] = [
      { type: 'pattern', sequence: ['left', 'down', 'right', 'up'] },
    ];
    const strategy = CustomStrategyFactory.createFromRules(rules);
    expect(strategy.id).toBe('pattern'); // single rule returned directly

    const result = playGameWithStrategy('WORKER-CUSTOM-1', strategy);
    expect(result.moveCount).toBeGreaterThan(0);
    expect(result.moves).toMatch(/^[UDLR]+$/);
    expect(result.maxTile).toBeGreaterThanOrEqual(4);
  });

  it('folds multiple legacy rules into a single evaluation strategy', () => {
    const rules: CustomRule[] = [
      {
        type: 'conditional',
        condition: 'merge_available',
        action: ['left', 'down'],
        priority: 1,
      },
      { type: 'pattern', sequence: ['left', 'down'] },
    ];
    const strategy = CustomStrategyFactory.createFromRules(rules, 'Combo');
    expect(strategy.id).toBe('evaluation');
    expect(strategy.name).toBe('Combo');

    const result = playGameWithStrategy('WORKER-CUSTOM-2', strategy);
    expect(result.moveCount).toBeGreaterThan(0);
  });

  it('game results are serializable in the shape the worker posts', () => {
    const strategy = CustomStrategyFactory.createFromRules([
      { type: 'pattern', sequence: ['left', 'down'] },
    ]);
    const r = playGameWithStrategy('WORKER-SHAPE', strategy);
    // Mirrors the GameResult fields the worker derives from a finished game.
    expect(typeof r.moves).toBe('string');
    expect(typeof r.score).toBe('number');
    expect(typeof r.maxTile).toBe('number');
    expect(typeof r.won).toBe('boolean');
    expect(r.moveCount).toBe(r.moves.length);
  });
});


describe('actual worker message protocol', () => {
  let messages: SimulationProgress[];
  let workerScope: { onmessage: ((event: MessageEvent<SimulationJob>) => void) | null; postMessage: (message: SimulationProgress) => void };

  beforeEach(async () => {
    messages = [];
    workerScope = { onmessage: null, postMessage: (message) => messages.push(structuredClone(message)) };
    vi.stubGlobal('self', workerScope);
    vi.resetModules();
    await import('../simulationWorker');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const job = (extra: Partial<SimulationJob> = {}): SimulationJob => ({
    jobId: 'protocol-job', strategyId: 'random-1', strategyType: 'random',
    seeds: ['SAME-SEED'], batchId: 'protocol-batch', ...extra,
  });

  it('posts the first game immediately, then sends deltas without repeating any results', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    workerScope.onmessage!({ data: job({ seeds: Array.from({ length: 25 }, (_, i) => `SEED-${i}`) }) } as MessageEvent<SimulationJob>);
    expect(messages.map((message) => message.completed)).toEqual([1, 11, 21, 25]);
    expect(messages.map((message) => message.results.length)).toEqual([1, 10, 10, 4]);
    const results = messages.flatMap((message) => message.results);
    expect(new Set(results.map((result) => result.id)).size).toBe(25);
    expect(results.every((result) => result.batchId === 'protocol-batch')).toBe(true);
  });

  it('flushes slow-game results after 250ms without waiting for ten games', () => {
    let timestamp = 0;
    // Each game consumes 300ms across its start/end clock samples. The first
    // result posts immediately; subsequent games cross the 250ms threshold.
    vi.spyOn(Date, 'now').mockImplementation(() => timestamp += 150);
    workerScope.onmessage!({ data: job({ seeds: ['SLOW-1', 'SLOW-2', 'SLOW-3', 'SLOW-4'] }) } as MessageEvent<SimulationJob>);
    expect(messages.map((message) => message.completed)).toEqual([1, 2, 3, 4]);
    expect(messages.every((message) => message.results.length === 1)).toBe(true);
    expect(new Set(messages.flatMap((message) => message.results.map((result) => result.id))).size).toBe(4);
  });

  it('repeated seeded custom pattern games have identical results independent of position in a batch', () => {
    workerScope.onmessage!({ data: job({
      strategyType: 'custom', seeds: ['FIXED', 'OTHER', 'FIXED'],
      customRules: [{ type: 'pattern', sequence: ['left', 'down', 'right', 'up'] }],
    }) } as MessageEvent<SimulationJob>);
    const results = messages.flatMap((message) => message.results);
    expect(results[2].moves).toBe(results[0].moves);
    expect(results[2].finalScore).toBe(results[0].finalScore);
    expect(results[2].maxTile).toBe(results[0].maxTile);
  });

  it('fails malformed custom sequences promptly instead of spinning forever', () => {
    expect(() => workerScope.onmessage!({ data: job({
      strategyType: 'custom', customRules: [{ type: 'pattern', sequence: [] }],
    }) } as MessageEvent<SimulationJob>)).toThrow(/empty/i);
    expect(messages).toHaveLength(0);
  });

  it('rejects a custom job without rules instead of recording a zero-move loss', () => {
    expect(() => workerScope.onmessage!({ data: job({ strategyType: 'custom' }) } as MessageEvent<SimulationJob>)).toThrow(/no rules/);
  });

  it('rejects an empty job rather than silently leaving a batch running forever', () => {
    expect(() => workerScope.onmessage!({ data: job({ seeds: [] }) } as MessageEvent<SimulationJob>)).toThrow(/at least one/);
  });
});
