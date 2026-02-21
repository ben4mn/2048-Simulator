/**
 * Game Board Component
 * Displays the 4x4 grid with animated tiles
 */

import React from 'react';
import type { Board, Direction } from '../engine/types';

interface GameBoardProps {
  board: Board;
  className?: string;
  size?: 'small' | 'responsive' | 'large';
  interactive?: boolean;
  shiftDirection?: Direction | null;
}

const getTileColor = (value: number): string => {
  const colors: Record<number, string> = {
    2: 'bg-[#eee4da] text-gray-700',
    4: 'bg-[#ede0c8] text-gray-700',
    8: 'bg-[#f2b179] text-white',
    16: 'bg-[#f59563] text-white',
    32: 'bg-[#f67c5f] text-white',
    64: 'bg-[#f65e3b] text-white',
    128: 'bg-[#edcf72] text-white',
    256: 'bg-[#edcc61] text-white',
    512: 'bg-[#edc850] text-white',
    1024: 'bg-[#edc53f] text-white text-sm',
    2048: 'bg-[#edc22e] text-white',
    4096: 'bg-[#3c3a32] text-white',
  };

  return colors[value] || 'bg-[#3c3a32] text-white';
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

export const GameBoard: React.FC<GameBoardProps> = ({
  board,
  className = '',
  size = 'responsive',
  interactive = false,
  shiftDirection = null,
}) => {
  const sizeClasses = getSizeClasses(size);

  const shiftStyle = shiftDirection
    ? { animation: `${shiftAnimationMap[shiftDirection]} 150ms ease-out` }
    : undefined;

  return (
    <div
      className={`${sizeClasses.container} ${className} bg-[#3c3224] rounded-lg ${sizeClasses.padding} ${sizeClasses.gap} grid grid-cols-4 shadow-lg`}
      style={shiftStyle}
    >
      {board.map((row, rowIdx) =>
        row.map((value, colIdx) => (
          <div
            key={`${rowIdx}-${colIdx}`}
            className={`
              ${value === 0 ? 'bg-white/[0.06]' : getTileColor(value)}
              ${sizeClasses.tile}
              rounded-md
              flex items-center justify-center
              font-bold
              transition-all duration-150
              ${interactive ? 'hover:scale-105 cursor-pointer' : ''}
              ${value === 0 ? '' : 'shadow-md'}
            `}
          >
            {value !== 0 && value}
          </div>
        ))
      )}
    </div>
  );
};

export default GameBoard;
