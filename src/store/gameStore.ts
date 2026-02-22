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
    strategyParams?: any;
    batchSize: number;
    seedMode: 'random' | 'fixed' | 'shared';
    fixedSeed?: string;
    customRules?: any[];
    customStrategyName?: string;
  }) => void;
  stopBatchSimulation: () => void;
  loadRecentBatches: () => Promise<void>;
  selectBatch: (batchId: string | null) => Promise<void>;

  // Saved strategies
  savedStrategies: Strategy[];
  loadSavedStrategies: () => Promise<void>;
  saveCustomStrategy: (name: string, customRules: any[]) => Promise<void>;
  deleteCustomStrategy: (id: string) => Promise<void>;

  // View state
  selectedGameId: string | null;
  viewMode: 'play' | 'batch' | 'results';
  setViewMode: (mode: 'play' | 'batch' | 'results') => void;
  selectGame: (gameId: string | null) => void;

  // Initialize
  initialize: () => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
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

    // Create batch ID and job
    const batchId = `batch_${Date.now()}`;
    const strategyId = `${config.strategyType}_${Date.now()}`;
    const jobId = `job_${Date.now()}`;
    const strategyName = getStrategyName(config.strategyType, config.customStrategyName);
    const createdAt = new Date().toISOString();

    const runningBatch: Batch = {
      id: batchId,
      strategyIds: [strategyId],
      gameCount: config.batchSize,
      status: 'running',
      strategyType: config.strategyType,
      strategyName,
      seedMode: config.seedMode,
      seeds,
      createdAt,
    };

    void db.saveBatch(runningBatch);

    // Create and start worker
    const worker = new Worker(
      new URL('../workers/simulationWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent<SimulationProgress>) => {
      const progress = e.data;

      // Update progress
      set({
        batchProgress: progress.completed,
        batchTotal: progress.total,
      });

      // Save results to DB
      if (progress.results.length > 0) {
        void db.saveGames(progress.results);
      }

      // If completed
      if (progress.completed === progress.total) {
        worker.terminate();

        set({
          isRunningBatch: false,
          currentBatchId: null,
          selectedBatchId: batchId,
          selectedGameId: null,
          batchResults: progress.results.slice(),
          viewMode: 'results',
          worker: null,
        });

        void (async () => {
          await db.saveGames(progress.results);
          const completedAt = new Date().toISOString();
          await db.saveBatch({
            ...runningBatch,
            status: 'complete',
            completedAt,
          });
          await db.pruneCompletedBatches(MAX_COMPLETED_BATCHES);
          await get().loadRecentBatches();
        })();
      }
    };

    // Send job to worker
    const job: SimulationJob = {
      jobId,
      strategyId,
      strategyType: config.strategyType,
      strategyParams: config.strategyParams,
      seeds,
      batchId,
      customRules: config.customRules,
      customStrategyName: config.customStrategyName,
    };

    worker.postMessage(job);

    set({
      worker,
      isRunningBatch: true,
      batchProgress: 0,
      batchTotal: config.batchSize,
      currentBatchId: batchId,
      batchResults: [],
      selectedGameId: null,
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
        void db.getBatch(currentBatchId).then((batch) => {
          if (batch) {
            return db.saveBatch({ ...batch, status: 'failed' });
          }
        });
      }
    }
  },

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

  // Saved strategies
  loadSavedStrategies: async () => {
    const strategies = await db.getAllStrategies();
    set({ savedStrategies: strategies });
  },

  saveCustomStrategy: async (name: string, customRules: any[]) => {
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
}));
