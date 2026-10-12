import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../storage/db';
import { useGameStore } from '../gameStore';
import type { SimulationJob } from '../../workers/simulationWorker';

/**
 * Minimal fake Worker implementation so gameStore's worker-lifecycle logic
 * can be exercised without a real Worker/browser environment.
 */
class FakeWorker {
  static instances: FakeWorker[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  readonly url: string;
  job: SimulationJob | null = null;

  constructor(url: URL | string) {
    this.url = url.toString();
    FakeWorker.instances.push(this);
  }

  postMessage(job: SimulationJob): void {
    this.job = job;
  }

  terminate(): void {
    this.terminated = true;
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('gameStore batch worker lifecycle', () => {
  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    await db.init();

    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);

    useGameStore.setState({
      worker: null,
      isRunningBatch: false,
      batchProgress: 0,
      batchTotal: 0,
      currentBatchId: null,
      storageError: null,
    });
  });

  afterEach(async () => {
    useGameStore.getState().stopBatchSimulation();
    await flush();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('terminates any existing worker before starting a new batch simulation', () => {
    useGameStore.getState().startBatchSimulation({
      strategyType: 'random',
      batchSize: 1,
      seedMode: 'random',
    });

    expect(FakeWorker.instances).toHaveLength(1);
    const firstWorker = FakeWorker.instances[0];
    expect(firstWorker.terminated).toBe(false);

    useGameStore.getState().startBatchSimulation({
      strategyType: 'random',
      batchSize: 1,
      seedMode: 'random',
    });

    expect(FakeWorker.instances).toHaveLength(2);
    expect(firstWorker.terminated).toBe(true);
    expect(useGameStore.getState().worker).toBe(FakeWorker.instances[1]);
  });

  it('stopBatchSimulation terminates the worker, clears state, and marks the batch failed in IndexedDB', async () => {
    useGameStore.getState().startBatchSimulation({
      strategyType: 'random',
      batchSize: 1,
      seedMode: 'random',
    });

    const batchId = useGameStore.getState().currentBatchId;
    expect(batchId).not.toBeNull();

    // Let the initial `db.saveBatch(runningBatch)` promise resolve before stopping.
    await flush();

    const worker = useGameStore.getState().worker as unknown as FakeWorker;
    expect(worker).toBeTruthy();

    useGameStore.getState().stopBatchSimulation();

    expect(worker.terminated).toBe(true);
    expect(useGameStore.getState().worker).toBeNull();
    expect(useGameStore.getState().isRunningBatch).toBe(false);
    expect(useGameStore.getState().currentBatchId).toBeNull();

    await flush();

    const savedBatch = await db.getBatch(batchId as string);
    expect(savedBatch?.status).toBe('failed');
  });

  it('sets storageError when saving the batch to IndexedDB fails, without throwing', async () => {
    vi.spyOn(db, 'saveBatch').mockRejectedValueOnce(new Error('disk full'));

    useGameStore.getState().startBatchSimulation({
      strategyType: 'random',
      batchSize: 1,
      seedMode: 'random',
    });

    await flush();

    expect(useGameStore.getState().storageError).toMatch(/disk full/);
  });

  it('clearStorageError resets the storageError field', () => {
    useGameStore.setState({ storageError: 'some previous failure' });
    useGameStore.getState().clearStorageError();
    expect(useGameStore.getState().storageError).toBeNull();
  });

  it('does not mark a batch complete in UI state when post-completion persistence fails', async () => {
    useGameStore.getState().startBatchSimulation({
      strategyType: 'random',
      batchSize: 1,
      seedMode: 'random',
    });
    await flush();

    const worker = useGameStore.getState().worker as unknown as FakeWorker;

    vi.spyOn(db, 'saveGames').mockRejectedValue(new Error('write failed'));

    worker.onmessage?.({
      data: {
        jobId: worker.job!.jobId,
        completed: 1,
        total: 1,
        results: [
          {
            id: 'g1',
            batchId: useGameStore.getState().currentBatchId,
            strategyId: 'strategy-1',
            seed: 'SEED0001',
            moves: 'L',
            finalScore: 10,
            maxTile: 4,
            moveCount: 1,
            result: 'loss',
            timestamp: Date.now(),
            durationMs: 10,
          },
        ],
      },
    } as MessageEvent);

    await flush();
    await flush();

    expect(useGameStore.getState().isRunningBatch).toBe(false);
    expect(useGameStore.getState().viewMode).not.toBe('results');
    expect(useGameStore.getState().storageError).toMatch(/write failed|Failed to save/);
  });
});

describe('gameStore delta progress messages', () => {
  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    await db.init();

    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);

    useGameStore.setState({
      worker: null,
      isRunningBatch: false,
      batchProgress: 0,
      batchTotal: 0,
      currentBatchId: null,
      batchResults: [],
      storageError: null,
    });
  });

