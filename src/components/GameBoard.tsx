/**
 * Game Board Component
 * Displays the 4x4 grid with animated tiles
 */

import React from 'react';
import type { Board, Position } from '../engine/types';

interface GameBoardProps {
  board: Board;
  className?: string;
  size?: 'small' | 'responsive' | 'large';
  interactive?: boolean;
  /**
   * Real per-move effects from GameEngine.getLastMoveEffects(): only the
   * spawned tile plays the "appear" animation and only genuinely merged
   * cells play "merge". Omit (e.g. in replays/previews) to disable
   * per-tile animations entirely.
   */
  effects?: { spawn: Position | null; merges: Position[] } | null;
  /**
   * Monotonic move counter (e.g. gameState.moves.length). Keys animated
   * cells so their CSS animation restarts on every move, even when the same
   * cell animates in consecutive moves.
   */
  moveKey?: number;
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
  effects = null,
  moveKey = 0,
}) => {
  const sizeClasses = getSizeClasses(size);

  const isSpawn = (row: number, col: number) =>
    effects?.spawn?.row === row && effects?.spawn?.col === col;
  const isMerge = (row: number, col: number) =>
    effects?.merges.some(cell => cell.row === row && cell.col === col) ?? false;

  return (
    <div
      role="grid"
      aria-label={describeBoard(board)}
      className={`${sizeClasses.container} ${className} rounded-lg ${sizeClasses.padding} ${sizeClasses.gap} grid grid-cols-4 grid-rows-4 shadow-lg border border-[#4f432f]`}
      style={{ backgroundColor: 'var(--color-board-bg)' }}
    >
      {board.map((row, rowIdx) =>
        row.map((value, colIdx) => {
          const animation =
            value !== 0 && isSpawn(rowIdx, colIdx)
              ? 'appear'
              : value !== 0 && isMerge(rowIdx, colIdx)
                ? 'merge'
                : null;
          return (
            <div
              // Animated cells get a per-move key so remounting restarts
              // their CSS animation; static cells keep a stable positional key.
              key={animation ? `${rowIdx}-${colIdx}-m${moveKey}` : `${rowIdx}-${colIdx}`}
              role="gridcell"
              aria-label={value === 0 ? 'empty' : String(value)}
              className={`
                ${value === 0 ? '' : getTileColor(value)}
                ${sizeClasses.tile}
                rounded-md
                flex items-center justify-center
                font-bold
                ${interactive ? 'transition-transform duration-150 hover:scale-105 cursor-pointer' : ''}
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
