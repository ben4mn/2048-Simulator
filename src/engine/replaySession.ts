/**
 * Incremental replay of a recorded game.
 *
 * GameReplay previously rebuilt the engine and replayed from move 0 on every
 * scrub/autoplay tick (O(n) per tick, O(n^2) per full playback). ReplaySession
 * keeps a live engine: seeking forward applies only the missing moves;
 * seeking backward rebuilds from the seed (cheap and always correct thanks to
 * deterministic seeded RNG).
 */
import { GameEngine } from './gameEngine';
import type { Direction, DirectionShort, GameState } from './types';

const SHORT_TO_DIR: Record<DirectionShort, Direction> = {
  U: 'up',
  D: 'down',
  L: 'left',
  R: 'right',
};

export class ReplaySession {
  private engine: GameEngine;
  private applied = 0;
  /** Total number of engine.move() calls made (exposed for tests/diagnostics). */
  engineMovesApplied = 0;

  constructor(
    private readonly seed: string,
    private readonly moves: readonly DirectionShort[]
  ) {
    this.engine = new GameEngine(seed);
  }

  /**
   * Position the replay after `index` moves and return the resulting state.
   * Out-of-range indices are clamped to [0, moves.length].
   */
  seek(index: number): Readonly<GameState> {
    const target = Math.max(0, Math.min(index, this.moves.length));

    // Backward: rebuild from the seed (deterministic), then roll forward.
    if (target < this.applied) {
      this.engine = new GameEngine(this.seed);
      this.applied = 0;
    }

    while (this.applied < target) {
      const direction = SHORT_TO_DIR[this.moves[this.applied]];
      if (direction) {
        this.engine.move(direction);
        this.engineMovesApplied++;
      }
      this.applied++;
    }

    return this.engine.getState();
  }
}