  afterEach(async () => {
    useGameStore.getState().stopBatchSimulation();
    await flush();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const makeResult = (id: string, batchId: string | null) => ({
    id,
    batchId,
    strategyId: 'strategy-1',
    seed: `SEED-${id}`,
    moves: 'L',
    finalScore: 10,
    maxTile: 4,
    moveCount: 1,
    result: 'loss' as const,
    timestamp: Date.now(),
    durationMs: 10,
  });

  it('accumulates per-message deltas and saves each game exactly once', async () => {
    const saveGamesSpy = vi.spyOn(db, 'saveGames');

    useGameStore.getState().startBatchSimulation({
      strategyType: 'random',
      batchSize: 4,
      seedMode: 'random',
    });
    await flush();

    const worker = useGameStore.getState().worker as unknown as FakeWorker;
    const batchId = useGameStore.getState().currentBatchId;

    // Worker now posts only the results since the previous progress message.
    worker.onmessage?.({
      data: {
        jobId: worker.job!.jobId,
        completed: 2,
        total: 4,
        results: [makeResult('g1', batchId), makeResult('g2', batchId)],
      },
    } as MessageEvent);
    await flush();

    expect(useGameStore.getState().batchProgress).toBe(2);
    expect(useGameStore.getState().isRunningBatch).toBe(true);
    expect(useGameStore.getState().batchResults.map((result) => result.id)).toEqual(['g1', 'g2']);

    worker.onmessage?.({
      data: {
        jobId: worker.job!.jobId,
        completed: 4,
        total: 4,
        results: [makeResult('g3', batchId), makeResult('g4', batchId)],
      },
    } as MessageEvent);

    // The completion path awaits several sequential IndexedDB operations;
    // wait until the store reflects completion instead of counting flushes.
    await vi.waitFor(() => {
      expect(useGameStore.getState().isRunningBatch).toBe(false);
      expect(useGameStore.getState().viewMode).toBe('results');
    });

    // Every game id saved exactly once across all saveGames calls.
    const savedIds = saveGamesSpy.mock.calls.flatMap(
      (call) => (call[0] as Array<{ id: string }>).map((g) => g.id)
    );
    expect([...savedIds].sort()).toEqual(['g1', 'g2', 'g3', 'g4']);

    // The store accumulated the deltas into the full result set.
    const state = useGameStore.getState();
    expect(state.batchResults.map((r) => r.id).sort()).toEqual(['g1', 'g2', 'g3', 'g4']);

    // And IndexedDB holds all four games for the batch.
    const persisted = await db.getGamesByBatch(batchId as string);
    expect(persisted.map((g) => g.id).sort()).toEqual(['g1', 'g2', 'g3', 'g4']);
  });
});

describe('gameStore compare-mode orchestration', () => {
  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    await db.init();

    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);

    useGameStore.setState({
      worker: null,
      isRunningBatch: false,
      isRunningComparison: false,
      comparisonId: null,
      compareBatchIdA: null,
      compareBatchIdB: null,
      selectedComparisonId: null,
      comparisonBatchA: null,
      comparisonBatchB: null,
      comparisonResultsA: [],
      comparisonResultsB: [],
      batchProgress: 0,
      batchTotal: 0,
      currentBatchId: null,
      storageError: null,
    });
  });

  afterEach(async () => {
    useGameStore.getState().stopBatchSimulation();
    await flush();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const makeResult = (id: string, batchId: string, seed: string, finalScore: number) => ({
    id,
    batchId,
    strategyId: 'strategy-1',
    seed,
    moves: 'L',
    finalScore,
    maxTile: 4,
    moveCount: 1,
    result: 'loss' as const,
    timestamp: Date.now(),
    durationMs: 10,
  });

  it('runs strategy A then strategy B sequentially on identical seeds, reusing a single worker at a time', async () => {
    useGameStore.getState().startComparisonSimulation(
      { strategyType: 'directional_priority' },
      { strategyType: 'merge_max' },
      { batchSize: 2 }
    );

    expect(useGameStore.getState().isRunningComparison).toBe(true);
    const comparisonId = useGameStore.getState().comparisonId;
    expect(comparisonId).toMatch(/^cmp_/);

    await flush();
    expect(FakeWorker.instances).toHaveLength(1);
    const workerA = FakeWorker.instances[0];
    const batchIdA = useGameStore.getState().currentBatchId as string;

    // Same seeds are threaded to both sides; grab them off the saved batch.
    const savedBatchA = await db.getBatch(batchIdA);
    expect(savedBatchA?.seedMode).toBe('shared');
    expect(savedBatchA?.comparisonId).toBe(comparisonId);
    const seeds = savedBatchA!.seeds;
    expect(seeds).toHaveLength(2);

    workerA.onmessage?.({
      data: {
        jobId: workerA.job!.jobId,
        completed: 2,
        total: 2,
        results: [
          makeResult('a1', batchIdA, seeds[0], 500),
          makeResult('a2', batchIdA, seeds[1], 100),
        ],
      },
    } as MessageEvent);

    // Batch A completes and batch B starts — only one worker alive at a time.
    await vi.waitFor(() => {
      expect(FakeWorker.instances).toHaveLength(2);
    });
    expect(workerA.terminated).toBe(true);
    expect(useGameStore.getState().compareBatchIdA).toBe(batchIdA);

    const workerB = FakeWorker.instances[1];
    const batchIdB = useGameStore.getState().currentBatchId as string;
    expect(batchIdB).not.toBe(batchIdA);

    const savedBatchB = await db.getBatch(batchIdB);
    expect(savedBatchB?.comparisonId).toBe(comparisonId);
    expect(savedBatchB?.seeds).toEqual(seeds);

    workerB.onmessage?.({
      data: {
        jobId: workerB.job!.jobId,
        completed: 2,
        total: 2,
        results: [
          makeResult('b1', batchIdB, seeds[0], 200),
          makeResult('b2', batchIdB, seeds[1], 400),
        ],
      },
    } as MessageEvent);

    await vi.waitFor(() => {
      expect(useGameStore.getState().isRunningComparison).toBe(false);
      expect(useGameStore.getState().selectedComparisonId).toBe(comparisonId);
      expect(useGameStore.getState().comparisonResultsB).toHaveLength(2);
    });

    expect(useGameStore.getState().compareBatchIdB).toBe(batchIdB);
    expect(useGameStore.getState().comparisonResultsA.map((r) => r.id).sort()).toEqual(['a1', 'a2']);
    expect(useGameStore.getState().comparisonResultsB.map((r) => r.id).sort()).toEqual(['b1', 'b2']);
  });

  it('does not start batch B when batch A fails', async () => {
    useGameStore.getState().startComparisonSimulation(
      { strategyType: 'directional_priority' },
      { strategyType: 'merge_max' },
      { batchSize: 1 }
    );

    await flush();
    const workerA = FakeWorker.instances[0];
    workerA.onerror?.({ message: 'boom' } as ErrorEvent);

    await vi.waitFor(() => {
      expect(useGameStore.getState().isRunningComparison).toBe(false);
    });

    expect(FakeWorker.instances).toHaveLength(1);
    expect(useGameStore.getState().selectedComparisonId).toBeNull();
  });

  it('selectComparisonPair(null) clears the selected comparison state', async () => {
    useGameStore.setState({
      selectedComparisonId: 'cmp_x',
      comparisonResultsA: [makeResult('a', 'b', 'S', 1)],
      comparisonResultsB: [makeResult('b', 'b', 'S', 1)],
    });

    await useGameStore.getState().selectComparisonPair(null);

    expect(useGameStore.getState().selectedComparisonId).toBeNull();
    expect(useGameStore.getState().comparisonResultsA).toEqual([]);
    expect(useGameStore.getState().comparisonResultsB).toEqual([]);
  });
});


