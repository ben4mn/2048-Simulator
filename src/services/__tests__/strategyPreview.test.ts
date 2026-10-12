import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_WEIGHTS } from '../../engine/customRules';
import { PREVIEW_SEEDS, startStrategyPreview, type StrategyPreviewMessage } from '../strategyPreview';

class PreviewWorker {
  static instance: PreviewWorker;
  onmessage: ((event: MessageEvent<StrategyPreviewMessage>) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { PreviewWorker.instance = this; }
  emit(message: StrategyPreviewMessage) { this.onmessage?.({ data: message } as MessageEvent<StrategyPreviewMessage>); }
}

beforeEach(() => { vi.stubGlobal('Worker', PreviewWorker); vi.useFakeTimers(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('background strategy preview lifecycle', () => {
  it('sends exact authored depth to a worker and cleans up on completion', async () => {
    const rules = [{ type: 'evaluation' as const, depth: 5, weights: DEFAULT_WEIGHTS }];
    const job = startStrategyPreview(rules, vi.fn());
    expect(PreviewWorker.instance.postMessage).toHaveBeenCalledWith({ rules, seeds: PREVIEW_SEEDS });
    PreviewWorker.instance.emit({ type: 'complete', games: [] });
    await expect(job.promise).resolves.toEqual([]);
    expect(PreviewWorker.instance.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancellation terminates deep searches immediately and rejects with AbortError', async () => {
    const job = startStrategyPreview([{ type: 'pattern', sequence: ['left'] }], vi.fn());
    const rejected = expect(job.promise).rejects.toMatchObject({ name: 'AbortError' });
    job.cancel();
    job.cancel();
    await rejected;
    expect(PreviewWorker.instance.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out stalled workers without leaving work running', async () => {
    const job = startStrategyPreview([{ type: 'pattern', sequence: ['left'] }], vi.fn());
    const rejected = expect(job.promise).rejects.toThrow(/60 seconds/);
    await vi.advanceTimersByTimeAsync(60_000);
    await rejected;
    expect(PreviewWorker.instance.terminate).toHaveBeenCalledTimes(1);
  });

  it('surfaces errors from an invalid configuration and releases the worker', async () => {
    const job = startStrategyPreview([{ type: 'pattern', sequence: [] }], vi.fn());
    PreviewWorker.instance.emit({ type: 'error', error: 'Pattern sequence cannot be empty' });
    await expect(job.promise).rejects.toThrow(/cannot be empty/);
    expect(PreviewWorker.instance.terminate).toHaveBeenCalledTimes(1);
  });
});
