import { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import BatchConfigPanel from '../BatchConfigPanel';
import ProgressIndicator from '../ProgressIndicator';
import { AccountCard } from '../account/AccountCard';
import GameBoard from '../GameBoard';
import { computeAggregateStats } from '../../engine/resultStats';
import { ReplaySession } from '../../engine/replaySession';
import type { DirectionShort } from '../../engine/types';

export function BatchView() {
  const state = useGameStore(
    useShallow((s) => ({
      isRunningBatch: s.isRunningBatch,
      isRunningComparison: s.isRunningComparison,
      batchProgress: s.batchProgress,
      batchTotal: s.batchTotal,
      batchResults: s.batchResults,
      currentBatchId: s.currentBatchId,
      startBatchSimulation: s.startBatchSimulation,
      startComparisonSimulation: s.startComparisonSimulation,
      stopBatchSimulation: s.stopBatchSimulation,
      recentBatches: s.recentBatches,
      selectedBatchId: s.selectedBatchId,
      setViewMode: s.setViewMode,
      selectGame: s.selectGame,
      compareBatchIdA: s.compareBatchIdA,
    })),
  );
  const running = state.isRunningBatch || state.isRunningComparison;
  const results = useMemo(
    () =>
      running
        ? state.batchResults.filter((r) => r.batchId === state.currentBatchId)
        : state.batchResults,
    [running, state.batchResults, state.currentBatchId],
  );
  const stats = useMemo(() => computeAggregateStats(results), [results]);
  const best = useMemo(
    () =>
      results.reduce<(typeof results)[number] | null>(
        (winner, r) =>
          !winner || r.finalScore > winner.finalScore ? r : winner,
        null,
      ),
    [results],
  );
  const board = useMemo(
    () =>
      best
        ? new ReplaySession(
            best.seed,
            best.moves.split('') as DirectionShort[],
          ).seek(best.moveCount).board
        : null,
    [best],
  );
  const selectedBatch = state.recentBatches.find(
    (b) => b.id === state.selectedBatchId,
  );
  const completedRun =
    !!selectedBatch && results[0]?.batchId === selectedBatch.id;
  const comparisonSide =
    state.compareBatchIdA && state.currentBatchId === state.compareBatchIdA
      ? 'A'
      : 'B';
  const maxCount = Math.max(
    1,
    ...stats.maxTileDistribution.map((b) => b.count),
  );

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] text-accent font-mono uppercase tracking-[0.2em] mb-2">
            The strategy playground
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Find your winning move<span className="text-accent">.</span>
          </h1>
          <p className="text-sm text-text-muted mt-2 max-w-lg leading-relaxed">
            Run thousands of games. Put strategies head to head. Build something
            better, one move at a time.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 self-start sm:self-auto rounded-full border px-3 py-1.5 text-[11px] font-mono ${running ? 'border-success/30 text-success bg-success/5' : 'border-dark-border text-text-muted bg-surface'}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${running ? 'bg-success animate-pulse' : 'bg-success'}`}
          />
          {running ? 'ENGINE RUNNING' : 'ENGINE READY'}
        </span>
      </div>
      {running && (
        <div className="rounded-xl border border-accent/30 bg-surface px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <ProgressIndicator
              current={state.batchProgress}
              total={state.batchTotal}
              label={
                state.isRunningComparison
                  ? `Head to head · Strategy ${comparisonSide}`
                  : 'Simulating games'
              }
            />
            <p className="text-xs text-text-muted mt-2">
              {state.batchProgress === 0
                ? 'Playing the first game. Deeper strategies take longer.'
                : 'Every completed game is saved with its full move history.'}
            </p>
          </div>
          <button
            onClick={state.stopBatchSimulation}
            className="shrink-0 px-4 py-2 text-xs border border-dark-border rounded-lg bg-surface-raised text-text-muted hover:text-danger hover:border-danger/40"
          >
            Cancel run
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.85fr)] gap-6 items-start">
        <BatchConfigPanel
          onStartBatch={state.startBatchSimulation}
          onStartComparison={(a, b, batchSize) =>
            state.startComparisonSimulation(a, b, { batchSize })
          }
          isRunning={state.isRunningBatch}
          isRunningComparison={state.isRunningComparison}
        />
        <aside className="space-y-5 lg:sticky lg:top-6">
          <div className="rounded-2xl border border-dark-border bg-surface overflow-hidden">
            <div className="px-5 py-4 border-b border-dark-border flex justify-between items-center">
              <h2 className="text-sm font-semibold">
                {running
                  ? 'Live run insights'
                  : results.length
                    ? completedRun
                      ? 'Latest run insights'
                      : 'Partial run insights'
                    : 'Your next experiment'}
              </h2>
              <span className="text-[10px] text-text-muted font-mono uppercase">
                {running
                  ? 'Live'
                  : results.length
                    ? completedRun
                      ? 'Complete'
                      : 'Partial'
                    : 'Ready'}
              </span>
            </div>
            {results.length ? (
              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <Metric
                    label="Games played"
                    value={stats.games.toLocaleString()}
                  />
                  <Metric
                    label="2048 win rate"
                    value={`${(stats.winRate * 100).toFixed(1)}%`}
                  />
                  <Metric
                    label="Average score"
                    value={Math.round(stats.avgScore).toLocaleString()}
                  />
                  <Metric
                    label="Best tile"
                    value={stats.bestTile.toLocaleString()}
                    accent
                  />
                </div>
                <div className="border-t border-dark-border pt-4">
                  <p className="text-[10px] uppercase tracking-widest text-text-muted mb-3">
                    Highest tile reached
                  </p>
                  <div className="space-y-2">
                    {stats.maxTileDistribution.map((bucket) => (
                      <div
                        key={bucket.tile}
                        className="flex gap-3 items-center text-xs"
                      >
                        <span className="w-10 text-right font-mono text-text-muted">
                          {bucket.tile}
                        </span>
                        <div className="h-2 rounded-full bg-surface-elevated flex-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${bucket.tile >= 2048 ? 'bg-success' : 'bg-accent/80'}`}
                            style={{
                              width: `${(bucket.count / maxCount) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="w-8 text-right font-mono text-text-muted">
                          {bucket.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {!running && completedRun && (
                  <button
                    onClick={() => state.setViewMode('results')}
                    className="w-full text-sm text-accent border border-accent/25 bg-accent/5 rounded-lg py-2.5 hover:bg-accent/10"
                  >
                    Explore results & replays →
                  </button>
                )}
              </div>
            ) : (
              <div className="p-5">
                <div
                  className="grid grid-cols-4 gap-2 max-w-52 mx-auto py-5"
                  aria-hidden="true"
                >
                  {[
                    2, 4, 0, 0, 4, 8, 0, 0, 8, 16, 32, 0, 32, 64, 128, 2048,
                  ].map((tile, i) => (
                    <div
                      key={i}
                      className={`aspect-square rounded-lg flex items-center justify-center font-mono text-xs ${tile === 2048 ? 'bg-accent text-gray-950 shadow-lg shadow-accent/20' : tile ? 'bg-surface-elevated text-text-muted' : 'bg-surface-raised/40'}`}
                    >
                      {tile || ''}
                    </div>
                  ))}
                </div>
                <h3 className="font-medium mt-3">
                  A good strategy is measurable.
                </h3>
                <p className="text-xs text-text-muted leading-relaxed mt-2">
                  Start with 100 games, then compare your favorite against
                  Random. Your scores and tile distribution will appear here.
                </p>
              </div>
            )}
          </div>
          {best && board && (
            <div className="rounded-2xl border border-dark-border bg-surface p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold">
                  Best game {running ? 'so far' : 'of the run'}
                </h2>
                <span className="font-mono text-xs text-accent">
                  {best.finalScore.toLocaleString()} pts
                </span>
              </div>
              <div className="flex flex-col min-[380px]:flex-row items-center gap-5">
                <GameBoard board={board} size="small" />
                <div className="text-xs space-y-2">
                  <p className="text-text-muted">
                    {best.moveCount.toLocaleString()} moves · max tile{' '}
                    {best.maxTile}
                  </p>
                  <p className="font-mono text-text-muted">SEED {best.seed}</p>
                  <button
                    onClick={() => state.selectGame(best.id)}
                    className="mt-2 rounded-lg bg-surface-raised border border-dark-border px-3 py-2 text-accent hover:border-accent/40"
                  >
                    ▶ Watch replay
                  </button>
                </div>
              </div>
            </div>
          )}
          {!running && completedRun && selectedBatch && (
            <p className="text-[11px] text-text-muted px-1">
              Last run:{' '}
              {selectedBatch.strategyName ?? selectedBatch.strategyType} ·{' '}
              {selectedBatch.gameCount.toLocaleString()} games ·{' '}
              {selectedBatch.seedMode} seeds
            </p>
          )}
          <div className="rounded-2xl border border-dark-border bg-surface/60 p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-accent mb-3">
              How to find an edge
            </p>
            <div className="space-y-3 text-xs text-text-muted leading-relaxed">
              <p>
                <strong className="text-text-primary font-medium">
                  01 · Establish a baseline.
                </strong>{' '}
                Start with a built-in strategy and fresh seeds.
              </p>
              <p>
                <strong className="text-text-primary font-medium">
                  02 · Make it yours.
                </strong>{' '}
                Open Build your own to tune weights or a move sequence.
              </p>
              <p>
                <strong className="text-text-primary font-medium">
                  03 · Prove it.
                </strong>{' '}
                Use head to head for a fair comparison on shared seeds.
              </p>
            </div>
          </div>
          <details className="rounded-xl border border-dark-border bg-surface overflow-hidden">
            <summary className="cursor-pointer px-5 py-4 text-sm text-text-muted hover:text-text-primary">
              AI account <span className="text-xs opacity-70">· optional</span>
            </summary>
            <p className="px-5 pb-3 text-xs text-text-muted leading-relaxed">
              Sign in to manage provider keys for AI generation. Presets, manual
              building, and simulations work without an account.
            </p>
            <AccountCard />
          </details>
        </aside>
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
        {label}
      </div>
      <div
        className={`text-2xl font-mono tracking-tight ${accent ? 'text-accent' : 'text-text-primary'}`}
      >
        {value}
      </div>
    </div>
  );
}
export default BatchView;
