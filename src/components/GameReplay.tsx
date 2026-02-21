/**
 * Game Replay Component
 * Allows users to replay a game move-by-move with controls
 */

import React, { useState, useEffect, useCallback } from 'react';
import GameBoard from './GameBoard';
import { GameEngine } from '../engine/gameEngine';
import type { DirectionShort, GameState } from '../engine/types';

interface GameReplayProps {
  seed: string;
  moves: string; // e.g., "LDLDRRUU..."
  onClose: () => void;
}

export const GameReplay: React.FC<GameReplayProps> = ({ seed, moves, onClose }) => {
  const [currentMove, setCurrentMove] = useState(0);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(500); // ms per move

  const moveArray = moves.split('') as DirectionShort[];
  const totalMoves = moveArray.length;

  // Initialize game engine
  useEffect(() => {
    const engine = new GameEngine(seed);
    setGameState(engine.getState());
  }, [seed]);

  // Apply moves up to current position
  const updateGameState = useCallback(
    (moveIndex: number) => {
      const engine = new GameEngine(seed);

      for (let i = 0; i < moveIndex && i < totalMoves; i++) {
        const move = convertShortToDirection(moveArray[i]);
        if (move) engine.move(move);
      }

      setGameState(engine.getState());
    },
    [seed, moveArray, totalMoves]
  );

  // Update game state when current move changes
  useEffect(() => {
    updateGameState(currentMove);
  }, [currentMove, updateGameState]);

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentMove((prev) => {
        if (prev >= totalMoves) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speed);

    return () => clearInterval(interval);
  }, [isPlaying, speed, totalMoves]);

  const handlePlayPause = () => {
    if (currentMove >= totalMoves) {
      setCurrentMove(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    setCurrentMove(Math.min(totalMoves, currentMove + 1));
  };

  const handleStepBack = () => {
    setIsPlaying(false);
    setCurrentMove(Math.max(0, currentMove - 1));
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentMove(0);
  };

  const handleJumpTo = (move: number) => {
    setIsPlaying(false);
    setCurrentMove(move);
  };

  if (!gameState) {
    return <div className="text-gray-400">Loading...</div>;
  }

  return (
    <div className="fixed inset-0 z-50 md:bg-black/60 md:flex md:items-center md:justify-center md:p-4 bg-dark-bg">
      <div className="h-full md:h-auto md:max-w-2xl md:w-full md:rounded-xl bg-dark-bg md:bg-surface flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 shrink-0">
          <h2 className="text-xl font-bold text-white">Game Replay</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Game Info */}
        <div className="grid grid-cols-3 gap-3 px-4 mb-3 shrink-0">
          <div className="bg-surface-raised rounded-lg p-2 text-center">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Score</div>
            <div className="text-lg font-bold text-gray-200">{gameState.score.toLocaleString()}</div>
          </div>
          <div className="bg-surface-raised rounded-lg p-2 text-center">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Max Tile</div>
            <div className="text-lg font-bold text-gray-200">{gameState.maxTile}</div>
          </div>
          <div className="bg-surface-raised rounded-lg p-2 text-center">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Seed</div>
            <div className="text-sm font-mono font-bold text-gray-200">{seed}</div>
          </div>
        </div>

        {/* Game Board — fills remaining space */}
        <div className="flex-1 flex items-center justify-center px-4 mb-3 min-h-0">
          <GameBoard board={gameState.board} size="responsive" />
        </div>

        {/* Move Counter */}
        <div className="text-center mb-2 shrink-0">
          <div className="text-sm text-gray-400">
            Move {currentMove} of {totalMoves}
          </div>
        </div>

        {/* Timeline Slider */}
        <div className="px-4 mb-3 shrink-0">
          <input
            type="range"
            min={0}
            max={totalMoves}
            value={currentMove}
            onChange={(e) => handleJumpTo(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 mb-3 shrink-0">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-surface-raised hover:bg-dark-border text-gray-300 rounded-md"
            title="Reset to start"
          >
            ⏮
          </button>
          <button
            onClick={handleStepBack}
            className="px-4 py-2 bg-surface-raised hover:bg-dark-border text-gray-300 rounded-md"
            title="Step back"
          >
            ⏪
          </button>
          <button
            onClick={handlePlayPause}
            className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-gray-900 rounded-md font-semibold"
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={handleStepForward}
            className="px-4 py-2 bg-surface-raised hover:bg-dark-border text-gray-300 rounded-md"
            title="Step forward"
          >
            ⏩
          </button>
        </div>

        {/* Speed Control */}
        <div className="flex items-center justify-center gap-3 pb-4 shrink-0">
          <label className="text-sm text-gray-400">Speed:</label>
          {[
            { label: '0.5x', value: 1000 },
            { label: '1x', value: 500 },
            { label: '2x', value: 250 },
            { label: '5x', value: 100 },
          ].map((s) => (
            <button
              key={s.value}
              onClick={() => setSpeed(s.value)}
              className={`px-3 py-1 text-sm rounded-full ${
                speed === s.value
                  ? 'bg-amber-500 text-gray-900'
                  : 'bg-surface-raised text-gray-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

function convertShortToDirection(short: DirectionShort): 'up' | 'down' | 'left' | 'right' | null {
  const map: Record<DirectionShort, 'up' | 'down' | 'left' | 'right'> = {
    U: 'up',
    D: 'down',
    L: 'left',
    R: 'right',
  };
  return map[short] || null;
}

export default GameReplay;
