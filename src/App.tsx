import { useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import GameBoard from './components/GameBoard'
import GameStats from './components/GameStats'
import BatchConfigPanel from './components/BatchConfigPanel'
import BatchResultsGrid from './components/BatchResultsGrid'
import ProgressIndicator from './components/ProgressIndicator'
import GameReplay from './components/GameReplay'
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
        makeMove(direction)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewMode, gameState, makeMove])

  if (!gameState || !engine) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-xl text-amber-900">Loading game engine...</div>
      </div>
    )
  }

  // Get selected game for replay
  const selectedGame = selectedGameId
    ? batchResults.find((g) => g.id === selectedGameId)
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-5xl font-bold text-amber-900 mb-2">2048 Simulator</h1>
          <p className="text-lg text-amber-700">Test, Compare & Evolve Strategies</p>
        </header>

        {/* Tab Navigation */}
        <div className="max-w-6xl mx-auto mb-6">
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setViewMode('play')}
              className={`px-6 py-3 font-semibold rounded-lg transition-colors ${
                viewMode === 'play'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-white text-amber-900 hover:bg-amber-100'
              }`}
            >
              Play
            </button>
            <button
              onClick={() => setViewMode('batch')}
              className={`px-6 py-3 font-semibold rounded-lg transition-colors ${
                viewMode === 'batch'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-white text-amber-900 hover:bg-amber-100'
              }`}
            >
              Batch Simulation
            </button>
            <button
              onClick={() => setViewMode('results')}
              className={`px-6 py-3 font-semibold rounded-lg transition-colors ${
                viewMode === 'results'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-white text-amber-900 hover:bg-amber-100'
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
              <div className="bg-white rounded-xl shadow-lg p-8">
                <GameStats
                  gameState={gameState}
                  seed={engine.getSeed()}
                  className="mb-6"
                />

                <div className="flex flex-col items-center mb-6">
                  <GameBoard board={gameState.board} size="large" />
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className="text-sm text-gray-600 text-center">
                    Use arrow keys or WASD to play
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => startNewGame()}
                      className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-md transition-colors"
                    >
                      New Game
                    </button>
                    <button
                      onClick={resetGame}
                      className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg shadow-md transition-colors"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div></div>
                    <button
                      onClick={() => makeMove('up')}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded shadow"
                    >
                      ↑
                    </button>
                    <div></div>
                    <button
                      onClick={() => makeMove('left')}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded shadow"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => makeMove('down')}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded shadow"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => makeMove('right')}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded shadow"
                    >
                      →
                    </button>
                  </div>
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
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-amber-900 mb-6">
                Simulation Results
              </h2>
              {batchResults.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 mb-4">
                    No simulation results yet.
                  </p>
                  <button
                    onClick={() => setViewMode('batch')}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-md transition-colors"
                  >
                    Run a Batch Simulation
                  </button>
                </div>
              ) : (
                <BatchResultsGrid
                  results={batchResults}
                  onSelectGame={selectGame}
                />
              )}
            </div>
          )}
        </main>
      </div>

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
