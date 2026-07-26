/**
 * ReplaySession: incremental replay used by GameReplay.tsx.
 * Seeking forward applies only the missing moves; seeking backward rebuilds
 * from the seed. States must always match a full rebuild-from-scratch.
 */
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../gameEngine';
import { ReplaySession } from '../replaySession';
import { playGameWithStrategy, DirectionalPriorityStrategy } from '../strategy';
import type { Direction, DirectionShort, GameState } from '../types';

const SHORT_TO_DIR: Record<DirectionShort, Direction> = {
  U: 'up',
  D: 'down',
  L: 'left',
  R: 'right',
};

/** Reference implementation: rebuild from seed and replay `index` moves. */
function rebuildState(seed: string, moves: DirectionShort[], index: number): Readonly<GameState> {
  const engine = new GameEngine(seed);
  for (let i = 0; i < index && i < moves.length; i++) {
    engine.move(SHORT_TO_DIR[moves[i]]);
  }
  return engine.getState();
}

/** A real recorded game so the move string is guaranteed valid. */
function recordGame(seed: string): DirectionShort[] {
  const result = playGameWithStrategy(seed, new DirectionalPriorityStrategy(), 300);
  return result.moves.split('') as DirectionShort[];
}

describe('ReplaySession', () => {
  it('sequential forward seeks (autoplay) apply each move exactly once', () => {
    const seed = 'REPLAY-1';
    const moves = recordGame(seed);
    expect(moves.length).toBeGreaterThan(20);

    const session = new ReplaySession(seed, moves);
    for (let i = 0; i <= moves.length; i++) {
      const state = session.seek(i);
      expect(state.moves.length).toBe(i);
    }
    // Each recorded move was applied exactly once across the whole autoplay.
    expect(session.engineMovesApplied).toBe(moves.length);

    // Final state matches a full rebuild.
    expect(session.seek(moves.length)).toEqual(rebuildState(seed, moves, moves.length));
  });

  it('forward jumps apply only the missing moves', () => {
    const seed = 'REPLAY-2';
    const moves = recordGame(seed);

    const session = new ReplaySession(seed, moves);
    const mid = Math.floor(moves.length / 2);
    expect(session.seek(mid)).toEqual(rebuildState(seed, moves, mid));
    expect(session.engineMovesApplied).toBe(mid);

    expect(session.seek(moves.length)).toEqual(rebuildState(seed, moves, moves.length));
    expect(session.engineMovesApplied).toBe(moves.length);
  });

  it('backward seeks rebuild and produce the exact same state as a fresh replay', () => {
    const seed = 'REPLAY-3';
    const moves = recordGame(seed);
    const session = new ReplaySession(seed, moves);

    session.seek(moves.length);
    const mid = Math.floor(moves.length / 3);
    expect(session.seek(mid)).toEqual(rebuildState(seed, moves, mid));
    expect(session.seek(0)).toEqual(rebuildState(seed, moves, 0));

    // Scrub back and forth arbitrarily; state always equals the reference.
    for (const idx of [5, 2, 9, 9, 0, moves.length, 1]) {
      expect(session.seek(idx)).toEqual(rebuildState(seed, moves, idx));
    }
  });

  it('clamps out-of-range indices', () => {
    const seed = 'REPLAY-4';
    const moves = recordGame(seed);
    const session = new ReplaySession(seed, moves);

    expect(session.seek(-5)).toEqual(rebuildState(seed, moves, 0));
    expect(session.seek(moves.length + 100)).toEqual(rebuildState(seed, moves, moves.length));
  });

  it('repeated seeks to the same index apply no extra moves', () => {
    const seed = 'REPLAY-5';
    const moves = recordGame(seed);
    const session = new ReplaySession(seed, moves);

    session.seek(10);
    const applied = session.engineMovesApplied;
    const a = session.seek(10);
    const b = session.seek(10);
    expect(session.engineMovesApplied).toBe(applied);
    expect(a).toEqual(b);
  });
});
