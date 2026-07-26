/**
 * Simulation results view: batch selector, summary, and results grid.
 * Also renders a head-to-head Compare-mode panel when a comparison pair is
 * selected, and an aggregate stats strip (win rate / scores / max-tile
 * distribution) for whichever single batch is selected.
 */

import { useEffect, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import BatchResultsGrid from '../BatchResultsGrid';
import { computeAggregateStats, computeComparison } from '../../engine/resultStats';
import type { Batch } from '../../storage/db';

export interface ResultsViewProps {
  onPlaySeed: (seed: string) => void;
}

const formatBatchTimestamp = (batch: Batch) => {
  const timestamp = batch.completedAt || batch.createdAt;
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatStrategyLabel = (batch: Batch) => {
  if (batch.strategyName) return batch.strategyName;
  if (!batch.strategyType) return 'Strategy';

  return batch.strategyType
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const formatNumber = (value: number) =>
  Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);

export function ResultsView({ onPlaySeed }: ResultsViewProps) {
  const {
    batchResults,
    recentBatches,
    selectedBatchId,
    selectBatch,
    selectGame,
    setViewMode,
    selectedComparisonId,
    selectComparisonPair,
    comparisonBatchA,
    comparisonBatchB,
    comparisonResultsA,
    comparisonResultsB,
  } = useGameStore(
    useShallow((s) => ({
      batchResults: s.batchResults,
      recentBatches: s.recentBatches,
      selectedBatchId: s.selectedBatchId,
      selectBatch: s.selectBatch,
      selectGame: s.selectGame,
      setViewMode: s.setViewMode,
      selectedComparisonId: s.selectedComparisonId,
      selectComparisonPair: s.selectComparisonPair,
      comparisonBatchA: s.comparisonBatchA,
      comparisonBatchB: s.comparisonBatchB,
      comparisonResultsA: s.comparisonResultsA,
      comparisonResultsB: s.comparisonResultsB,
    }))
  );

  const selectedBatch = selectedBatchId
    ? recentBatches.find((batch) => batch.id === selectedBatchId) || null
    : null;

  // Group recent batches sharing a comparisonId into selectable pairs.
  const comparisonOptions = useMemo(() => {
    const seen = new Map<string, Batch[]>();
    for (const batch of recentBatches) {
      if (!batch.comparisonId) continue;
      const list = seen.get(batch.comparisonId) || [];
      list.push(batch);
      seen.set(batch.comparisonId, list);
    }
    return [...seen.entries()]
      .filter(([, batches]) => batches.length >= 1)
      .map(([comparisonId, batches]) => {
        const sorted = [...batches].sort((a, b) => a.id.localeCompare(b.id));
        const label = sorted.map((b) => formatStrategyLabel(b)).join(' vs ');
        const timestamp = formatBatchTimestamp(sorted[0]);
        return { comparisonId, label: `${timestamp} — ${label}` };
      });
  }, [recentBatches]);

  useEffect(() => {
    // If the previously selected comparison was pruned from history, clear it.
    if (selectedComparisonId && !comparisonOptions.some((c) => c.comparisonId === selectedComparisonId)) {
      void selectComparisonPair(null);
    }
  }, [comparisonOptions, selectedComparisonId, selectComparisonPair]);

  const comparison =
    selectedComparisonId && (comparisonResultsA.length > 0 || comparisonResultsB.length > 0)
      ? computeComparison(comparisonResultsA, comparisonResultsB)
      : null;

  const aggregateStats = useMemo(() => computeAggregateStats(batchResults), [batchResults]);
  const maxDistCount = Math.max(1, ...aggregateStats.maxTileDistribution.map((b) => b.count));

  return (
    <div className="bg-surface rounded-xl shadow-lg p-4 md:p-8 border border-dark-border space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Simulation Results</h2>
          <p className="text-sm text-text-muted mt-1">Latest 10 completed simulations are retained automatically.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          {comparisonOptions.length > 0 && (
            <div className="w-full md:w-auto">
              <label htmlFor="recent-comparison" className="block text-xs uppercase tracking-wide text-text-muted mb-1">
                Comparisons
              </label>
              <select
                id="recent-comparison"
                value={selectedComparisonId || ''}
                onChange={(e) => void selectComparisonPair(e.target.value || null)}
                className="w-full md:min-w-[280px] px-3 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-md focus:ring-2 focus:ring-accent focus:border-accent"
              >
                <option value="">None selected</option>
                {comparisonOptions.map((option) => (
                  <option key={option.comparisonId} value={option.comparisonId}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {recentBatches.length > 0 && (
            <div className="w-full md:w-auto">
              <label htmlFor="recent-simulation" className="block text-xs uppercase tracking-wide text-text-muted mb-1">
                Recent Simulations
              </label>
              <select
                id="recent-simulation"
                value={selectedBatchId || ''}
                onChange={(e) => {
                  const value = e.target.value || null;
                  void selectBatch(value);
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
      </div>

      {comparison && (
        <ComparisonPanel
          comparison={comparison}
          labelA={comparisonBatchA ? formatStrategyLabel(comparisonBatchA) : 'Strategy A'}
          labelB={comparisonBatchB ? formatStrategyLabel(comparisonBatchB) : 'Strategy B'}
        />
      )}

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

      {batchResults.length > 0 && (
        <AggregateSummaryStrip stats={aggregateStats} maxDistCount={maxDistCount} />
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
        <BatchResultsGrid results={batchResults} onSelectGame={selectGame} onPlaySeed={onPlaySeed} />
      )}
    </div>
  );
}

function AggregateSummaryStrip({
  stats,
  maxDistCount,
}: {
  stats: ReturnType<typeof computeAggregateStats>;
  maxDistCount: number;
}) {
  return (
    <div className="rounded-xl border border-dark-border bg-surface-raised p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Stat label="Games" value={stats.games.toLocaleString()} />
        <Stat label="Win Rate" value={`${(stats.winRate * 100).toFixed(1)}%`} />
        <Stat label="Avg Score" value={formatNumber(stats.avgScore)} />
        <Stat label="Median Score" value={formatNumber(stats.medianScore)} />
      </div>

      {stats.maxTileDistribution.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted mb-2">Max Tile Distribution</p>
          <div className="space-y-1.5">
            {stats.maxTileDistribution.map((bucket) => (
              <div key={bucket.tile} className="flex items-center gap-2 text-xs">
                <span className="w-12 shrink-0 font-mono text-text-primary text-right">{bucket.tile}</span>
                <div className="flex-1 h-3 rounded-full bg-surface-elevated overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(bucket.count / maxDistCount) * 100}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-text-muted">{bucket.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-elevated px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="text-lg font-bold text-text-primary">{value}</div>
    </div>
  );
}

function ComparisonPanel({
  comparison,
  labelA,
  labelB,
}: {
  comparison: ReturnType<typeof computeComparison>;
  labelA: string;
  labelB: string;
}) {
  return (
    <div className="rounded-xl border border-accent/35 bg-amber-500/5 p-4 space-y-5">
      <h3 className="text-lg font-bold text-text-primary">Head-to-Head Comparison</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StrategyStatsCard label={labelA} stats={comparison.statsA} accent />
        <StrategyStatsCard label={labelB} stats={comparison.statsB} />
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-lg bg-surface-elevated px-3 py-2">
          <div className="text-lg font-bold text-text-primary">{comparison.winsA}</div>
          <div className="text-xs text-text-muted">{labelA} wins</div>
        </div>
        <div className="rounded-lg bg-surface-elevated px-3 py-2">
          <div className="text-lg font-bold text-text-primary">{comparison.ties}</div>
          <div className="text-xs text-text-muted">Ties</div>
        </div>
        <div className="rounded-lg bg-surface-elevated px-3 py-2">
          <div className="text-lg font-bold text-text-primary">{comparison.winsB}</div>
          <div className="text-xs text-text-muted">{labelB} wins</div>
        </div>
      </div>

      {comparison.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-text-muted border-b border-dark-border">
                <th className="py-2 pr-3">Seed</th>
                <th className="py-2 pr-3 text-right">{labelA}</th>
                <th className="py-2 pr-3 text-right">{labelB}</th>
                <th className="py-2 pr-3 text-right">Delta</th>
                <th className="py-2 pr-3">Winner</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.seed} className="border-b border-dark-border/60">
                  <td className="py-1.5 pr-3 font-mono text-xs text-text-muted">{row.seed}</td>
                  <td className="py-1.5 pr-3 text-right text-text-primary">{row.scoreA.toLocaleString()}</td>
                  <td className="py-1.5 pr-3 text-right text-text-primary">{row.scoreB.toLocaleString()}</td>
                  <td
                    className={`py-1.5 pr-3 text-right font-medium ${
                      row.delta > 0 ? 'text-success' : row.delta < 0 ? 'text-danger' : 'text-text-muted'
                    }`}
                  >
                    {row.delta > 0 ? '+' : ''}
                    {row.delta.toLocaleString()}
                  </td>
                  <td className="py-1.5 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        row.winner === 'tie'
                          ? 'bg-surface-elevated text-text-muted'
                          : 'bg-amber-500/20 text-accent'
                      }`}
                    >
                      {row.winner === 'tie' ? 'TIE' : row.winner === 'A' ? labelA : labelB}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StrategyStatsCard({
  label,
  stats,
  accent = false,
}: {
  label: string;
  stats: ReturnType<typeof computeAggregateStats>;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        accent ? 'border-accent/50 bg-amber-500/10' : 'border-dark-border bg-surface-elevated'
      }`}
    >
      <h4 className="font-semibold text-text-primary mb-2">{label}</h4>
      <dl className="text-xs space-y-1">
        <div className="flex justify-between">
          <dt className="text-text-muted">Win rate</dt>
          <dd className="text-text-primary font-medium">{(stats.winRate * 100).toFixed(1)}%</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">Avg score</dt>
          <dd className="text-text-primary font-medium">{formatNumber(stats.avgScore)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">Median score</dt>
          <dd className="text-text-primary font-medium">{formatNumber(stats.medianScore)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">Best tile</dt>
          <dd className="text-text-primary font-medium">{stats.bestTile}</dd>
        </div>
      </dl>
    </div>
  );
}

export default ResultsView;
