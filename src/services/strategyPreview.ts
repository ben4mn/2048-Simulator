import type { CustomRule } from '../engine/customRules';
import type { GameRunOutcome } from '../engine/gameRunner';

export const PREVIEW_SEEDS = ['TESTDRV1', 'TESTDRV2', 'TESTDRV3'];

export interface StrategyPreviewGame {
  seed: string;
  strategy: GameRunOutcome;
  baseline: GameRunOutcome;
}

export type StrategyPreviewMessage =
  | { type: 'progress'; completed: number; total: number; game: StrategyPreviewGame }
  | { type: 'complete'; games: StrategyPreviewGame[] }
  | { type: 'error'; error: string };

/** Full-depth games belong in a worker: even cancelling depth 5 stays immediate. */
export function startStrategyPreview(
  rules: CustomRule[],
  onProgress: (completed: number, total: number) => void,
): { promise: Promise<StrategyPreviewGame[]>; cancel: () => void } {
  let worker: Worker | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let finished = false;
  let rejectPreview: (reason: Error) => void = () => {};

  const dispose = () => {
    finished = true;
    if (timeout) clearTimeout(timeout);
    worker?.terminate();
  };

  const promise = new Promise<StrategyPreviewGame[]>((resolve, reject) => {
    rejectPreview = reject;
    try {
      worker = new Worker(new URL('../workers/strategyPreviewWorker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (event: MessageEvent<StrategyPreviewMessage>) => {
        if (finished) return;
        const message = event.data;
        if (message.type === 'progress') {
          onProgress(message.completed, message.total);
        } else if (message.type === 'complete') {
          dispose();
          resolve(message.games);
        } else if (message.type === 'error') {
          dispose();
          reject(new Error(message.error));
        }
      };
      worker.onerror = () => {
        dispose();
        reject(new Error('Test drive could not run. Please try again.'));
      };
      timeout = setTimeout(() => {
        dispose();
        reject(new Error('Test drive exceeded 60 seconds. Try a lower look-ahead depth, then run it again.'));
      }, 60_000);
      worker.postMessage({ rules, seeds: PREVIEW_SEEDS });
    } catch (error) {
      dispose();
      reject(error instanceof Error ? error : new Error('Test drive is unavailable in this browser.'));
    }
  });

  return {
    promise,
    cancel: () => {
      if (finished) return;
      dispose();
      rejectPreview(new DOMException('Test drive cancelled', 'AbortError'));
    },
  };
}
