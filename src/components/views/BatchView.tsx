/**
 * Batch simulation configuration + in-progress view.
 * Reads batch progress fields directly from the store so ticking
 * batchProgress/batchTotal only re-renders this view, not the App shell.
 *
 * Layout: responsive two-column on md+ (config ~60% left, account + run
 * summary on the right), stacked on mobile.
 */

import { useGameStore } from '../../store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import BatchConfigPanel from '../BatchConfigPanel';
import ProgressIndicator from '../ProgressIndicator';
import { AccountCard } from '../account/AccountCard';

export function BatchView() {
  const {
    isRunningBatch,
    isRunningComparison,
    batchProgress,
    batchTotal,
    startBatchSimulation,
    startComparisonSimulation,
    stopBatchSimulation,
    recentBatches,
    selectedBatchId,
  } = useGameStore(
    useShallow((s) => ({
      isRunningBatch: s.isRunningBatch,
      isRunningComparison: s.isRunningComparison,
      batchProgress: s.batchProgress,
      batchTotal: s.batchTotal,
      startBatchSimulation: s.startBatchSimulation,
      startComparisonSimulation: s.startComparisonSimulation,
      stopBatchSimulation: s.stopBatchSimulation,
      recentBatches: s.recentBatches,
      selectedBatchId: s.selectedBatchId,
    }))
  );

  const running = isRunningBatch || isRunningComparison;
  const lastCompleted = recentBatches.find((b) => b.id === selectedBatchId) || recentBatches[0];

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
      <div className="md:col-span-3 space-y-6">
        <BatchConfigPanel
          onStartBatch={startBatchSimulation}
          onStartComparison={(configA, configB, batchSize) =>
            startComparisonSimulation(configA, configB, { batchSize })
          }
          isRunning={isRunningBatch}
          isRunningComparison={isRunningComparison}
        />

        {running && (
          <div className="bg-surface border border-dark-border rounded-xl p-5 shadow-lg shadow-black/20 space-y-4">
            <ProgressIndicator
              current={batchProgress}
              total={batchTotal}
              label={isRunningComparison ? 'Running comparison...' : 'Running simulations...'}
            />
            <div className="flex justify-end">
              <button
                onClick={stopBatchSimulation}
                className="px-4 py-2 bg-surface-raised hover:bg-surface-elevated text-text-primary font-semibold rounded-lg transition-colors border border-dark-border"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="md:col-span-2 space-y-6">
        <AccountCard />

        <div className="bg-surface border border-dark-border rounded-xl p-5 shadow-lg shadow-black/20 space-y-2">
          <h3 className="text-lg font-bold text-text-primary">Run Summary</h3>
          {lastCompleted ? (
            <dl className="text-sm space-y-1">
              <div className="flex justify-between">
                <dt className="text-text-muted">Strategy</dt>
                <dd className="text-text-primary font-medium">
                  {lastCompleted.strategyName || lastCompleted.strategyType || 'Strategy'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Games</dt>
                <dd className="text-text-primary font-medium">{lastCompleted.gameCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Seed mode</dt>
                <dd className="text-text-primary font-medium capitalize">{lastCompleted.seedMode}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Status</dt>
                <dd className="text-text-primary font-medium capitalize">{lastCompleted.status}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-text-muted">
              Run a simulation to see a summary here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default BatchView;
