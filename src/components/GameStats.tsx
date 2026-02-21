/**
 * Game Statistics Display Component
 * Compact score bar with pop animation
 */

import React, { useState, useRef, useEffect } from 'react';
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
  const [scorePop, setScorePop] = useState(false);
  const [copied, setCopied] = useState(false);
  const prevScore = useRef(gameState.score);

  useEffect(() => {
    if (gameState.score !== prevScore.current && gameState.score > prevScore.current) {
      setScorePop(true);
      const timer = setTimeout(() => setScorePop(false), 300);
      prevScore.current = gameState.score;
      return () => clearTimeout(timer);
    }
    prevScore.current = gameState.score;
  }, [gameState.score]);

  const handleCopySeed = () => {
    if (!seed) return;
    navigator.clipboard.writeText(seed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <StatPill
        label="Score"
        value={gameState.score.toLocaleString()}
        pop={scorePop}
      />
      <StatPill label="Max" value={gameState.maxTile.toString()} />
      <StatPill label="Moves" value={gameState.moves.length.toString()} />
      {seed && (
        <button
          onClick={handleCopySeed}
          className="flex flex-col items-center px-3 py-1.5 bg-surface-raised rounded-lg min-w-[60px] hover:bg-dark-border transition-colors"
          title="Click to copy seed"
        >
          <span className="text-[10px] uppercase tracking-wide text-gray-500">
            {copied ? 'Copied!' : 'Seed'}
          </span>
          <span className="text-sm font-bold text-gray-200 font-mono">
            {seed}
          </span>
        </button>
      )}
    </div>
  );
};

const StatPill: React.FC<{ label: string; value: string; pop?: boolean }> = ({
  label,
  value,
  pop = false,
}) => (
  <div className="flex flex-col items-center px-3 py-1.5 bg-surface-raised rounded-lg min-w-[60px]">
    <span className="text-[10px] uppercase tracking-wide text-gray-500">{label}</span>
    <span
      className={`text-sm font-bold text-gray-200 ${pop ? 'animate-score-pop' : ''}`}
    >
      {value}
    </span>
  </div>
);

export default GameStats;
