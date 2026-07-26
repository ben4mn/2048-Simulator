import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../storage/db';
import { useGameStore } from '../gameStore';

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

  constructor(url: URL | string) {
    this.url = url.toString();
    FakeWorker.instances.push(this);
  }

  postMessage(): void {
    // no-op: tests trigger progress manually via onmessage
  }

  terminate(): void {
    this.terminated = true;
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('gameStore batch worker lifecycle', () => {
  beforeEach(async () => {
    (globalThis as any).indexedDB = new IDBFactory();
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

  afterEach(() => {
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
        jobId: 'job_1',
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
    (globalThis as any).indexedDB = new IDBFactory();
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

  afterEach(() => {
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
        jobId: 'job_1',
        completed: 2,
        total: 4,
        results: [makeResult('g1', batchId), makeResult('g2', batchId)],
      },
    } as MessageEvent);
    await flush();

    expect(useGameStore.getState().batchProgress).toBe(2);

    worker.onmessage?.({
      data: {
        jobId: 'job_1',
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
    (globalThis as any).indexedDB = new IDBFactory();
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

  afterEach(() => {
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
        jobId: 'job_1',
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
        jobId: 'job_2',
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
