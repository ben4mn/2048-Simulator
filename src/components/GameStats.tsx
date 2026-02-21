/**
 * Game Statistics Display Component
 */

import React, { useState } from 'react';
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
        <SeedCard seed={seed} />
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

const SeedCard: React.FC<{ seed: string }> = ({ seed }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(seed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      onClick={handleCopy}
      className="bg-white rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow group"
      title="Click to copy seed"
    >
      <div className="text-sm text-gray-600 mb-1 flex items-center justify-between">
        <span>Seed</span>
        <span className="text-xs text-gray-400 group-hover:text-amber-600 transition-colors">
          {copied ? 'Copied!' : 'Click to copy'}
        </span>
      </div>
      <div className="text-lg font-bold text-amber-900 font-mono">
        {seed}
      </div>
    </div>
  );
};

export default GameStats;
