/**
 * GameEngine slide/merge correctness, game-over detection, win detection,
 * and initial-state maxTile reporting.
 *
 * Note on private access: the engine exposes no board-injection API, so these
 * tests reach into private members via `as any` casts. This is deliberate —
 * the alternative (playing seeded games until a wanted board appears) would be
 * far more brittle.
 */
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../gameEngine';
import type { Board, Direction, MoveResult } from '../types';

/** Access the private performMove without mutating engine state. */
function performMove(board: Board, direction: Direction): MoveResult {
  const engine = new GameEngine('TEST-SEED') as any;
  return engine.performMove(board, direction);
}

function hasValidMoves(board: Board): boolean {
  const engine = new GameEngine('TEST-SEED') as any;
  return engine.hasValidMoves(board);
}

/** Build a board from a single row (rest empty). */
function rowBoard(row: number[]): Board {
  return [row.slice(), [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
}

/** Build a board from a single column (rest empty). */
function colBoard(col: number[]): Board {
  return col.map(v => [v, 0, 0, 0]);
}

describe('GameEngine slide and merge (left)', () => {
  // [input row, expected row after left, expected merge score, expected moved]
  const cases: Array<[number[], number[], number, boolean]> = [
    [[2, 2, 2, 2], [4, 4, 0, 0], 8, true],
    [[4, 2, 2, 4], [4, 4, 4, 0], 4, true],
    [[2, 0, 2, 0], [4, 0, 0, 0], 4, true],
    [[2, 4, 2, 4], [2, 4, 2, 4], 0, false],
    [[0, 0, 0, 2], [2, 0, 0, 0], 0, true],
    [[0, 0, 0, 0], [0, 0, 0, 0], 0, false],
    [[8, 8, 16, 0], [16, 16, 0, 0], 16, true],
    [[2, 2, 4, 4], [4, 8, 0, 0], 12, true],
  ];

  it.each(cases)(
    'left on %j gives %j with score %i (moved=%s)',
    (input, expected, score, moved) => {
      const result = performMove(rowBoard(input), 'left');
      expect(result.board[0]).toEqual(expected);
      expect(result.score).toBe(score);
      expect(result.moved).toBe(moved);
      // Other rows untouched
      expect(result.board.slice(1)).toEqual([
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
    }
  );

  it('does not mutate the input board', () => {
    const board = rowBoard([2, 2, 2, 2]);
    performMove(board, 'left');
    expect(board[0]).toEqual([2, 2, 2, 2]);
  });
});

describe('GameEngine slide and merge (all four directions)', () => {
  it('right: [2,2,2,2] row becomes [0,0,4,4] with score 8', () => {
    const result = performMove(rowBoard([2, 2, 2, 2]), 'right');
    expect(result.board[0]).toEqual([0, 0, 4, 4]);
    expect(result.score).toBe(8);
    expect(result.moved).toBe(true);
  });

  it('right merges the rightmost pair first: [4,2,2,4] becomes [0,4,4,4]', () => {
    const result = performMove(rowBoard([4, 2, 2, 4]), 'right');
    expect(result.board[0]).toEqual([0, 4, 4, 4]);
    expect(result.score).toBe(4);
  });

  it('up: [2,2,2,2] column becomes [4,4,0,0] with score 8', () => {
    const result = performMove(colBoard([2, 2, 2, 2]), 'up');
    expect(result.board.map(r => r[0])).toEqual([4, 4, 0, 0]);
    expect(result.score).toBe(8);
    expect(result.moved).toBe(true);
  });

  it('down: [2,2,2,2] column becomes [0,0,4,4] with score 8', () => {
    const result = performMove(colBoard([2, 2, 2, 2]), 'down');
    expect(result.board.map(r => r[0])).toEqual([0, 0, 4, 4]);
    expect(result.score).toBe(8);
    expect(result.moved).toBe(true);
  });

  it('down merges the bottommost pair first: column [4,2,2,4] becomes [0,4,4,4]', () => {
    const result = performMove(colBoard([4, 2, 2, 4]), 'down');
    expect(result.board.map(r => r[0])).toEqual([0, 4, 4, 4]);
    expect(result.score).toBe(4);
  });

  it('up on an already-packed distinct column does not move', () => {
    const result = performMove(colBoard([2, 4, 8, 16]), 'up');
    expect(result.moved).toBe(false);
    expect(result.board.map(r => r[0])).toEqual([2, 4, 8, 16]);
  });
});

describe('GameEngine game-over detection', () => {
  const fullNoMerges: Board = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ];

  it('full board with no adjacent equal tiles has no valid moves', () => {
    expect(hasValidMoves(fullNoMerges)).toBe(false);
  });

  it('full board with one adjacent equal pair still has a valid move', () => {
    const board: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 2, 8], // adjacent 2,2 pair
    ];
    expect(hasValidMoves(board)).toBe(true);
  });

  it('board with an empty cell always has a valid move', () => {
    const board: Board = [
      [0, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(hasValidMoves(board)).toBe(true);
  });

  it('move() returns false and records nothing on a dead board', () => {
    const engine = new GameEngine('DEAD-BOARD');
    (engine as any).state.board = fullNoMerges.map(r => r.slice());
    for (const dir of ['up', 'down', 'left', 'right'] as Direction[]) {
      expect(engine.move(dir)).toBe(false);
    }
    expect(engine.getState().moves).toEqual([]);
  });

  it('a full deterministic game ends with gameOver=true and no valid moves', () => {
    const engine = new GameEngine('ENDGAME-1');
    // Simple deterministic policy: first valid of L > D > R > U
    const priority: Direction[] = ['left', 'down', 'right', 'up'];
    let guard = 20000;
    while (!engine.getState().gameOver && guard-- > 0) {
      const dir = priority.find(d => engine.isValidMove(d));
      expect(dir).toBeDefined();
      engine.move(dir!);
    }
    expect(engine.getState().gameOver).toBe(true);
    expect(engine.getValidMoves()).toEqual([]);
  });
});

describe('GameEngine win detection', () => {
  it('sets won=true and maxTile=2048 when two 1024 tiles merge', () => {
    const engine = new GameEngine('WIN-SEED');
    (engine as any).state.board = [
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const before = engine.getState();
    expect(before.won).toBe(false);

    expect(engine.move('left')).toBe(true);
    const state = engine.getState();
    expect(state.board[0][0]).toBe(2048);
    expect(state.won).toBe(true);
    expect(state.maxTile).toBe(2048);
    expect(state.score).toBe(2048);
    expect(state.gameOver).toBe(false);
  });
});

describe('GameEngine initial state', () => {
  it('spawns exactly two tiles, each 2 or 4', () => {
    for (let i = 0; i < 50; i++) {
      const board = new GameEngine(`INIT-${i}`).getState().board;
      const tiles = board.flat().filter(v => v !== 0);
      expect(tiles).toHaveLength(2);
      for (const t of tiles) expect([2, 4]).toContain(t);
    }
  });

  it('starts with score 0, no moves, not over, not won', () => {
    const state = new GameEngine('INIT-STATE').getState();
    expect(state.score).toBe(0);
    expect(state.moves).toEqual([]);
    expect(state.gameOver).toBe(false);
    expect(state.won).toBe(false);
  });

  // KNOWN BUG (RED): gameEngine.ts:33 hardcodes `maxTile: 2` in the initial
  // state, but the opening spawns can include a 4 (10% chance each).
  // Seed 'SCAN-0' was found by the scan below to open with a 4 on the board.
  it('reports the actual max spawned tile in the initial state (pins gameEngine.ts:33 hardcoded 2)', () => {
    // Programmatically find a seed whose opening board contains a 4.
    let found: GameEngine | null = null;
    for (let i = 0; i < 1000 && !found; i++) {
      const engine = new GameEngine(`SCAN-${i}`);
      const actualMax = Math.max(...engine.getState().board.flat());
      if (actualMax === 4) found = engine;
    }
    expect(found).not.toBeNull(); // a 4-opening seed must exist in 1000 tries
    const state = found!.getState();
    const actualMax = Math.max(...state.board.flat());
    expect(actualMax).toBe(4);
    // DESIRED: getState().maxTile reflects the board, not a hardcoded 2.
    expect(state.maxTile).toBe(4);
  });
});

describe('GameEngine.clone()', () => {
  const applyMoves = (engine: GameEngine, dirs: Direction[]) => {
    for (const d of dirs) engine.move(d);
  };

  /** Drive both engines with the same greedy policy and compare every step. */
  const playIdentically = (a: GameEngine, b: GameEngine, steps: number) => {
    const priority: Direction[] = ['left', 'down', 'right', 'up'];
    for (let i = 0; i < steps; i++) {
      const dir = priority.find(d => a.isValidMove(d));
      if (!dir) break;
      const movedA = a.move(dir);
      const movedB = b.move(dir);
      expect(movedB).toBe(movedA);
      expect(b.getState().board).toEqual(a.getState().board);
      expect(b.getState().score).toBe(a.getState().score);
    }
  };

  it('clone starts with identical state (board, score, moves, flags, seed)', () => {
    const engine = new GameEngine('CLONE-01');
    applyMoves(engine, ['left', 'down', 'left', 'right', 'up', 'down']);

    const clone = engine.clone();
    expect(clone.getSeed()).toBe(engine.getSeed());
    expect(clone.getState()).toEqual(engine.getState());
  });

  it('clone preserves the RNG stream position: same subsequent moves produce identical spawns', () => {
    const engine = new GameEngine('CLONE-02');
    applyMoves(engine, ['left', 'down', 'right', 'down', 'left']);

    const clone = engine.clone();
    playIdentically(engine, clone, 50);
  });

  it('mutating the clone never affects the original', () => {
    const engine = new GameEngine('CLONE-03');
    applyMoves(engine, ['left', 'down']);
    const before = engine.getState();

    const clone = engine.clone();
    applyMoves(clone, ['left', 'down', 'right', 'up', 'left', 'down']);

    const after = engine.getState();
    expect(after.board).toEqual(before.board);
    expect(after.score).toBe(before.score);
    expect(after.moves).toEqual(before.moves);
  });

  it('mutating the original after cloning never affects the clone', () => {
    const engine = new GameEngine('CLONE-04');
    applyMoves(engine, ['left', 'down', 'right']);
    const clone = engine.clone();
    const cloneBefore = clone.getState();

    applyMoves(engine, ['left', 'down', 'right', 'up']);
    expect(clone.getState()).toEqual(cloneBefore);
  });

  it('clone of a clone behaves identically to the original stream', () => {
    const engine = new GameEngine('CLONE-05');
    applyMoves(engine, ['left', 'down', 'left']);
    const clone2 = engine.clone().clone();
    playIdentically(engine, clone2, 30);
  });

  it('clone matches the equivalent replay-from-seed engine exactly', () => {
    const engine = new GameEngine('CLONE-06');
    applyMoves(engine, ['left', 'down', 'right', 'down']);

    // The old (slow) way: fresh engine + full move-history replay.
    const replayed = new GameEngine('CLONE-06');
    const map: Record<string, Direction> = { U: 'up', D: 'down', L: 'left', R: 'right' };
    for (const m of engine.getState().moves) replayed.move(map[m]);

    const clone = engine.clone();
    expect(clone.getState()).toEqual(replayed.getState());
    playIdentically(replayed, clone, 30);
  });
});

describe('GameEngine cheap accessors', () => {
  it('agree with getState() fields after a series of moves', () => {
    const engine = new GameEngine('ACCESS-1');
    const priority: Direction[] = ['left', 'down', 'right', 'up'];
    for (let i = 0; i < 40; i++) {
      const dir = priority.find(d => engine.isValidMove(d));
      if (!dir) break;
      engine.move(dir);

      const state = engine.getState();
      expect(engine.isGameOver()).toBe(state.gameOver);
      expect(engine.getScore()).toBe(state.score);
      expect(engine.getMaxTileValue()).toBe(state.maxTile);
      expect(engine.getBoardView()).toEqual(state.board);
    }
  });

  it('getBoardView reflects live state without copying', () => {
    const engine = new GameEngine('ACCESS-2');
    const view = engine.getBoardView();
    expect(view).toEqual(engine.getState().board);

    // Same reference returned on subsequent calls until the board is replaced.
    expect(engine.getBoardView()).toBe(view);
  });
});
