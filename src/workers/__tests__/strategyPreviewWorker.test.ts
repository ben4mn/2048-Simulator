import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../../engine/gameEngine';
import type { CustomRule } from '../../engine/customRules';
import type { DirectionShort } from '../../engine/types';
import type { StrategyPreviewMessage } from '../../services/strategyPreview';

type PreviewJob = { rules: CustomRule[]; seeds: string[] };
let messages: StrategyPreviewMessage[];
let workerScope: { onmessage: ((event: MessageEvent<PreviewJob>) => void) | null; postMessage: (message: StrategyPreviewMessage) => void };

beforeEach(async () => {
  messages = [];
  workerScope = { onmessage: null, postMessage: (message) => messages.push(structuredClone(message)) };
  vi.stubGlobal('self', workerScope);
  vi.resetModules();
  await import('../strategyPreviewWorker');
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('strategy test drive worker', () => {
  it('returns deterministic, replayable games and progress for both strategies', () => {
    workerScope.onmessage!({ data: { rules: [{ type: 'pattern', sequence: ['left', 'down', 'right', 'up'] }], seeds: ['FIXED', 'OTHER', 'FIXED'] } } as MessageEvent<PreviewJob>);
    expect(messages.map((message) => message.type)).toEqual(['progress', 'progress', 'progress', 'complete']);
    const result = messages[3];
    if (result.type !== 'complete') throw new Error('Missing result');
    expect(result.games).toHaveLength(3);
    expect(result.games[2]).toEqual(result.games[0]);
    for (const game of result.games) {
      for (const outcome of [game.strategy, game.baseline]) {
        const engine = new GameEngine(game.seed);
        const directions = { L: 'left', D: 'down', R: 'right', U: 'up' } as const;
        for (const move of outcome.moves) expect(engine.move(directions[move as DirectionShort])).toBe(true);
        expect(engine.getState().score).toBe(outcome.score);
        expect(engine.getState().maxTile).toBe(outcome.maxTile);
        expect(outcome.moveCount).toBe(outcome.moves.length);
      }
    }
  });

  it('reports invalid strategy errors instead of leaving the preview pending', () => {
    workerScope.onmessage!({ data: { rules: [{ type: 'pattern', sequence: [] }], seeds: ['FIXED'] } } as unknown as MessageEvent<PreviewJob>);
    expect(messages).toEqual([{ type: 'error', error: expect.stringMatching(/empty/i) }]);
  });
});
