/**
 * Canonical board inspection utilities.
 *
 * These were previously duplicated across gameEngine.ts, strategy.ts, and
 * customRules.ts; every module now delegates here so the semantics (e.g.
 * "tiles separated only by empties can merge") are defined exactly once.
 */

import type { Board } from './types';

/** Highest tile value on the board (0 for an empty board). */
export function getMaxTileValue(board: Board): number {
  let max = 0;
  for (const row of board) {
    for (const tile of row) {
      if (tile > max) max = tile;
    }
  }
  return max;
}

/** Highest tile value and its position (first occurrence in row-major order). */
export function findMaxTile(board: Board): { value: number; row: number; col: number } {
  let value = 0;
  let maxRow = 0;
  let maxCol = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (board[row][col] > value) {
        value = board[row][col];
        maxRow = row;
        maxCol = col;
      }
    }
  }
  return { value, row: maxRow, col: maxCol };
}

/** Number of empty (0) cells on the board. */
export function countEmptyTiles(board: Board): number {
  let count = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (board[row][col] === 0) count++;
    }
  }
  return count;
}

/**
 * Count merges available in a single line after sliding (empties ignored).
 * Matches 2048 merge semantics: each tile merges at most once per slide.
 */
export function countLineMerges(line: number[]): number {
  const tiles = line.filter(v => v !== 0);
  let count = 0;
  let i = 0;
  while (i < tiles.length - 1) {
    if (tiles[i] === tiles[i + 1]) {
      count++;
      i += 2;
    } else {
      i += 1;
    }
  }
  return count;
}

/**
 * Count potential merges on the board (horizontal + vertical).
 * Tiles separated only by empty cells can merge when the line slides
 * (e.g. [2, 0, 2] is one potential merge), so empties are looked through.
 */
export function countMerges(board: Board): number {
  let count = 0;

  // Horizontal merges
  for (let row = 0; row < 4; row++) {
    count += countLineMerges([
      board[row][0], board[row][1], board[row][2], board[row][3],
    ]);
  }

  // Vertical merges
  for (let col = 0; col < 4; col++) {
    count += countLineMerges([
      board[0][col], board[1][col], board[2][col], board[3][col],
    ]);
  }

  return count;
}
