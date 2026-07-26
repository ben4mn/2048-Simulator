/**
 * Zustand store for game state management
 */

import { create } from 'zustand';
import { GameEngine } from '../engine/gameEngine';
import { generateSeed } from '../engine/rng';
import type { GameState, Direction, GameResult } from '../engine/types';
import type { SimulationJob, SimulationProgress } from '../workers/simulationWorker';
import { db } from '../storage/db';
import type { Batch, Strategy } from '../storage/db';
import type { CustomRule } from '../engine/customRules';

const MAX_COMPLETED_BATCHES = 10;

const STRATEGY_LABELS: Record<string, string> = {
  directional_priority: 'Directional Priority',
  corner_anchor: 'Corner Anchor',
  merge_max: 'Merge Maximization',
  random: 'Random',
  custom: 'Custom Strategy',
};

const getStrategyName = (strategyType: string, customName?: string) => {
  if (strategyType === 'custom') {
    return customName || 'Custom Strategy';
  }
  return STRATEGY_LABELS[strategyType] || strategyType;
};

/** A single side's strategy selection, shared by single-batch and compare-mode runs. */
export interface StrategySelection {
  strategyType: string;
  strategyParams?: Record<string, unknown>;
  customRules?: CustomRule[];
  customStrategyName?: string;
}

interface RunBatchOptions extends StrategySelection {
  seeds: string[];
  seedMode: 'random' | 'fixed' | 'shared';
  /** Threads a Compare-mode pairing id into the stored Batch (optional field). */
  comparisonId?: string;
  /** Disambiguates batch ids for two batches created within the same tick (compare mode). */
  idSuffix?: string;
}

interface GameStore {
  // Current game instance
  engine: GameEngine | null;
  gameState: GameState | null;

  // Game controls
  startNewGame: (seed?: string) => void;
  makeMove: (direction: Direction) => boolean;
  resetGame: () => void;

  // Batch simulation
  batchResults: GameResult[];
  isRunningBatch: boolean;
  batchProgress: number;
  batchTotal: number;
  currentBatchId: string | null;
  recentBatches: Batch[];
  selectedBatchId: string | null;
  worker: Worker | null;

  // Batch methods
  startBatchSimulation: (config: {
    strategyType: string;
    strategyParams?: Record<string, unknown>;
    batchSize: number;
    seedMode: 'random' | 'fixed' | 'shared';
    fixedSeed?: string;
    customRules?: CustomRule[];
    customStrategyName?: string;
  }) => void;
  stopBatchSimulation: () => void;
  loadRecentBatches: () => Promise<void>;
  selectBatch: (batchId: string | null) => Promise<void>;

  // Compare mode: runs two batches sequentially on identical seeds, reusing
  // the same single-worker lifecycle as startBatchSimulation.
  isRunningComparison: boolean;
  comparisonId: string | null;
  compareBatchIdA: string | null;
  compareBatchIdB: string | null;
  selectedComparisonId: string | null;
  comparisonBatchA: Batch | null;
  comparisonBatchB: Batch | null;
  comparisonResultsA: GameResult[];
  comparisonResultsB: GameResult[];
  startComparisonSimulation: (
    configA: StrategySelection,
    configB: StrategySelection,
    options: { batchSize: number }
  ) => void;
  selectComparisonPair: (comparisonId: string | null) => Promise<void>;

  // Saved strategies
  savedStrategies: Strategy[];
  loadSavedStrategies: () => Promise<void>;
  saveCustomStrategy: (name: string, customRules: CustomRule[]) => Promise<void>;
  deleteCustomStrategy: (id: string) => Promise<void>;

  // Storage error surfaced to UI when persistence fails
  storageError: string | null;
  clearStorageError: () => void;

  // View state
  selectedGameId: string | null;
  viewMode: 'play' | 'batch' | 'results';
  setViewMode: (mode: 'play' | 'batch' | 'results') => void;
  selectGame: (gameId: string | null) => void;

