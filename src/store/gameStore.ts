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
import { migrateCustomRules, type CustomRule } from '../engine/customRules';

const MAX_COMPLETED_BATCHES = 10;
const MAX_BATCH_SIZE = 10000;
let nextId = 0;
const uniqueId = (prefix: string) => `${prefix}_${Date.now()}_${++nextId}`;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const STRATEGY_LABELS: Record<string, string> = {
  directional_priority: 'Directional Priority',
  corner_anchor: 'Corner Anchor',
  merge_max: 'Merge Maximization',
  random: 'Random',
  pattern: 'Repeat Sequence',
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
  saveCustomStrategy: (name: string, customRules: CustomRule[], id?: string) => Promise<string | null>;
  deleteCustomStrategy: (id: string) => Promise<boolean>;

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
  // A session owns either one batch or both halves of a comparison. Changing
  // the session invalidates queued callbacks, including persistence completion.
  let session = 0;
  let selectionVersion = 0;
  let comparisonSelectionVersion = 0;
  let activeJob: { cancel: () => void } | null = null;

  const cancelSimulation = () => {
    session++;
    selectionVersion++;
    comparisonSelectionVersion++;
    activeJob?.cancel();
    set({ isRunningComparison: false, isRunningBatch: false, worker: null, currentBatchId: null });
  };

  const validateBatchSize = (batchSize: number): boolean => {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
      set({ storageError: `Choose a whole number of games between 1 and ${MAX_BATCH_SIZE.toLocaleString()}.` });
      return false;
    }
    return true;
  };

  const runBatchJob = (options: RunBatchOptions, ownerSession: number): Promise<{ batchId: string; success: boolean }> => {
    activeJob?.cancel();
    return new Promise((resolveJob) => {
      const batchId = `${uniqueId('batch')}${options.idSuffix ? `_${options.idSuffix}` : ''}`;
      const strategyId = uniqueId(options.strategyType);
      const jobId = uniqueId('job');
      const runningBatch: Batch = {
        id: batchId,
        strategyIds: [strategyId],
        gameCount: options.seeds.length,
        status: 'running',
        strategyType: options.strategyType,
        strategyName: getStrategyName(options.strategyType, options.customStrategyName),
        seedMode: options.seedMode,
        seeds: options.seeds,
        createdAt: new Date().toISOString(),
        comparisonId: options.comparisonId,
      };
      const accumulatedResults: GameResult[] = [];
      let worker: Worker | null = null;
      let settled = false;
      let finishing = false;
      let completed = 0;
      // Serialize all writes, including the initial record. Completion must
      // wait for every delta, so a late write failure cannot produce a false
      // success or leave cancelled batches marked as running/complete.
      let persistence = db.saveBatch(runningBatch);
      const isActive = () => !settled && session === ownerSession && activeJob === handle;
      const releaseWorker = () => {
        if (!worker) return;
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        worker.terminate();
        worker = null;
      };
      const failBatch = (message?: string) => {
        if (settled) return;
        const wasActive = isActive();
        settled = true;
        releaseWorker();
        if (activeJob === handle) activeJob = null;
        if (wasActive) {
          set({
            worker: null,
            isRunningBatch: false,
            currentBatchId: null,
            ...(message ? { storageError: message } : {}),
          });
        }
        // Queue the failed status after any already-started writes. This
        // also covers cancelling while the last results are being saved.
        void persistence.catch(() => undefined)
          .then(() => db.saveBatch({ ...runningBatch, status: 'failed' }))
          .catch((error) => {
            if (session === ownerSession) {
              set({ storageError: `Failed to update batch status: ${errorMessage(error)}` });
            }
          });
        resolveJob({ batchId, success: false });
      };
      const handle = { cancel: () => failBatch() };
      activeJob = handle;
      set({
        worker: null,
        isRunningBatch: true,
        batchProgress: 0,
        batchTotal: options.seeds.length,
        currentBatchId: batchId,
        batchResults: [],
        selectedGameId: null,
        storageError: null,
      });
      if (options.comparisonId) {
        set(options.idSuffix === 'A' ? { compareBatchIdA: batchId } : { compareBatchIdB: batchId });
      }
      void persistence.catch((error) => failBatch(`Failed to save batch: ${errorMessage(error)}`));

      try {
        worker = new Worker(new URL('../workers/simulationWorker.ts', import.meta.url), { type: 'module' });
        worker.onerror = (event) => {
          if (isActive()) failBatch(`Simulation failed: ${event.message || 'worker error'}`);
        };
        worker.onmessageerror = () => {
          if (isActive()) failBatch('Simulation failed: could not read worker message');
        };
        worker.onmessage = (event: MessageEvent<SimulationProgress>) => {
          if (!isActive() || finishing) return;
          const progress = event.data;
          if (progress.jobId !== jobId) return;
          if (!Number.isInteger(progress.completed) || progress.completed < completed ||
              progress.total !== options.seeds.length || progress.completed > progress.total ||
              !Array.isArray(progress.results) || progress.results.length !== progress.completed - completed) {
            failBatch('Simulation failed: received invalid progress');
            return;
          }
          completed = progress.completed;
          accumulatedResults.push(...progress.results);
          set({ batchProgress: completed, batchTotal: progress.total, batchResults: accumulatedResults.slice() });
          if (progress.results.length) {
            persistence = persistence.then(() => db.saveGames(progress.results));
            void persistence.catch((error) => failBatch(`Failed to save game results: ${errorMessage(error)}`));
          }
          if (completed !== progress.total) return;
          finishing = true;
          releaseWorker();
          set({ worker: null });
          void (async () => {
            try {
              await persistence;
              if (!isActive()) return;
              persistence = persistence.then(() => db.saveBatch({
                ...runningBatch,
                status: 'complete',
                completedAt: new Date().toISOString(),
              }));
              await persistence;
              if (!isActive()) return;
              await db.pruneCompletedBatches(MAX_COMPLETED_BATCHES);
              const recentBatches = await db.getCompletedBatches(MAX_COMPLETED_BATCHES);
              if (!isActive()) return;
              settled = true;
              activeJob = null;
              selectionVersion++;
              set({
                isRunningBatch: false,
                currentBatchId: null,
                recentBatches,
                selectedBatchId: batchId,
                selectedGameId: null,
                batchResults: accumulatedResults.slice(),
                viewMode: options.comparisonId ? get().viewMode : 'results',
              });
              resolveJob({ batchId, success: true });
            } catch (error) {
              if (isActive()) failBatch(`Failed to save batch results: ${errorMessage(error)}`);
            }
          })();
        };
        set({ worker });
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
      } catch (error) {
        failBatch(`Simulation failed to start: ${errorMessage(error)}`);
      }
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
    viewMode: 'batch',
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
      try {
        await db.init();
        await db.pruneCompletedBatches(MAX_COMPLETED_BATCHES);
        await get().loadRecentBatches();
        await get().loadSavedStrategies();
      } catch (error) {
        set({ storageError: `Failed to load saved data: ${errorMessage(error)}` });
      }
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
      if (!validateBatchSize(config.batchSize)) return;
      if (config.seedMode === 'fixed' && !config.fixedSeed?.trim()) {
        set({ storageError: 'Enter a seed for reproducible games.' });
        return;
      }
      cancelSimulation();
      const seeds = Array.from({ length: config.batchSize }, () =>
        config.seedMode === 'fixed' ? config.fixedSeed!.trim() : generateSeed()
      );
      set({ selectedComparisonId: null });
      void runBatchJob({
        ...config,
        seeds,
      }, session);
    },

    stopBatchSimulation: () => {
      cancelSimulation();
      set({ batchProgress: 0 });
    },

    clearStorageError: () => set({ storageError: null }),

    // Load recent completed batches and selected batch results
    loadRecentBatches: async () => {
      const request = ++selectionVersion;
      const ownerSession = session;
      try {
        const recentBatches = await db.getCompletedBatches(MAX_COMPLETED_BATCHES);
        const currentSelected = get().selectedBatchId;
        const selectedBatchId = currentSelected && recentBatches.some((batch) => batch.id === currentSelected)
          ? currentSelected : (recentBatches[0]?.id || null);
        const batchResults = selectedBatchId ? await db.getGamesByBatch(selectedBatchId) : [];
        if (request !== selectionVersion || session !== ownerSession) return;
        const selectedGameId = get().selectedGameId;
        set({
          recentBatches,
          selectedBatchId,
          batchResults,
          selectedGameId: selectedGameId && batchResults.some((result) => result.id === selectedGameId)
            ? selectedGameId : null,
        });
      } catch (error) {
        if (request === selectionVersion && session === ownerSession) {
          set({ storageError: `Failed to load batches: ${errorMessage(error)}` });
        }
      }
    },

    selectBatch: async (batchId) => {
      const request = ++selectionVersion;
      const ownerSession = session;
      set({ selectedBatchId: batchId, batchResults: [], selectedGameId: null });
      if (!batchId) return;
      try {
        const batchResults = await db.getGamesByBatch(batchId);
        if (request === selectionVersion && session === ownerSession) set({ batchResults });
      } catch (error) {
        if (request === selectionVersion && session === ownerSession) {
          set({ storageError: `Failed to load results: ${errorMessage(error)}` });
        }
      }
    },

    // Compare mode: run strategy A then strategy B on identical seeds.
    startComparisonSimulation: (configA, configB, options) => {
      if (!validateBatchSize(options.batchSize)) return;
      cancelSimulation();
      const ownerSession = session;
      const seeds = Array.from({ length: options.batchSize }, () => generateSeed());
      const comparisonId = uniqueId('cmp');
      set({
        isRunningComparison: true,
        comparisonId,
        compareBatchIdA: null,
        compareBatchIdB: null,
        selectedComparisonId: null,
        comparisonBatchA: null,
        comparisonBatchB: null,
        comparisonResultsA: [],
        comparisonResultsB: [],
      });
      void (async () => {
        try {
          const resultA = await runBatchJob({
            ...configA,
            seeds,
            seedMode: 'shared',
            comparisonId,
            idSuffix: 'A',
          }, ownerSession);
          if (session !== ownerSession) return;
          set({ compareBatchIdA: resultA.batchId });
          if (!resultA.success) {
            set({ isRunningComparison: false });
            return;
          }
          const resultB = await runBatchJob({
            ...configB,
            seeds,
            seedMode: 'shared',
            comparisonId,
            idSuffix: 'B',
          }, ownerSession);
          if (session !== ownerSession) return;
          set({ isRunningComparison: false, compareBatchIdB: resultB.batchId });
          if (resultB.success) {
            await get().selectComparisonPair(comparisonId);
            if (session === ownerSession) set({ viewMode: 'results' });
          }
        } catch (error) {
          if (session === ownerSession) {
            set({ isRunningComparison: false, storageError: `Comparison failed: ${errorMessage(error)}` });
          }
        }
      })();
    },

    selectComparisonPair: async (comparisonId) => {
      const request = ++comparisonSelectionVersion;
      const ownerSession = session;
      set({
        selectedComparisonId: comparisonId,
        comparisonResultsA: [],
        comparisonResultsB: [],
        comparisonBatchA: null,
        comparisonBatchB: null,
      });
      if (!comparisonId) return;
      try {
        const batches = await db.getAllBatches();
        const pair = batches.filter((batch) => batch.comparisonId === comparisonId)
          .sort((a, b) => a.id.localeCompare(b.id));
        const batchA = pair.find((batch) => batch.id.endsWith('_A')) || pair[0] || null;
        const batchB = pair.find((batch) => batch.id.endsWith('_B')) || pair[1] || null;
        const [resultsA, resultsB] = await Promise.all([
          batchA ? db.getGamesByBatch(batchA.id) : Promise.resolve([]),
          batchB ? db.getGamesByBatch(batchB.id) : Promise.resolve([]),
        ]);
        if (request !== comparisonSelectionVersion || session !== ownerSession) return;
        set({
          comparisonBatchA: batchA,
          comparisonBatchB: batchB,
          comparisonResultsA: resultsA,
          comparisonResultsB: resultsB,
        });
      } catch (error) {
        if (request === comparisonSelectionVersion && session === ownerSession) {
          set({ storageError: `Failed to load comparison: ${errorMessage(error)}` });
        }
      }
    },

    // Saved strategies. Legacy rule lists (weighted / lookahead /
    // conditional / multi-rule) are migrated to the consolidated evaluation
    // model on load; the original rules are kept alongside for provenance.
    loadSavedStrategies: async () => {
      const strategies = await db.getAllStrategies();
      const upgraded = await Promise.all(
        strategies.map(async (strategy) => {
          const rules = strategy.params?.customRules as CustomRule[] | undefined;
          if (!rules || rules.length === 0) return strategy;
          const { rules: migrated, converted } = migrateCustomRules(rules);
          if (!converted) return strategy;
          const next: Strategy = {
            ...strategy,
            params: {
              ...strategy.params,
              customRules: migrated,
              legacyRules: strategy.params.legacyRules ?? rules,
              converted: true,
            },
          };
          await db.saveStrategy(next).catch(() => {
            /* keep the in-memory migration even if persistence fails */
          });
          return next;
        })
      );
      set({ savedStrategies: upgraded });
    },

    saveCustomStrategy: async (name: string, customRules: CustomRule[], id?: string) => {
      try {
        const existing = id ? await db.getStrategy(id) : null;
        const strategy: Strategy = {
          id: existing?.id ?? uniqueId('custom'),
          name: name.trim(),
          type: 'custom',
          params: { customRules },
          stats: existing?.stats ?? { gamesPlayed: 0, winRate: 0, avgScore: 0, avgMoves: 0, bestScore: 0 },
        };
        await db.saveStrategy(strategy);
        await get().loadSavedStrategies();
        set({ storageError: null });
        return strategy.id;
      } catch (error) {
        set({ storageError: `Failed to save strategy: ${errorMessage(error)}` });
        return null;
      }
    },

    deleteCustomStrategy: async (id: string) => {
      try {
        await db.deleteStrategy(id);
        await get().loadSavedStrategies();
        set({ storageError: null });
        return true;
      } catch (error) {
        set({ storageError: `Failed to delete strategy: ${errorMessage(error)}` });
        return false;
      }
    },

    // View controls
    setViewMode: (mode) => set({ viewMode: mode }),
    selectGame: (gameId) => set({ selectedGameId: gameId }),
  };
});
