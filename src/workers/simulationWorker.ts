/**
 * Web Worker for running batch game simulations
 * Runs headless games at maximum speed without blocking the UI
 */

import { GameEngine } from '../engine/gameEngine';
import { createStrategy } from '../engine/strategy';
import { CustomStrategyFactory } from '../engine/customStrategyFactory';
import type { GameResult } from '../engine/types';
import type { CustomRule } from '../engine/customRules';

export interface SimulationJob {
  jobId: string;
  strategyId: string;
  strategyType: string;
  strategyParams?: any;
  seeds: string[];
  batchId: string;
  customRules?: CustomRule[];
  customStrategyName?: string;
}

export interface SimulationProgress {
  jobId: string;
  completed: number;
  total: number;
  results: GameResult[];
}

// Handle messages from main thread
self.onmessage = (e: MessageEvent) => {
  const job: SimulationJob = e.data;
  runSimulation(job);
};

function runSimulation(job: SimulationJob) {
  // Create strategy - either custom or built-in
  const strategy =
    job.customRules && job.customRules.length > 0
      ? CustomStrategyFactory.createFromRules(job.customRules, job.customStrategyName)
      : createStrategy(job.strategyType, job.strategyParams);

  const results: GameResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < job.seeds.length; i++) {
    const seed = job.seeds[i];
    const gameStartTime = Date.now();

    // Run the game
    const engine = new GameEngine(seed);
    let moveCount = 0;
    const maxMoves = 10000;

    while (!engine.getState().gameOver && moveCount < maxMoves) {
      const move = strategy.selectMove(engine);
      if (!move) break;
      engine.move(move);
      moveCount++;
    }

    const state = engine.getState();
    const gameEndTime = Date.now();

    // Create result record
    const result: GameResult = {
      id: `${job.jobId}_${i}`,
      seed,
      strategyId: job.strategyId,
      batchId: job.batchId,
      moves: state.moves.join(''),
      finalScore: state.score,
      maxTile: state.maxTile,
      moveCount: state.moves.length,
      result: state.won ? 'win' : 'loss',
      timestamp: gameStartTime,
      durationMs: gameEndTime - gameStartTime,
    };

    results.push(result);

    // Send progress update every 10 games or on completion
    if ((i + 1) % 10 === 0 || i === job.seeds.length - 1) {
      const progress: SimulationProgress = {
        jobId: job.jobId,
        completed: i + 1,
        total: job.seeds.length,
        results: results.slice(), // Send copy of all results so far
      };
      self.postMessage(progress);
    }
  }

  console.log(`Simulation completed in ${Date.now() - startTime}ms`);
}

export default {} as typeof Worker & { new (): Worker };
