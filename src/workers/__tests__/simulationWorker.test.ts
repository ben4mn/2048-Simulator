/**
 * Testable pieces of the batch-simulation path.
 *
 * The Web Worker itself (self.onmessage) can't run under plain vitest, but its
 * game loop (src/workers/simulationWorker.ts:55-60) is a byte-for-byte
 * duplicate of the loop in playGameWithStrategy (src/engine/strategy.ts:471-477).
 * We pin the desired loop behavior on the exported playGameWithStrategy;
 * whatever fix lands there must also land in the worker's inline copy (or the
 * worker should be refactored to call the shared function).
 */
import { describe, expect, it } from 'vitest';
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

  it('wraps multiple rules in a CustomStrategy container', () => {
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
    expect(strategy.id).toBe('custom');
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
