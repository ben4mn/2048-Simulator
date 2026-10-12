import type { CustomRule } from '../engine/customRules';
import { CustomStrategyFactory } from '../engine/customStrategyFactory';
import { runGame } from '../engine/gameRunner';
import { RandomStrategy } from '../engine/strategy';
import type { StrategyPreviewGame, StrategyPreviewMessage } from '../services/strategyPreview';

const post = (message: StrategyPreviewMessage) => self.postMessage(message);

self.onmessage = (event: MessageEvent<{ rules: CustomRule[]; seeds: string[] }>) => {
  const { rules, seeds } = event.data;
  try {
    const games: StrategyPreviewGame[] = [];
    for (const seed of seeds) {
      const game: StrategyPreviewGame = {
        seed,
        strategy: runGame(seed, CustomStrategyFactory.createFromRules(rules)),
        baseline: runGame(seed, new RandomStrategy()),
      };
      games.push(game);
      post({ type: 'progress', completed: games.length, total: seeds.length, game });
    }
    post({ type: 'complete', games });
  } catch (error) {
    post({ type: 'error', error: error instanceof Error ? error.message : 'Test drive failed.' });
  }
};
