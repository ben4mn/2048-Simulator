/**
 * Simulation results view: batch selector, summary, and results grid.
 */

import { useGameStore } from '../../store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import BatchResultsGrid from '../BatchResultsGrid';
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

export function ResultsView({ onPlaySeed }: ResultsViewProps) {
  const {
    batchResults,
    recentBatches,
    selectedBatchId,
    selectBatch,
    selectGame,
    setViewMode,
  } = useGameStore(
    useShallow((s) => ({
      batchResults: s.batchResults,
      recentBatches: s.recentBatches,
      selectedBatchId: s.selectedBatchId,
      selectBatch: s.selectBatch,
      selectGame: s.selectGame,
      setViewMode: s.setViewMode,
    }))
  );

  const selectedBatch = selectedBatchId
    ? recentBatches.find((batch) => batch.id === selectedBatchId) || null
    : null;

  return (
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
        <BatchResultsGrid results={batchResults} onSelectGame={selectGame} onPlaySeed={onPlaySeed} />
      )}
    </div>
  );
}

export default ResultsView;
