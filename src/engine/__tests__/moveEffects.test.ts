import { describe, it, expect } from 'vitest';
import { GameEngine } from '../gameEngine';
import type { Board, Direction } from '../types';

// Private access via `as any` follows the existing test convention for
// injecting board states (the engine has no public board-injection API).
function engineWithBoard(board: Board): GameEngine {
  const engine = new GameEngine('EFFECTS-SEED');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (engine as any).state.board = board.map((row) => [...row]);
  return engine;
}

function boardDiffNewCell(before: Board, after: Board, exclude: { row: number; col: number }[]) {
  const cells: { row: number; col: number }[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (
        after[row][col] !== 0 &&
        before[row][col] === 0 &&
        !exclude.some((c) => c.row === row && c.col === col)
      ) {
        cells.push({ row, col });
      }
    }
  }
  return cells;
}

describe('GameEngine.getLastMoveEffects', () => {
  it('reports null spawn and no merges before any move and after reset', () => {
    const engine = new GameEngine('EFFECTS-SEED');
    expect(engine.getLastMoveEffects()).toEqual({ spawn: null, merges: [] });
    engine.move('left');
    engine.reset();
    expect(engine.getLastMoveEffects()).toEqual({ spawn: null, merges: [] });
  });

  const mergeCases: Array<{
    direction: Direction;
    board: Board;
    expected: { row: number; col: number };
  }> = [
    // A lone 2,2 pair; the merged tile's landing cell per direction.
    { direction: 'left', board: [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], expected: { row: 0, col: 0 } },
    { direction: 'right', board: [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], expected: { row: 0, col: 3 } },
    { direction: 'up', board: [[2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], expected: { row: 0, col: 0 } },
    { direction: 'down', board: [[2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], expected: { row: 3, col: 0 } },
  ];

  for (const { direction, board, expected } of mergeCases) {
    it(`maps the merged cell back to original coordinates for ${direction}`, () => {
      const engine = engineWithBoard(board);
      const before = engine.getState().board;
      expect(engine.move(direction)).toBe(true);
      const { spawn, merges } = engine.getLastMoveEffects();

      expect(merges).toEqual([expected]);
      const after = engine.getState().board;
      expect(after[expected.row][expected.col]).toBe(4);

      // The spawn must be a real newly-filled cell (and not the merge target).
      expect(spawn).not.toBeNull();
      const newCells = boardDiffNewCell(before, after, [expected]);
      expect(newCells).toContainEqual(spawn);
      expect(after[spawn!.row][spawn!.col]).toBeGreaterThan(0);
    });
  }

  it('reports multiple merges in one move', () => {
    const engine = engineWithBoard([
      [2, 2, 4, 4],
      [8, 8, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(engine.move('left')).toBe(true);
    const { merges } = engine.getLastMoveEffects();
    expect(merges).toContainEqual({ row: 0, col: 0 });
    expect(merges).toContainEqual({ row: 0, col: 1 });
    expect(merges).toContainEqual({ row: 1, col: 0 });
    expect(merges).toHaveLength(3);
  });

  it('reports no merges on a pure slide', () => {
    const engine = engineWithBoard([
      [0, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 4],
      [0, 0, 0, 0],
    ]);
    expect(engine.move('left')).toBe(true);
    expect(engine.getLastMoveEffects().merges).toEqual([]);
  });
});
