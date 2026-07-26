import { useEffect, useState, useCallback } from 'react'
import { useGameStore } from './store/gameStore'
import { useShallow } from 'zustand/react/shallow'
import PlayView from './components/views/PlayView'
import BatchView from './components/views/BatchView'
import ResultsView from './components/views/ResultsView'
import GameReplay from './components/GameReplay'
import BottomNav from './components/BottomNav'
import type { Direction } from './engine/types'

function App() {
  // `engine` only changes identity on new-game/reset, so using it (rather
  // than `gameState`, which changes every move) as the loading gate avoids
  // re-rendering the shell on every interactive move.
  const engine = useGameStore((s) => s.engine)

  const { viewMode, setViewMode, batchResults, selectedGameId, selectGame, storageError, clearStorageError } =
    useGameStore(
      useShallow((s) => ({
        viewMode: s.viewMode,
        setViewMode: s.setViewMode,
        batchResults: s.batchResults,
        selectedGameId: s.selectedGameId,
        selectGame: s.selectGame,
        storageError: s.storageError,
        clearStorageError: s.clearStorageError,
      }))
    )

  const [playSeed, setPlaySeed] = useState('')

  const handlePlaySeed = useCallback((seed: string) => {
    setPlaySeed(seed)
    setViewMode('play')
    useGameStore.getState().startNewGame(seed)
  }, [setViewMode])

  const handleMove = useCallback((direction: Direction) => {
    useGameStore.getState().makeMove(direction)
  }, [])

  useEffect(() => {
    const { initialize, startNewGame } = useGameStore.getState()
    initialize()
    startNewGame()
  }, [])

  // Attach the keydown listener exactly once and read the latest view/game
  // state from the store on each keypress, instead of re-subscribing to
  // `gameState` (which changes on every move) as an effect dependency.
  useEffect(() => {
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

    const handleKeyDown = (e: KeyboardEvent) => {
      const { viewMode, gameState } = useGameStore.getState()
      // Match the swipe hook's enablement: no input once the game has ended,
      // so keys can't mutate the finished game behind the win/lose overlay.
      if (viewMode !== 'play' || !gameState || gameState.gameOver || gameState.won) return

      const direction = keyMap[e.key]
      if (direction) {
        e.preventDefault()
        handleMove(direction)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleMove])

  if (!engine) {
    return (
      <div className="min-h-dvh bg-app-bg flex items-center justify-center">
        <div className="text-lg font-medium text-text-muted">Loading game engine...</div>
      </div>
    )
  }

  const selectedGame = selectedGameId
    ? batchResults.find((game) => game.id === selectedGameId)
    : null

  return (
    <div className="min-h-dvh bg-app-bg text-text-primary relative overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-112 w-md -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute top-1/3 -left-36 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-4 md:py-8 pb-20 md:pb-6 relative z-10">
        <header className="text-center mb-6 hidden md:block">
          <h1 className="text-4xl font-bold tracking-tight text-text-primary mb-1">2048 Simulator</h1>
          <p className="text-sm text-text-muted">Test, Compare, and Evolve Strategy Performance</p>
        </header>

        <div className="max-w-6xl mx-auto mb-6 hidden md:block">
          <div className="flex justify-center gap-2 rounded-2xl border border-dark-border bg-surface backdrop-blur-xs p-2">
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
          {storageError && (
            <div className="max-w-2xl mx-auto mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 flex items-start justify-between gap-3 text-sm text-red-300">
              <span>{storageError}</span>
              <button
                onClick={clearStorageError}
                aria-label="Dismiss error"
                className="text-red-300 hover:text-red-100 font-semibold leading-none"
              >
                &times;
              </button>
            </div>
          )}

          {viewMode === 'play' && (
            <PlayView
              playSeed={playSeed}
              onPlaySeedChange={setPlaySeed}
              onMove={handleMove}
            />
          )}

          {viewMode === 'batch' && <BatchView />}

          {viewMode === 'results' && <ResultsView onPlaySeed={handlePlaySeed} />}
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
