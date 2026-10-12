import { useEffect, useState, useCallback } from 'react'
import { useGameStore } from './store/gameStore'
import { useAuthStore } from './store/authStore'
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

  const {
    viewMode,
    setViewMode,
    batchResults,
    selectedGameId,
    selectGame,
    storageError,
    clearStorageError,
  } = useGameStore(
    useShallow((s) => ({
      viewMode: s.viewMode,
      setViewMode: s.setViewMode,
      batchResults: s.batchResults,
      selectedGameId: s.selectedGameId,
      selectGame: s.selectGame,
      storageError: s.storageError,
      clearStorageError: s.clearStorageError,
    })),
  )

  const [playSeed, setPlaySeed] = useState('')

  useEffect(() => {
    const scrollContainer = document.getElementById('root')
    if (scrollContainer) scrollContainer.scrollTop = 0
  }, [viewMode])

  const handlePlaySeed = useCallback(
    (seed: string) => {
      setPlaySeed(seed)
      setViewMode('play')
      useGameStore.getState().startNewGame(seed)
    },
    [setViewMode],
  )

  const handleMove = useCallback((direction: Direction) => {
    useGameStore.getState().makeMove(direction)
  }, [])

  useEffect(() => {
    const { initialize, startNewGame } = useGameStore.getState()
    initialize()
    startNewGame()
    // Auth is optional and independent of the simulator: a missing/unreachable
    // backend resolves to status 'anon' without blocking anything above.
    void useAuthStore.getState().refresh()
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
      const { viewMode, gameState, selectedGameId } = useGameStore.getState()
      const target = e.target instanceof Element ? e.target : null
      if (
        e.defaultPrevented ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        selectedGameId ||
        target?.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"]',
        )
      )
        return
      // Match the swipe hook's enablement: no input once the game has ended,
      // so keys can't mutate the finished game behind the win/lose overlay.
      if (
        viewMode !== 'play' ||
        !gameState ||
        gameState.gameOver ||
        gameState.won
      )
        return

      const direction = keyMap[e.key] ?? keyMap[e.key.toLowerCase()]
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
        <div className="text-lg font-medium text-text-muted">
          Loading game engine...
        </div>
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

      <div className="container mx-auto px-4 py-4 md:py-8 pb-20 md:pb-6 relative">
        <header className="max-w-6xl mx-auto flex items-center justify-between gap-4 mb-7 md:mb-10 border-b border-dark-border pb-5">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="grid grid-cols-2 gap-1 w-9 h-9 rotate-[-6deg]"
            >
              <span className="rounded bg-accent/25" />
              <span className="rounded bg-accent/50" />
              <span className="rounded bg-accent/75" />
              <span className="rounded bg-accent" />
            </div>
            <div>
              <div className="font-semibold text-lg leading-tight tracking-tight">
                2048
                <span className="text-text-muted font-normal ml-1.5">
                  Strategy Lab
                </span>
              </div>
              <p className="text-[10px] text-text-muted tracking-wider mt-0.5">
                PLAY. EXPERIMENT. EVOLVE.
              </p>
            </div>
          </div>
          <nav
            aria-label="Main navigation"
            className="hidden md:flex gap-1 rounded-xl bg-surface border border-dark-border p-1"
          >
            {(
              [
                { view: 'play', label: 'Play' },
                { view: 'batch', label: 'Simulator' },
                {
                  view: 'results',
                  label: `Results${batchResults.length ? ` · ${batchResults.length.toLocaleString()}` : ''}`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.view}
                onClick={() => setViewMode(tab.view)}
                aria-current={viewMode === tab.view ? 'page' : undefined}
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${viewMode === tab.view ? 'bg-accent text-gray-950' : 'text-text-muted hover:text-text-primary hover:bg-surface-raised'}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

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

          <div hidden={viewMode !== 'batch'}>
            <BatchView />
          </div>

          {viewMode === 'results' && (
            <ResultsView onPlaySeed={handlePlaySeed} />
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
