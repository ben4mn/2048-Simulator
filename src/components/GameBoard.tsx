/**
 * Game Board Component
 * Displays the 4x4 grid with animated tiles
 */

import React, { useState } from 'react';
import type { Board, Direction } from '../engine/types';

interface GameBoardProps {
  board: Board;
  className?: string;
  size?: 'small' | 'responsive' | 'large';
  interactive?: boolean;
  shiftDirection?: Direction | null;
}

// Single source of truth for tile styling: colors themselves live in
// src/index.css `@theme` as --color-tile-* tokens (Tailwind v4 turns those
// into the bg-tile-* utilities used below), this map only decides which
// token + text color/size pairing applies per value.
const getTileColor = (value: number): string => {
  const colors: Record<number, string> = {
    2: 'bg-tile-2 text-gray-700',
    4: 'bg-tile-4 text-gray-700',
    8: 'bg-tile-8 text-white',
    16: 'bg-tile-16 text-white',
    32: 'bg-tile-32 text-white',
    64: 'bg-tile-64 text-white',
    128: 'bg-tile-128 text-white',
    256: 'bg-tile-256 text-white',
    512: 'bg-tile-512 text-white',
    1024: 'bg-tile-1024 text-white text-sm',
    2048: 'bg-tile-2048 text-white',
    4096: 'bg-tile-4096 text-white',
  };

  return colors[value] || 'bg-tile-4096 text-white';
};

const shiftAnimationMap: Record<Direction, string> = {
  left: 'board-shift-left',
  right: 'board-shift-right',
  up: 'board-shift-up',
  down: 'board-shift-down',
};

const getSizeClasses = (size: 'small' | 'responsive' | 'large') => {
  switch (size) {
    case 'small':
      return {
        container: 'w-40 h-40',
        tile: 'text-sm',
        gap: 'gap-1',
        padding: 'p-1.5',
      };
    case 'responsive':
      return {
        container: 'game-board',
        tile: 'game-board-tile',
        gap: 'gap-1.5 md:gap-2',
        padding: 'p-2',
      };
    case 'large':
      return {
        container: 'w-96 h-96',
        tile: 'text-2xl',
        gap: 'gap-3',
        padding: 'p-2',
      };
  }
};

type CellAnimation = 'appear' | 'merge' | null;

/**
 * Classify each cell as newly-appeared, merged, or unchanged by comparing
 * against the board from the previous render. This is a positional
 * approximation (the engine doesn't expose per-tile identity/merge info),
 * but it's a good visual proxy: a cell that was empty and now has a value
 * just spawned or slid in; a cell whose value changed without becoming
 * newly non-empty just merged.
 */
function classifyCells(board: Board, previous: Board | null): CellAnimation[][] {
  return board.map((row, rowIdx) =>
    row.map((value, colIdx) => {
      if (value === 0) return null;
      const prevValue = previous ? previous[rowIdx]?.[colIdx] ?? 0 : 0;
      if (prevValue === 0) return 'appear';
      if (prevValue !== value) return 'merge';
      return null;
    })
  );
}

const describeBoard = (board: Board): string => {
  let highest = 0;
  let score = 0;
  for (const row of board) {
    for (const value of row) {
      if (value > highest) highest = value;
      score += value;
    }
  }
  return `4x4 board, highest tile ${highest}, sum ${score}`;
};

export const GameBoard: React.FC<GameBoardProps> = ({
  board,
  className = '',
  size = 'responsive',
  interactive = false,
  shiftDirection = null,
}) => {
  const sizeClasses = getSizeClasses(size);

  // Derive per-cell animation state from the previous board without an
  // effect/ref: this is React's documented "adjust state during render"
  // pattern for reacting to a prop change (board is a fresh array each move,
  // so identity comparison is reliable here).
  const [previousBoard, setPreviousBoard] = useState<Board | null>(null);
  const [cellAnimations, setCellAnimations] = useState<CellAnimation[][]>(() =>
    classifyCells(board, null)
  );

  if (board !== previousBoard) {
    setPreviousBoard(board);
    setCellAnimations(classifyCells(board, previousBoard));
  }

  const shiftStyle = shiftDirection
    ? { animation: `${shiftAnimationMap[shiftDirection]} 150ms ease-out` }
    : undefined;

  return (
    <div
      role="grid"
      aria-label={describeBoard(board)}
      className={`${sizeClasses.container} ${className} rounded-lg ${sizeClasses.padding} ${sizeClasses.gap} grid grid-cols-4 shadow-lg border border-[#4f432f]`}
      style={{
        ...shiftStyle,
        backgroundColor: 'var(--color-board-bg)',
      }}
    >
      {board.map((row, rowIdx) =>
        row.map((value, colIdx) => {
          const animation = cellAnimations[rowIdx][colIdx];
          return (
            <div
              key={`${rowIdx}-${colIdx}`}
              role="gridcell"
              aria-label={value === 0 ? 'empty' : String(value)}
              className={`
                ${value === 0 ? '' : getTileColor(value)}
                ${sizeClasses.tile}
                rounded-md
                flex items-center justify-center
                font-bold
                transition-all duration-150
                ${interactive ? 'hover:scale-105 cursor-pointer' : ''}
                ${value === 0 ? '' : 'shadow-md'}
                ${animation === 'appear' ? 'animate-tile-appear' : ''}
                ${animation === 'merge' ? 'animate-tile-merge' : ''}
              `}
              style={value === 0 ? { backgroundColor: 'var(--color-tile-empty)' } : undefined}
            >
              {value !== 0 && value}
            </div>
          );
        })
      )}
    </div>
  );
};

export default GameBoard;
