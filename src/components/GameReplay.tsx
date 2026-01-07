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
    return <div>Loading...</div>;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-amber-900">Game Replay</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Game Info */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-100 rounded p-2 text-center">
            <div className="text-xs text-gray-600">Score</div>
            <div className="text-lg font-bold">{gameState.score.toLocaleString()}</div>
          </div>
          <div className="bg-gray-100 rounded p-2 text-center">
            <div className="text-xs text-gray-600">Max Tile</div>
            <div className="text-lg font-bold">{gameState.maxTile}</div>
          </div>
          <div className="bg-gray-100 rounded p-2 text-center">
            <div className="text-xs text-gray-600">Seed</div>
            <div className="text-sm font-mono font-bold">{seed}</div>
          </div>
        </div>

        {/* Game Board */}
        <div className="flex justify-center mb-4">
          <GameBoard board={gameState.board} size="large" />
        </div>

        {/* Move Counter */}
        <div className="text-center mb-4">
          <div className="text-sm text-gray-600">
            Move {currentMove} of {totalMoves}
          </div>
        </div>

        {/* Timeline Slider */}
        <div className="mb-4">
          <input
            type="range"
            min={0}
            max={totalMoves}
            value={currentMove}
            onChange={(e) => handleJumpTo(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md"
            title="Reset to start"
          >
            ⏮
          </button>
          <button
            onClick={handleStepBack}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md"
            title="Step back"
          >
            ⏪
          </button>
          <button
            onClick={handlePlayPause}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-semibold"
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={handleStepForward}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md"
            title="Step forward"
          >
            ⏩
          </button>
        </div>

        {/* Speed Control */}
        <div className="flex items-center justify-center gap-4">
          <label className="text-sm text-gray-600">Speed:</label>
          <button
            onClick={() => setSpeed(1000)}
            className={`px-3 py-1 text-sm rounded ${
              speed === 1000 ? 'bg-amber-600 text-white' : 'bg-gray-200'
            }`}
          >
            0.5x
          </button>
          <button
            onClick={() => setSpeed(500)}
            className={`px-3 py-1 text-sm rounded ${
              speed === 500 ? 'bg-amber-600 text-white' : 'bg-gray-200'
            }`}
          >
            1x
          </button>
          <button
            onClick={() => setSpeed(250)}
            className={`px-3 py-1 text-sm rounded ${
              speed === 250 ? 'bg-amber-600 text-white' : 'bg-gray-200'
            }`}
          >
            2x
          </button>
          <button
            onClick={() => setSpeed(100)}
            className={`px-3 py-1 text-sm rounded ${
              speed === 100 ? 'bg-amber-600 text-white' : 'bg-gray-200'
            }`}
          >
            5x
          </button>
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
