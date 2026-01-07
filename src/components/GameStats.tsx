/**
 * Game Statistics Display Component
 */

import React from 'react';
import type { GameState } from '../engine/types';

interface GameStatsProps {
  gameState: GameState;
  seed?: string;
  className?: string;
}

export const GameStats: React.FC<GameStatsProps> = ({
  gameState,
  seed,
  className = '',
}) => {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      <StatCard label="Score" value={gameState.score.toLocaleString()} />
      <StatCard label="Max Tile" value={gameState.maxTile.toString()} />
      <StatCard label="Moves" value={gameState.moves.length.toString()} />
      {seed && (
        <StatCard label="Seed" value={seed} mono />
      )}
      {gameState.won && (
        <div className="col-span-2 md:col-span-4 bg-green-100 border-2 border-green-500 rounded-lg p-3 text-center">
          <span className="text-green-800 font-bold text-lg">
            You Won! Reached 2048!
          </span>
        </div>
      )}
      {gameState.gameOver && !gameState.won && (
        <div className="col-span-2 md:col-span-4 bg-red-100 border-2 border-red-500 rounded-lg p-3 text-center">
          <span className="text-red-800 font-bold text-lg">
            Game Over
          </span>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono = false,
}) => (
  <div className="bg-white rounded-lg shadow-md p-4">
    <div className="text-sm text-gray-600 mb-1">{label}</div>
    <div className={`text-2xl font-bold text-amber-900 ${mono ? 'font-mono text-lg' : ''}`}>
      {value}
    </div>
  </div>
);

export default GameStats;
