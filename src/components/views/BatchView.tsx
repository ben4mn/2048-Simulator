/**
 * Batch simulation configuration + in-progress view.
 * Reads batch progress fields directly from the store so ticking
 * batchProgress/batchTotal only re-renders this view, not the App shell.
 */

import { useGameStore } from '../../store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import BatchConfigPanel from '../BatchConfigPanel';
import ProgressIndicator from '../ProgressIndicator';

export function BatchView() {
  const { isRunningBatch, batchProgress, batchTotal, startBatchSimulation, stopBatchSimulation } =
    useGameStore(
      useShallow((s) => ({
        isRunningBatch: s.isRunningBatch,
        batchProgress: s.batchProgress,
        batchTotal: s.batchTotal,
        startBatchSimulation: s.startBatchSimulation,
        stopBatchSimulation: s.stopBatchSimulation,
      }))
    );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <BatchConfigPanel onStartBatch={startBatchSimulation} isRunning={isRunningBatch} />

      {isRunningBatch && (
        <div className="bg-surface border border-dark-border rounded-xl p-5 shadow-lg shadow-black/20 space-y-4">
          <ProgressIndicator current={batchProgress} total={batchTotal} label="Running simulations..." />
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
  );
}

export default BatchView;
