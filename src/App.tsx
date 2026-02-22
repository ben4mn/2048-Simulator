import { useEffect, useState, useCallback, useRef } from 'react'
import { useGameStore } from './store/gameStore'
import { generateSeed } from './engine/rng'
import GameBoard from './components/GameBoard'
import GameStats from './components/GameStats'
import BatchConfigPanel from './components/BatchConfigPanel'
import BatchResultsGrid from './components/BatchResultsGrid'
import ProgressIndicator from './components/ProgressIndicator'
import GameReplay from './components/GameReplay'
import BottomNav from './components/BottomNav'
import { useSwipe } from './hooks/useSwipe'
import type { Direction } from './engine/types'
import type { Batch } from './storage/db'

const formatBatchTimestamp = (batch: Batch) => {
  const timestamp = batch.completedAt || batch.createdAt
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const formatStrategyLabel = (batch: Batch) => {
  if (batch.strategyName) return batch.strategyName
  if (!batch.strategyType) return 'Strategy'

  return batch.strategyType
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function App() {
  const {
    gameState,
    engine,
    startNewGame,
    makeMove,
    resetGame,
    viewMode,
    setViewMode,
    initialize,
    startBatchSimulation,
    isRunningBatch,
    batchProgress,
    batchTotal,
    batchResults,
    recentBatches,
    selectedBatchId,
    selectBatch,
    selectedGameId,
    selectGame,
  } = useGameStore()

  const [playSeed, setPlaySeed] = useState('')
  const [boardShiftDir, setBoardShiftDir] = useState<Direction | null>(null)
  const shiftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePlaySeed = useCallback((seed: string) => {
    setPlaySeed(seed)
    setViewMode('play')
    startNewGame(seed)
  }, [setViewMode, startNewGame])

  const handleMove = useCallback((direction: Direction) => {
    const moved = makeMove(direction)
    if (moved) {
      if (shiftTimer.current) clearTimeout(shiftTimer.current)
      setBoardShiftDir(direction)
      shiftTimer.current = setTimeout(() => setBoardShiftDir(null), 150)
    }
  }, [makeMove])

  const swipeEnabled = viewMode === 'play' && !!gameState && !gameState.gameOver && !gameState.won
  const swipeRef = useSwipe({
    onSwipe: handleMove,
    enabled: swipeEnabled,
  })

  useEffect(() => {
    initialize()
    startNewGame()
  }, [initialize, startNewGame])

  useEffect(() => {
    if (viewMode !== 'play' || !gameState) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, Direction> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        w: 'up',
        s: 'down',
        a: 'left',
        d: 'right',
      }

      const direction = keyMap[e.key]
      if (direction) {
        e.preventDefault()
        handleMove(direction)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewMode, gameState, handleMove])

  if (!gameState || !engine) {
    return (
      <div className="min-h-[100dvh] bg-app-bg flex items-center justify-center">
        <div className="text-lg font-medium text-text-muted">Loading game engine...</div>
      </div>
    )
  }

  const selectedGame = selectedGameId
    ? batchResults.find((game) => game.id === selectedGameId)
    : null

  const selectedBatch = selectedBatchId
    ? recentBatches.find((batch) => batch.id === selectedBatchId) || null
    : null

  const isGameEnded = gameState.gameOver || gameState.won

  return (
    <div className="min-h-[100dvh] bg-app-bg text-text-primary relative overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute top-1/3 -left-36 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-4 md:py-8 pb-20 md:pb-6 relative z-10">
        <header className="text-center mb-6 hidden md:block">
          <h1 className="text-4xl font-bold tracking-tight text-text-primary mb-1">2048 Simulator</h1>
          <p className="text-sm text-text-muted">Test, Compare, and Evolve Strategy Performance</p>
        </header>

        <div className="max-w-6xl mx-auto mb-6 hidden md:block">
          <div className="flex justify-center gap-2 rounded-2xl border border-dark-border bg-surface backdrop-blur-sm p-2">
            <button
              onClick={() => setViewMode('play')}
              className={`px-6 py-3 font-semibold rounded-xl transition-all ${
                viewMode === 'play'
                  ? 'bg-accent text-gray-950 shadow-lg shadow-amber-500/20'
                  : 'bg-surface-raised text-text-muted hover:text-text-primary hover:bg-surface-elevated'
              }`}
            >
              Play
            </button>
            <button
              onClick={() => setViewMode('batch')}
              className={`px-6 py-3 font-semibold rounded-xl transition-all ${
                viewMode === 'batch'
                  ? 'bg-accent text-gray-950 shadow-lg shadow-amber-500/20'
                  : 'bg-surface-raised text-text-muted hover:text-text-primary hover:bg-surface-elevated'
              }`}
            >
              Batch Simulation
            </button>
            <button
              onClick={() => setViewMode('results')}
              className={`px-6 py-3 font-semibold rounded-xl transition-all ${
                viewMode === 'results'
                  ? 'bg-accent text-gray-950 shadow-lg shadow-amber-500/20'
                  : 'bg-surface-raised text-text-muted hover:text-text-primary hover:bg-surface-elevated'
              }`}
            >
              Results ({batchResults.length})
            </button>
          </div>
        </div>

        <main className="max-w-6xl mx-auto">
          {viewMode === 'play' && (
            <div className="max-w-2xl mx-auto">
              <GameStats
                gameState={gameState}
                seed={engine.getSeed()}
                className="mb-4"
              />

              <div
                ref={swipeRef}
                className="relative flex flex-col items-center mb-4 swipe-area"
              >
                <GameBoard
                  board={gameState.board}
                  size="responsive"
                  shiftDirection={boardShiftDir}
                />

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
                    onChange={(e) => setPlaySeed(e.target.value.toUpperCase())}
                    maxLength={8}
                    placeholder="Enter seed (optional)"
                    className="flex-1 px-3 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-md font-mono text-sm focus:ring-2 focus:ring-accent focus:border-accent placeholder:text-text-muted"
                  />
                  <button
                    onClick={() => setPlaySeed(generateSeed())}
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
          )}

          {viewMode === 'batch' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <BatchConfigPanel
                onStartBatch={startBatchSimulation}
                isRunning={isRunningBatch}
              />

              {isRunningBatch && (
                <div className="bg-surface border border-dark-border rounded-xl p-5 shadow-lg shadow-black/20">
                  <ProgressIndicator
                    current={batchProgress}
                    total={batchTotal}
                    label="Running simulations..."
                  />
                </div>
              )}
            </div>
          )}

          {viewMode === 'results' && (
            <div className="bg-surface rounded-xl shadow-lg p-4 md:p-8 border border-dark-border space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-text-primary">Simulation Results</h2>
                  <p className="text-sm text-text-muted mt-1">Latest 10 completed simulations are retained automatically.</p>
                </div>

                {recentBatches.length > 0 && (
                  <div className="w-full md:w-auto">
                    <label htmlFor="recent-simulation" className="block text-xs uppercase tracking-wide text-text-muted mb-1">
                      Recent Simulations
                    </label>
                    <select
                      id="recent-simulation"
                      value={selectedBatchId || ''}
                      onChange={(e) => {
                        const value = e.target.value || null
                        void selectBatch(value)
                      }}
                      className="w-full md:min-w-[320px] px-3 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-md focus:ring-2 focus:ring-accent focus:border-accent"
                    >
                      {recentBatches.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {formatBatchTimestamp(batch)} - {formatStrategyLabel(batch)} ({batch.gameCount} games)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {selectedBatch && (
                <div className="rounded-lg border border-dark-border bg-surface-raised px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm">
                  <div>
                    <span className="text-text-muted">Strategy:</span>{' '}
                    <span className="font-semibold text-text-primary">{formatStrategyLabel(selectedBatch)}</span>
                  </div>
                  <div className="text-text-muted">
                    Completed {formatBatchTimestamp(selectedBatch)}
                  </div>
                </div>
              )}

              {recentBatches.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-text-muted mb-4">
                    No simulation results yet.
                  </p>
                  <button
                    onClick={() => setViewMode('batch')}
                    className="px-6 py-3 bg-accent hover:bg-accent-strong text-gray-950 font-semibold rounded-lg shadow-lg shadow-amber-500/20 transition-colors"
                  >
                    Run a Batch Simulation
                  </button>
                </div>
              ) : batchResults.length === 0 ? (
                <div className="text-center py-10 border border-dark-border rounded-xl bg-surface-raised">
                  <p className="text-text-muted mb-4">
                    This simulation has no game results.
                  </p>
                  <button
                    onClick={() => setViewMode('batch')}
                    className="px-6 py-3 bg-accent hover:bg-accent-strong text-gray-950 font-semibold rounded-lg transition-colors"
                  >
                    Run Another Simulation
                  </button>
                </div>
              ) : (
                <BatchResultsGrid
                  results={batchResults}
                  onSelectGame={selectGame}
                  onPlaySeed={handlePlaySeed}
                />
              )}
            </div>
          )}
        </main>
      </div>

      <BottomNav
        activeTab={viewMode}
        onTabChange={setViewMode}
        resultCount={batchResults.length}
      />

      {selectedGame && (
        <GameReplay
          seed={selectedGame.seed}
          moves={selectedGame.moves}
          onClose={() => selectGame(null)}
        />
      )}
    </div>
  )
}

export default App