  // Initialize
  initialize: () => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => {
  /**
   * Runs a single batch job to completion against the shared worker
   * lifecycle: terminates any prior worker, persists the running/complete/
   * failed Batch record, streams progress into store state, and resolves
   * once the batch finishes (successfully or not). Used by both
   * startBatchSimulation (fire-and-forget) and startComparisonSimulation
   * (awaited twice, sequentially, on identical seeds).
   */
  const runBatchJob = (options: RunBatchOptions): Promise<{ batchId: string; success: boolean }> => {
    return new Promise((resolveJob) => {
      // Terminate any existing worker before starting a new batch to avoid leaks.
      const existingWorker = get().worker;
      if (existingWorker) {
        existingWorker.terminate();
        set({ worker: null });
      }

      const batchId = `batch_${Date.now()}${options.idSuffix ? `_${options.idSuffix}` : ''}`;
      const strategyId = `${options.strategyType}_${Date.now()}`;
      const jobId = `job_${Date.now()}`;
      const strategyName = getStrategyName(options.strategyType, options.customStrategyName);
      const createdAt = new Date().toISOString();

      const runningBatch: Batch = {
        id: batchId,
        strategyIds: [strategyId],
        gameCount: options.seeds.length,
        status: 'running',
        strategyType: options.strategyType,
        strategyName,
        seedMode: options.seedMode,
        seeds: options.seeds,
        createdAt,
        comparisonId: options.comparisonId,
      };

      void db.saveBatch(runningBatch).catch((error) => {
        set({
          storageError: `Failed to save batch: ${error instanceof Error ? error.message : String(error)}`,
        });
      });

      // Create and start worker
      const worker = new Worker(
        new URL('../workers/simulationWorker.ts', import.meta.url),
        { type: 'module' }
      );

      // Progress messages carry only the results since the previous message
      // (deltas); accumulate them here for the final result set.
      const accumulatedResults: GameResult[] = [];
      // Set when a mid-batch delta fails to persist; the batch must then be
      // marked failed rather than complete, since games would be missing.
      let deltaSaveFailed = false;

      const failBatch = (message: string) => {
        worker.terminate();
        set({
          worker: null,
          isRunningBatch: false,
          currentBatchId: null,
          storageError: message,
        });
        void db.saveBatch({ ...runningBatch, status: 'failed' }).catch(() => {
          /* nothing more we can do if this also fails */
        });
        resolveJob({ batchId, success: false });
      };

      // A worker-level crash (e.g. a strategy factory throwing on malformed
      // saved rules) never sends a message — without this the batch would sit
      // at "Running..." forever.
      worker.onerror = (e) => {
        failBatch(`Simulation failed: ${e.message || 'worker error'}`);
      };
      worker.onmessageerror = () => {
        failBatch('Simulation failed: could not read worker message');
      };

      worker.onmessage = (e: MessageEvent<SimulationProgress>) => {
        const progress = e.data;
        accumulatedResults.push(...progress.results);

        // Update progress
        set({
          batchProgress: progress.completed,
          batchTotal: progress.total,
        });

        const isFinal = progress.completed === progress.total;

        // Save the delta to DB. The final delta is saved in the completion
        // block below (with error handling that fails the batch), so each game
        // is written exactly once.
        if (!isFinal && progress.results.length > 0) {
          void db.saveGames(progress.results).catch((error) => {
            deltaSaveFailed = true;
            set({
              storageError: `Failed to save game results: ${error instanceof Error ? error.message : String(error)}`,
            });
          });
        }

        // If completed
        if (isFinal) {
          worker.terminate();
          set({ worker: null });

          void (async () => {
            try {
              await db.saveGames(progress.results);
              if (deltaSaveFailed) {
                throw new Error(
                  'some game results failed to save earlier in the run'
                );
              }
              const completedAt = new Date().toISOString();
              await db.saveBatch({
                ...runningBatch,
                status: 'complete',
                completedAt,
              });
              await db.pruneCompletedBatches(MAX_COMPLETED_BATCHES);
              await get().loadRecentBatches();

              // Only mark the batch complete in UI state once persistence succeeded.
              set({
                isRunningBatch: false,
                currentBatchId: null,
                selectedBatchId: batchId,
                selectedGameId: null,
                batchResults: accumulatedResults.slice(),
                viewMode: 'results',
              });
              resolveJob({ batchId, success: true });
            } catch (error) {
              set({
                isRunningBatch: false,
                currentBatchId: null,
                storageError: `Failed to save batch results: ${error instanceof Error ? error.message : String(error)}`,
              });

              // Best-effort: mark the batch as failed since persistence didn't complete.
              void db
                .saveBatch({ ...runningBatch, status: 'failed' })
                .catch(() => {
                  /* nothing more we can do if this also fails */
                });
              resolveJob({ batchId, success: false });
            }
          })();
        }
      };

      // Send job to worker
      const job: SimulationJob = {
        jobId,
        strategyId,
        strategyType: options.strategyType,
        strategyParams: options.strategyParams,
        seeds: options.seeds,
        batchId,
        customRules: options.customRules,
        customStrategyName: options.customStrategyName,
      };

      worker.postMessage(job);

      set({
        worker,
        isRunningBatch: true,
        batchProgress: 0,
        batchTotal: options.seeds.length,
        currentBatchId: batchId,
        batchResults: [],
        selectedGameId: null,
      });
    });
  };

  return {
    // Initial state
    engine: null,
    gameState: null,
    batchResults: [],
    isRunningBatch: false,
    batchProgress: 0,
    batchTotal: 0,
    currentBatchId: null,
    recentBatches: [],
    selectedBatchId: null,
    worker: null,
    selectedGameId: null,
    viewMode: 'play',
    savedStrategies: [],
    storageError: null,

    isRunningComparison: false,
    comparisonId: null,
    compareBatchIdA: null,
    compareBatchIdB: null,
    selectedComparisonId: null,
    comparisonBatchA: null,
    comparisonBatchB: null,
    comparisonResultsA: [],
    comparisonResultsB: [],

    // Initialize database and load existing results
    initialize: async () => {
      await db.init();
      await db.pruneCompletedBatches(MAX_COMPLETED_BATCHES);
      await get().loadRecentBatches();
      await get().loadSavedStrategies();
    },

    // Start a new game
    startNewGame: (seed?: string) => {
      const gameSeed = seed || generateSeed();
      const engine = new GameEngine(gameSeed);
      const gameState = engine.getState();

      set({
        engine,
        gameState,
      });
    },

    // Make a move
    makeMove: (direction: Direction) => {
      const { engine } = get();
      if (!engine) return false;

      const moved = engine.move(direction);
      if (moved) {
        set({ gameState: engine.getState() });
      }

      return moved;
    },

    // Reset current game
    resetGame: () => {
      const { engine } = get();
      if (!engine) return;

      engine.reset();
      set({ gameState: engine.getState() });
    },

    // Start batch simulation
    startBatchSimulation: (config) => {
      // Generate seeds based on mode
      const seeds: string[] = [];
      if (config.seedMode === 'random') {
        for (let i = 0; i < config.batchSize; i++) {
          seeds.push(generateSeed());
        }
      } else if (config.seedMode === 'fixed') {
        for (let i = 0; i < config.batchSize; i++) {
          seeds.push(config.fixedSeed || generateSeed());
        }
      } else {
        // shared mode - generate unique seeds for comparison
        for (let i = 0; i < config.batchSize; i++) {
          seeds.push(generateSeed());
        }
      }

      void runBatchJob({
        strategyType: config.strategyType,
        strategyParams: config.strategyParams,
        customRules: config.customRules,
        customStrategyName: config.customStrategyName,
        seeds,
        seedMode: config.seedMode,
      });
    },

    // Stop batch simulation
    stopBatchSimulation: () => {
      const { worker, currentBatchId } = get();
      if (worker) {
        worker.terminate();
        set({
          worker: null,
          isRunningBatch: false,
          currentBatchId: null,
          batchProgress: 0,
        });

        // Update batch status to failed
        if (currentBatchId) {
          void db
            .getBatch(currentBatchId)
            .then((batch) => {
              if (batch) {
                return db.saveBatch({ ...batch, status: 'failed' });
              }
            })
            .catch((error) => {
              set({
                storageError: `Failed to update batch status after cancellation: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              });
            });
        }
      }
    },

    clearStorageError: () => set({ storageError: null }),

    // Load recent completed batches and selected batch results
    loadRecentBatches: async () => {
      const recentBatches = await db.getCompletedBatches(MAX_COMPLETED_BATCHES);
      const currentSelected = get().selectedBatchId;
      const selectedBatchId =
        currentSelected && recentBatches.some((batch) => batch.id === currentSelected)
          ? currentSelected
          : (recentBatches[0]?.id || null);

      const batchResults = selectedBatchId
        ? await db.getGamesByBatch(selectedBatchId)
        : [];
      const selectedGameId = get().selectedGameId;
      const nextSelectedGameId =
        selectedGameId && batchResults.some((result) => result.id === selectedGameId)
          ? selectedGameId
          : null;

      set({
        recentBatches,
        selectedBatchId,
        batchResults,
        selectedGameId: nextSelectedGameId,
      });
    },

    selectBatch: async (batchId) => {
      if (!batchId) {
        set({
          selectedBatchId: null,
          batchResults: [],
          selectedGameId: null,
        });
        return;
      }

      const batchResults = await db.getGamesByBatch(batchId);
      set({
        selectedBatchId: batchId,
        batchResults,
        selectedGameId: null,
      });
    },

    // Compare mode: run strategy A then strategy B on identical seeds.
    startComparisonSimulation: (configA, configB, options) => {
      const seeds: string[] = [];
      for (let i = 0; i < options.batchSize; i++) {
        seeds.push(generateSeed());
      }

      const comparisonId = `cmp_${Date.now()}`;
      set({
        isRunningComparison: true,
        comparisonId,
        compareBatchIdA: null,
        compareBatchIdB: null,
        selectedComparisonId: null,
      });

      void (async () => {
        const resultA = await runBatchJob({
          ...configA,
          seeds,
          seedMode: 'shared',
          comparisonId,
          idSuffix: 'A',
        });

        if (!resultA.success) {
          set({ isRunningComparison: false, compareBatchIdA: resultA.batchId });
          return;
        }

        set({ compareBatchIdA: resultA.batchId });

        const resultB = await runBatchJob({
          ...configB,
          seeds,
          seedMode: 'shared',
          comparisonId,
          idSuffix: 'B',
        });

        set({
          isRunningComparison: false,
          compareBatchIdB: resultB.batchId,
        });

        if (resultB.success) {
          await get().selectComparisonPair(comparisonId);
        }
      })();
    },

    selectComparisonPair: async (comparisonId) => {
      if (!comparisonId) {
        set({
          selectedComparisonId: null,
          comparisonResultsA: [],
          comparisonResultsB: [],
          comparisonBatchA: null,
          comparisonBatchB: null,
        });
        return;
      }

      const batches = await db.getAllBatches();
      const pair = batches
        .filter((batch) => batch.comparisonId === comparisonId)
        .sort((a, b) => a.id.localeCompare(b.id));
      const batchA = pair.find((batch) => batch.id.endsWith('_A')) || pair[0] || null;
      const batchB = pair.find((batch) => batch.id.endsWith('_B')) || pair[1] || null;

      const [resultsA, resultsB] = await Promise.all([
        batchA ? db.getGamesByBatch(batchA.id) : Promise.resolve([]),
        batchB ? db.getGamesByBatch(batchB.id) : Promise.resolve([]),
      ]);

      set({
        selectedComparisonId: comparisonId,
        comparisonBatchA: batchA,
        comparisonBatchB: batchB,
        comparisonResultsA: resultsA,
        comparisonResultsB: resultsB,
      });
    },

    // Saved strategies
    loadSavedStrategies: async () => {
      const strategies = await db.getAllStrategies();
      set({ savedStrategies: strategies });
    },

    saveCustomStrategy: async (name: string, customRules: CustomRule[]) => {
      const strategy: Strategy = {
        id: 'custom_' + Date.now(),
        name,
        type: 'custom',
        params: { customRules },
        stats: { gamesPlayed: 0, winRate: 0, avgScore: 0, avgMoves: 0, bestScore: 0 },
      };
      await db.saveStrategy(strategy);
      await get().loadSavedStrategies();
    },

    deleteCustomStrategy: async (id: string) => {
      await db.deleteStrategy(id);
      await get().loadSavedStrategies();
    },

    // View controls
    setViewMode: (mode) => set({ viewMode: mode }),
    selectGame: (gameId) => set({ selectedGameId: gameId }),
  };
});