const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const postProgress = (worker: FakeWorker, completed: number, from = 0) => {
  const job = worker.job!;
  worker.onmessage?.({ data: {
    jobId: job.jobId,
    completed,
    total: job.seeds.length,
    results: job.seeds.slice(from, completed).map((seed, index) => ({
      id: `${job.jobId}_${from + index}`,
      batchId: job.batchId,
      strategyId: job.strategyId,
      seed,
      moves: 'L',
      finalScore: 4,
      maxTile: 4,
      moveCount: 1,
      result: 'loss',
      timestamp: Date.now(),
      durationMs: 1,
    })),
  } } as MessageEvent);
};

describe('simulation cancellation and persistence races', () => {
  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    await db.init();
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);
    useGameStore.setState({
      worker: null,
      isRunningBatch: false,
      isRunningComparison: false,
      viewMode: 'batch',
      selectedBatchId: null,
      batchResults: [],
      storageError: null,
    });
  });

  afterEach(async () => {
    useGameStore.getState().stopBatchSimulation();
    await flush();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('cancels comparison A without leaving comparison controls running or starting B', async () => {
    useGameStore.getState().startComparisonSimulation(
      { strategyType: 'random' }, { strategyType: 'merge_max' }, { batchSize: 1 }
    );
    const worker = FakeWorker.instances[0];
    const queuedHandler = worker.onmessage;
    useGameStore.getState().stopBatchSimulation();
    expect(useGameStore.getState().isRunningComparison).toBe(false);
    expect(useGameStore.getState().isRunningBatch).toBe(false);
    expect(worker.terminated).toBe(true);
    // A progress event already queued before terminate() must also be ignored.
    queuedHandler?.({ data: { jobId: worker.job!.jobId, completed: 1, total: 1, results: [] } } as MessageEvent);
    await flush();
    expect(FakeWorker.instances).toHaveLength(1);
    expect((await db.getBatch(worker.job!.batchId))?.status).toBe('failed');
  });

  it('cancels while final results persist, and never lets that job complete or start comparison B', async () => {
    const pendingSave = deferred<void>();
    const saveGames = vi.spyOn(db, 'saveGames').mockReturnValueOnce(pendingSave.promise);
    useGameStore.getState().startComparisonSimulation(
      { strategyType: 'random' }, { strategyType: 'merge_max' }, { batchSize: 1 }
    );
    const worker = FakeWorker.instances[0];
    postProgress(worker, 1);
    await vi.waitFor(() => expect(saveGames).toHaveBeenCalled());
    // The worker is already gone, but the pending batch is still cancellable.
    expect(useGameStore.getState().worker).toBeNull();
    useGameStore.getState().stopBatchSimulation();
    pendingSave.resolve();
    await vi.waitFor(async () => expect((await db.getBatch(worker.job!.batchId))?.status).toBe('failed'));
    expect(FakeWorker.instances).toHaveLength(1);
    expect(useGameStore.getState().viewMode).toBe('batch');
    expect(useGameStore.getState().isRunningComparison).toBe(false);
  });

  it('waits for earlier result writes before completing, and fails if an earlier delta rejects late', async () => {
    const pendingSave = deferred<void>();
    const saveGames = vi.spyOn(db, 'saveGames').mockReturnValueOnce(pendingSave.promise);
    useGameStore.getState().startBatchSimulation({ strategyType: 'random', batchSize: 2, seedMode: 'random' });
    const worker = FakeWorker.instances[0];
    postProgress(worker, 1);
    await vi.waitFor(() => expect(saveGames).toHaveBeenCalledTimes(1));
    postProgress(worker, 2, 1);
    await flush();
    expect(saveGames).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().isRunningBatch).toBe(true);
    pendingSave.reject(new Error('late disk failure'));
    await vi.waitFor(() => expect(useGameStore.getState().isRunningBatch).toBe(false));
    expect(useGameStore.getState().storageError).toMatch(/late disk failure/);
    expect(useGameStore.getState().viewMode).toBe('batch');
    await vi.waitFor(async () => expect((await db.getBatch(worker.job!.batchId))?.status).toBe('failed'));
  });

  it('replaces a comparison during persistence without allowing the old run to overwrite the new one', async () => {
    const pendingSave = deferred<void>();
    const saveGames = vi.spyOn(db, 'saveGames').mockReturnValueOnce(pendingSave.promise);
    useGameStore.getState().startComparisonSimulation(
      { strategyType: 'random' }, { strategyType: 'merge_max' }, { batchSize: 1 }
    );
    postProgress(FakeWorker.instances[0], 1);
    await vi.waitFor(() => expect(saveGames).toHaveBeenCalled());
    useGameStore.getState().startBatchSimulation({ strategyType: 'pattern', batchSize: 1, seedMode: 'fixed', fixedSeed: 'NEW-RUN' });
    const newBatchId = useGameStore.getState().currentBatchId;
    pendingSave.resolve();
    await flush();
    await flush();
    expect(FakeWorker.instances).toHaveLength(2);
    expect(useGameStore.getState().currentBatchId).toBe(newBatchId);
    expect(useGameStore.getState().isRunningComparison).toBe(false);
    expect(useGameStore.getState().isRunningBatch).toBe(true);
  });

  it('generates different job, strategy and batch IDs for runs started in the same millisecond', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    useGameStore.getState().startBatchSimulation({ strategyType: 'random', batchSize: 1, seedMode: 'random' });
    const first = FakeWorker.instances[0].job!;
    useGameStore.getState().startBatchSimulation({ strategyType: 'random', batchSize: 1, seedMode: 'random' });
    const second = FakeWorker.instances[1].job!;
    expect(second.batchId).not.toBe(first.batchId);
    expect(second.jobId).not.toBe(first.jobId);
    expect(second.strategyId).not.toBe(first.strategyId);
  });

  it('handles worker construction and message cloning failures without leaving running controls', async () => {
    vi.stubGlobal('Worker', class { constructor() { throw new Error('workers blocked'); } });
    useGameStore.getState().startComparisonSimulation(
      { strategyType: 'random' }, { strategyType: 'merge_max' }, { batchSize: 1 }
    );
    await flush();
    expect(useGameStore.getState().isRunningComparison).toBe(false);
    expect(useGameStore.getState().storageError).toMatch(/workers blocked/);
    vi.stubGlobal('Worker', FakeWorker);
    vi.spyOn(FakeWorker.prototype, 'postMessage').mockImplementation(() => { throw new Error('cannot clone config'); });
    useGameStore.getState().startBatchSimulation({ strategyType: 'random', batchSize: 1, seedMode: 'random' });
    expect(useGameStore.getState().isRunningBatch).toBe(false);
    expect(useGameStore.getState().worker).toBeNull();
    expect(FakeWorker.instances[0].terminated).toBe(true);
    expect(useGameStore.getState().storageError).toMatch(/cannot clone config/);
  });

  it.each([0, -1, 1.5, NaN, Infinity, 10001])('rejects invalid batch size %s before starting a worker', (batchSize) => {
    useGameStore.getState().startBatchSimulation({ strategyType: 'random', batchSize, seedMode: 'random' });
    expect(FakeWorker.instances).toHaveLength(0);
    expect(useGameStore.getState().isRunningBatch).toBe(false);
    expect(useGameStore.getState().storageError).toMatch(/whole number/);
  });

  it('requires a fixed seed rather than silently switching to random seeds', () => {
    useGameStore.getState().startBatchSimulation({ strategyType: 'random', batchSize: 1, seedMode: 'fixed', fixedSeed: '  ' });
    expect(FakeWorker.instances).toHaveLength(0);
    expect(useGameStore.getState().storageError).toMatch(/Enter a seed/);
  });
});

