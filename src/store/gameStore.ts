/**
 * Zustand store for game state management
 */

import { create } from 'zustand';
import { GameEngine } from '../engine/gameEngine';
import { generateSeed } from '../engine/rng';
import type { GameState, Direction, GameResult } from '../engine/types';
import type { SimulationJob, SimulationProgress } from '../workers/simulationWorker';
import { db } from '../storage/db';

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
  worker: Worker | null;

  // Batch methods
  startBatchSimulation: (config: {
    strategyType: string;
    strategyParams?: any;
    batchSize: number;
    seedMode: 'random' | 'fixed' | 'shared';
    fixedSeed?: string;
  }) => void;
  stopBatchSimulation: () => void;
  loadAllResults: () => Promise<void>;

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
  worker: null,
  selectedGameId: null,
  viewMode: 'play',

  // Initialize database and load existing results
  initialize: async () => {
    await db.init();
    await get().loadAllResults();
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

    // Save batch to DB
    db.saveBatch({
      id: batchId,
      strategyIds: [strategyId],
      gameCount: config.batchSize,
      status: 'running',
      seedMode: config.seedMode,
      seeds,
      createdAt: new Date().toISOString(),
    });

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
        db.saveGames(progress.results);
      }

      // If completed
      if (progress.completed === progress.total) {
        set({
          isRunningBatch: false,
          batchResults: progress.results,
          viewMode: 'results',
        });

        // Update batch status
        db.saveBatch({
          id: batchId,
          strategyIds: [strategyId],
          gameCount: config.batchSize,
          status: 'complete',
          seedMode: config.seedMode,
          seeds,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        });

        // Cleanup worker
        worker.terminate();
        set({ worker: null });
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
    };

    worker.postMessage(job);

    set({
      worker,
      isRunningBatch: true,
      batchProgress: 0,
      batchTotal: config.batchSize,
      currentBatchId: batchId,
      batchResults: [],
    });
  },

  // Stop batch simulation
  stopBatchSimulation: () => {
    const { worker, currentBatchId } = get();
    if (worker) {
      worker.terminate();
      set({ worker: null, isRunningBatch: false });

      // Update batch status to failed
      if (currentBatchId) {
        db.getBatch(currentBatchId).then((batch) => {
          if (batch) {
            db.saveBatch({ ...batch, status: 'failed' });
          }
        });
      }
    }
  },

  // Load all results from DB
  loadAllResults: async () => {
    const games = await db.getAllGames();
    set({ batchResults: games });
  },

  // View controls
  setViewMode: (mode) => set({ viewMode: mode }),
  selectGame: (gameId) => set({ selectedGameId: gameId }),
}));
