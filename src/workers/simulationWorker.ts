/**
 * Web Worker for running batch game simulations
 * Runs headless games at maximum speed without blocking the UI
 */

import { runGame } from '../engine/gameRunner';
import { createStrategy, type StrategyFactoryParams } from '../engine/strategy';
import { CustomStrategyFactory } from '../engine/customStrategyFactory';
import type { GameResult } from '../engine/types';
import type { CustomRule } from '../engine/customRules';

export interface SimulationJob {
  jobId: string;
  strategyId: string;
  strategyType: string;
  strategyParams?: StrategyFactoryParams | Record<string, unknown>;
  seeds: string[];
  batchId: string;
  customRules?: CustomRule[];
  customStrategyName?: string;
}

export interface SimulationProgress {
  jobId: string;
  completed: number;
  total: number;
  /**
   * Only the results produced since the PREVIOUS progress message (a delta),
   * not the full accumulated set. The main thread (gameStore) accumulates
   * deltas; this keeps serialization O(batch) overall instead of O(batch^2).
   */
  results: GameResult[];
}

// Handle messages from main thread
self.onmessage = (e: MessageEvent) => {
  const job: SimulationJob = e.data;
  runSimulation(job);
};

function runSimulation(job: SimulationJob) {
  // Build a fresh strategy per game so stateful strategies (pattern cursor,
  // seeded RNG stream) cannot leak state from one game into the next.
  const makeStrategy = () =>
    job.customRules && job.customRules.length > 0
      ? CustomStrategyFactory.createFromRules(job.customRules, job.customStrategyName)
      : createStrategy(job.strategyType, job.strategyParams as StrategyFactoryParams | undefined);

  // Buffer of results not yet posted to the main thread (delta since the
  // last progress message).
  let pendingResults: GameResult[] = [];

  for (let i = 0; i < job.seeds.length; i++) {
    const seed = job.seeds[i];
    const gameStartTime = Date.now();

    // Run the game with a fresh, per-game strategy instance through the
    // shared loop in gameRunner.ts (same loop as playGameWithStrategy).
    const outcome = runGame(seed, makeStrategy());
    const gameEndTime = Date.now();

    // Create result record
    const result: GameResult = {
      id: `${job.jobId}_${i}`,
      seed,
      strategyId: job.strategyId,
      batchId: job.batchId,
      moves: outcome.moves,
      finalScore: outcome.score,
      maxTile: outcome.maxTile,
      moveCount: outcome.moveCount,
      result: outcome.won ? 'win' : 'loss',
      timestamp: gameStartTime,
      durationMs: gameEndTime - gameStartTime,
    };

    pendingResults.push(result);

    // Send progress update every 10 games or on completion. Each message
    // carries only the delta since the previous message (see
    // SimulationProgress.results); the store accumulates.
    if ((i + 1) % 10 === 0 || i === job.seeds.length - 1) {
      const progress: SimulationProgress = {
        jobId: job.jobId,
        completed: i + 1,
        total: job.seeds.length,
        results: pendingResults,
      };
      pendingResults = [];
      self.postMessage(progress);
    }
  }
}