describe('saved strategy edits and history selection', () => {
  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    await db.init();
    useGameStore.setState({ storageError: null, selectedBatchId: null, batchResults: [] });
  });

  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('updates a saved strategy in place and preserves its stats', async () => {
    await db.saveStrategy({
      id: 'custom_original', name: 'Original', type: 'custom',
      params: { customRules: [{ type: 'pattern', sequence: ['left'] }] },
      stats: { gamesPlayed: 10, winRate: 0.2, avgScore: 100, avgMoves: 50, bestScore: 500 },
    });
    const savedId = await useGameStore.getState().saveCustomStrategy(' Revised ', [{ type: 'pattern', sequence: ['down'] }], 'custom_original');
    expect(savedId).toBe('custom_original');
    const strategies = await db.getAllStrategies();
    expect(strategies).toHaveLength(1);
    expect(strategies[0].name).toBe('Revised');
    expect(strategies[0].stats.gamesPlayed).toBe(10);
    expect(strategies[0].params.customRules).toEqual([{ type: 'pattern', sequence: ['down'] }]);
  });

  it('returns null on save failure and surfaces the error', async () => {
    vi.spyOn(db, 'saveStrategy').mockRejectedValueOnce(new Error('disk unavailable'));
    expect(await useGameStore.getState().saveCustomStrategy('Draft', [{ type: 'pattern', sequence: ['left'] }])).toBeNull();
    expect(useGameStore.getState().storageError).toMatch(/disk unavailable/);
  });

  it('returns false on delete failure and preserves the saved strategy', async () => {
    const id = await useGameStore.getState().saveCustomStrategy('Keep me', [{ type: 'pattern', sequence: ['left'] }]);
    vi.spyOn(db, 'deleteStrategy').mockRejectedValueOnce(new Error('delete blocked'));
    expect(await useGameStore.getState().deleteCustomStrategy(id!)).toBe(false);
    expect((await db.getStrategy(id!))?.name).toBe('Keep me');
    expect(useGameStore.getState().storageError).toMatch(/delete blocked/);
  });

  it('does not restore an older selection after a newer selection resolves', async () => {
    const oldRequest = deferred<[]>();
    vi.spyOn(db, 'getGamesByBatch').mockReturnValueOnce(oldRequest.promise).mockResolvedValueOnce([]);
    const selectingOld = useGameStore.getState().selectBatch('old-batch');
    await useGameStore.getState().selectBatch('new-batch');
    oldRequest.resolve([]);
    await selectingOld;
    expect(useGameStore.getState().selectedBatchId).toBe('new-batch');
  });

  it('captures database initialization failure without an unhandled rejection', async () => {
    vi.spyOn(db, 'init').mockRejectedValueOnce(new Error('storage disabled'));
    await useGameStore.getState().initialize();
    expect(useGameStore.getState().storageError).toMatch(/storage disabled/);
  });
});
