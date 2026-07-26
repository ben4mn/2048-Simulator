/**
 * Interactive single-game play view: board, seed controls, and
 * new-game/reset actions. Swipe handling lives here since it's tied
 * directly to the board element this view renders.
 */

import { useGameStore } from '../../store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { generateSeed } from '../../engine/rng';
import GameBoard from '../GameBoard';
import GameStats from '../GameStats';
import { useSwipe } from '../../hooks/useSwipe';
import type { Direction } from '../../engine/types';

export interface PlayViewProps {
  playSeed: string;
  onPlaySeedChange: (seed: string) => void;
  boardShiftDir: Direction | null;
  onMove: (direction: Direction) => void;
}

export function PlayView({ playSeed, onPlaySeedChange, boardShiftDir, onMove }: PlayViewProps) {
  const { gameState, engine, startNewGame, resetGame } = useGameStore(
    useShallow((s) => ({
      gameState: s.gameState,
      engine: s.engine,
      startNewGame: s.startNewGame,
      resetGame: s.resetGame,
    }))
  );

  const swipeEnabled = !!gameState && !gameState.gameOver && !gameState.won;
  const swipeRef = useSwipe({
    onSwipe: onMove,
    enabled: swipeEnabled,
  });

  if (!gameState || !engine) return null;

  const isGameEnded = gameState.gameOver || gameState.won;

  return (
    <div className="max-w-2xl mx-auto">
      <GameStats gameState={gameState} seed={engine.getSeed()} className="mb-4" />

      <div ref={swipeRef} className="relative flex flex-col items-center mb-4 swipe-area">
        <GameBoard board={gameState.board} size="responsive" shiftDirection={boardShiftDir} />

        {isGameEnded && (
          <div className="absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center board-overlay">
            <div className={`text-2xl font-bold mb-2 ${gameState.won ? 'text-accent' : 'text-text-primary'}`}>
              {gameState.won ? 'You Won!' : 'Game Over'}
            </div>
            <div className="text-text-muted mb-4">
              Score: {gameState.score.toLocaleString()}
            </div>
            <button
              onClick={() => startNewGame(playSeed || undefined)}
              className="px-6 py-2 bg-accent hover:bg-accent-strong text-gray-950 font-semibold rounded-lg transition-colors"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="text-xs text-text-muted text-center">
          <span className="hidden md:inline">Arrow keys or WASD to play</span>
          <span className="md:hidden">Swipe to play</span>
        </div>

        <div className="flex gap-2 w-full max-w-sm">
          <input
            type="text"
            value={playSeed}
            onChange={(e) => onPlaySeedChange(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="Enter seed (optional)"
            aria-label="Seed"
            className="flex-1 px-3 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-md font-mono text-sm focus:ring-2 focus:ring-accent focus:border-accent placeholder:text-text-muted"
          />
          <button
            onClick={() => onPlaySeedChange(generateSeed())}
            className="px-3 py-2 bg-surface-raised hover:bg-surface-elevated text-text-primary rounded-md text-sm transition-colors border border-dark-border"
          >
            Random
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => startNewGame(playSeed || undefined)}
            className="px-6 py-2.5 bg-accent hover:bg-accent-strong text-gray-950 font-semibold rounded-lg shadow-lg shadow-amber-500/20 transition-colors"
          >
            {playSeed ? 'New Game (Seeded)' : 'New Game'}
          </button>
          <button
            onClick={resetGame}
            className="px-6 py-2.5 bg-surface-raised hover:bg-surface-elevated text-text-primary font-semibold rounded-lg transition-colors border border-dark-border"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlayView;
