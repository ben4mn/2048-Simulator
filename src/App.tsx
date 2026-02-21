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

  // Swipe support
  const swipeEnabled = viewMode === 'play' && !!gameState && !gameState.gameOver && !gameState.won
  const swipeRef = useSwipe({
    onSwipe: handleMove,
    enabled: swipeEnabled,
  })

  // Initialize database and load results on mount
  useEffect(() => {
    initialize()
    startNewGame()
  }, [initialize, startNewGame])

  // Keyboard controls (only active in play mode)
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
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-xl text-gray-400">Loading game engine...</div>
      </div>
    )
  }

  // Get selected game for replay
  const selectedGame = selectedGameId
    ? batchResults.find((g) => g.id === selectedGameId)
    : null

  const isGameEnded = gameState.gameOver || gameState.won

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      <div className="container mx-auto px-4 py-4 md:py-8 pb-20 md:pb-6">
        {/* Desktop Header */}
        <header className="text-center mb-6 hidden md:block">
          <h1 className="text-4xl font-bold text-white mb-1">2048 Simulator</h1>
          <p className="text-sm text-gray-400">Test, Compare & Evolve Strategies</p>
        </header>

        {/* Desktop Tab Navigation */}
        <div className="max-w-6xl mx-auto mb-6 hidden md:block">
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setViewMode('play')}
              className={`px-6 py-3 font-semibold rounded-lg transition-colors ${
                viewMode === 'play'
                  ? 'bg-amber-500 text-gray-900 shadow-md'
                  : 'bg-surface text-gray-300 hover:bg-surface-raised'
              }`}
            >
              Play
            </button>
            <button
              onClick={() => setViewMode('batch')}
              className={`px-6 py-3 font-semibold rounded-lg transition-colors ${
                viewMode === 'batch'
                  ? 'bg-amber-500 text-gray-900 shadow-md'
                  : 'bg-surface text-gray-300 hover:bg-surface-raised'
              }`}
            >
              Batch Simulation
            </button>
            <button
              onClick={() => setViewMode('results')}
              className={`px-6 py-3 font-semibold rounded-lg transition-colors ${
                viewMode === 'results'
                  ? 'bg-amber-500 text-gray-900 shadow-md'
                  : 'bg-surface text-gray-300 hover:bg-surface-raised'
              }`}
            >
              Results ({batchResults.length})
            </button>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto">
          {/* Play View */}
          {viewMode === 'play' && (
            <div className="max-w-2xl mx-auto">
              <GameStats
                gameState={gameState}
                seed={engine.getSeed()}
                className="mb-4"
              />

              {/* Board + swipe area + overlay */}
              <div
                ref={swipeRef}
                className="relative flex flex-col items-center mb-4 swipe-area"
              >
                <GameBoard
                  board={gameState.board}
                  size="responsive"
                  shiftDirection={boardShiftDir}
                />

                {/* Game Over / Win Overlay */}
                {isGameEnded && (
                  <div className="absolute inset-0 bg-black/60 rounded-lg flex flex-col items-center justify-center board-overlay">
                    <div className={`text-2xl font-bold mb-2 ${gameState.won ? 'text-amber-400' : 'text-white'}`}>
                      {gameState.won ? 'You Won!' : 'Game Over'}
                    </div>
                    <div className="text-gray-300 mb-4">
                      Score: {gameState.score.toLocaleString()}
                    </div>
                    <button
                      onClick={() => startNewGame(playSeed || undefined)}
                      className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold rounded-lg transition-colors"
                    >
                      Play Again
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-3">
                <div className="text-xs text-gray-500 text-center">
                  <span className="hidden md:inline">Arrow keys or WASD to play</span>
                  <span className="md:hidden">Swipe to play</span>
                </div>

                {/* Seed Input */}
                <div className="flex gap-2 w-full max-w-sm">
                  <input
                    type="text"
                    value={playSeed}
                    onChange={(e) => setPlaySeed(e.target.value.toUpperCase())}
                    maxLength={8}
                    placeholder="Enter seed (optional)"
                    className="flex-1 px-3 py-2 border border-dark-border bg-surface-raised text-white rounded-md font-mono text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 placeholder-gray-600"
                  />
                  <button
                    onClick={() => setPlaySeed(generateSeed())}
                    className="px-3 py-2 bg-surface-raised hover:bg-dark-border text-gray-300 rounded-md text-sm transition-colors border border-dark-border"
                  >
                    Random
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => startNewGame(playSeed || undefined)}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold rounded-lg shadow-lg shadow-amber-500/20 transition-colors"
                  >
                    {playSeed ? 'New Game (Seeded)' : 'New Game'}
                  </button>
                  <button
                    onClick={resetGame}
                    className="px-6 py-2.5 bg-surface-raised hover:bg-dark-border text-gray-300 font-semibold rounded-lg transition-colors border border-dark-border"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Batch Simulation View */}
          {viewMode === 'batch' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <BatchConfigPanel
                onStartBatch={startBatchSimulation}
                isRunning={isRunningBatch}
              />

              {isRunningBatch && (
                <ProgressIndicator
                  current={batchProgress}
                  total={batchTotal}
                  label="Running simulations..."
                />
              )}
            </div>
          )}

          {/* Results View */}
          {viewMode === 'results' && (
            <div className="bg-surface rounded-xl shadow-lg p-4 md:p-8 border border-dark-border">
              <h2 className="text-2xl font-bold text-white mb-6">
                Simulation Results
              </h2>
              {batchResults.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 mb-4">
                    No simulation results yet.
                  </p>
                  <button
                    onClick={() => setViewMode('batch')}
                    className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold rounded-lg shadow-lg shadow-amber-500/20 transition-colors"
                  >
                    Run a Batch Simulation
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

      {/* Mobile Bottom Nav */}
      <BottomNav
        activeTab={viewMode}
        onTabChange={setViewMode}
        resultCount={batchResults.length}
      />

      {/* Game Replay Modal */}
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
