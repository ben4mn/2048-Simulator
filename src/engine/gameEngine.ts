/**
 * Core 2048 Game Engine
 * Implements standard 2048 rules with deterministic behavior
 */

import { SeededRNG } from './rng';
import { getMaxTileValue } from './boardUtils';
import type { Board, Direction, DirectionShort, GameState, MoveResult, Position } from './types';

export class GameEngine {
  private rng: SeededRNG;
  private state: GameState;
  private readonly seed: string;

  constructor(seed: string, snapshot?: { rngState: number; state: GameState }) {
    this.seed = seed;
    this.rng = new SeededRNG(seed);
    if (snapshot) {
      // Internal path used by clone(): adopt the snapshot instead of
      // consuming RNG values to spawn the two initial tiles.
      this.rng.setInternalState(snapshot.rngState);
      this.state = snapshot.state;
    } else {
      this.state = this.createInitialState();
    }
  }

  /**
   * Create an independent copy of this engine: identical board, score, move
   * history, flags, and (critically) the exact RNG stream position. The clone
   * and the original evolve independently; the same subsequent moves produce
   * identical spawns on both. O(1) alternative to replaying the full move
   * history on a fresh engine.
   */
  clone(): GameEngine {
    return new GameEngine(this.seed, {
      rngState: this.rng.getInternalState(),
      state: {
        ...this.state,
        board: this.copyBoard(this.state.board),
        moves: [...this.state.moves],
      },
    });
  }

  private createInitialState(): GameState {
    const board = this.createEmptyBoard();

    // Spawn two initial tiles
    this.spawnTile(board);
    this.spawnTile(board);

    return {
      board,
      score: 0,
      moves: [],
      gameOver: false,
      won: false,
      maxTile: getMaxTileValue(board),
    };
  }

  private createEmptyBoard(): Board {
    return Array(4).fill(null).map(() => Array(4).fill(0));
  }

  private copyBoard(board: Board): Board {
    return board.map(row => [...row]);
  }

  /**
   * Get all empty cell positions
   */
  private getEmptyCells(board: Board): Position[] {
    const empty: Position[] = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        if (board[row][col] === 0) {
          empty.push({ row, col });
        }
      }
    }
    return empty;
  }

  /**
   * Spawn a new tile (90% chance of 2, 10% chance of 4)
   */
  private spawnTile(board: Board): boolean {
    const emptyCells = this.getEmptyCells(board);
    if (emptyCells.length === 0) return false;

    const pos = this.rng.choice(emptyCells);
    const value = this.rng.nextBool(0.9) ? 2 : 4;
    board[pos.row][pos.col] = value;

    return true;
  }

  /**
   * Convert direction string to short form
   */
  private directionToShort(dir: Direction): DirectionShort {
    const map: Record<Direction, DirectionShort> = {
      up: 'U',
      down: 'D',
      left: 'L',
      right: 'R',
    };
    return map[dir];
  }

  /**
   * Slide and merge tiles in the given direction
   */
  private performMove(board: Board, direction: Direction): MoveResult {
    const newBoard = this.copyBoard(board);
    let totalMerged = 0;
    let moved = false;

    // Transform board based on direction for easier processing
    // Always process from left, then transform back
    const { transformed, toOriginal } = this.transformBoard(newBoard, direction);

    // Process each row (slide left and merge)
    for (let row = 0; row < 4; row++) {
      const { line, merged, changed } = this.slideAndMergeLine(transformed[row]);
      transformed[row] = line;
      totalMerged += merged;
      if (changed) moved = true;
    }

    // Transform back to original orientation
    const finalBoard = toOriginal(transformed);

    return {
      board: finalBoard,
      score: totalMerged,
      moved,
    };
  }

  /**
   * Transform board for easier processing (always slide left)
   */
  private transformBoard(
    board: Board,
    direction: Direction
  ): {
    transformed: Board;
    toOriginal: (b: Board) => Board;
  } {
    switch (direction) {
      case 'left':
        return {
          transformed: this.copyBoard(board),
          toOriginal: (b) => this.copyBoard(b),
        };

      case 'right':
        return {
          transformed: board.map(row => [...row].reverse()),
          toOriginal: (b) => b.map(row => [...row].reverse()),
        };

      case 'up':
        return {
          transformed: this.transpose(board),
          toOriginal: (b) => this.transpose(b),
        };

      case 'down':
        return {
          transformed: this.transpose(board).map(row => [...row].reverse()),
          toOriginal: (b) => this.transpose(b.map(row => [...row].reverse())),
        };
    }
  }

  /**
   * Transpose a board (swap rows and columns)
   */
  private transpose(board: Board): Board {
    const result: Board = this.createEmptyBoard();
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        result[col][row] = board[row][col];
      }
    }
    return result;
  }

  /**
   * Slide and merge a single line (left direction)
   */
  private slideAndMergeLine(line: number[]): {
    line: number[];
    merged: number;
    changed: boolean;
  } {
    // Remove zeros
    const tiles = line.filter(x => x !== 0);
    let merged = 0;
    let changed = false;

    // Merge adjacent equal tiles
    const newTiles: number[] = [];
    let i = 0;
    while (i < tiles.length) {
      if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
        const mergedValue = tiles[i] * 2;
        newTiles.push(mergedValue);
        merged += mergedValue;
        changed = true;
        i += 2;
      } else {
        newTiles.push(tiles[i]);
        i += 1;
      }
    }

    // Pad with zeros on the right
    while (newTiles.length < 4) {
      newTiles.push(0);
    }

    // Check if anything changed
    if (!changed) {
      for (let j = 0; j < 4; j++) {
        if (line[j] !== newTiles[j]) {
          changed = true;
          break;
        }
      }
    }

    return { line: newTiles, merged, changed };
  }

  /**
   * Check if any valid moves are available
   */
  private hasValidMoves(board: Board): boolean {
    // Check for empty cells
    if (this.getEmptyCells(board).length > 0) return true;

    // Check for possible merges (horizontally and vertically)
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const current = board[row][col];
        // Check right
        if (col < 3 && board[row][col + 1] === current) return true;
        // Check down
        if (row < 3 && board[row + 1][col] === current) return true;
      }
    }

    return false;
  }

  /**
   * Make a move in the given direction
   */
  move(direction: Direction): boolean {
    if (this.state.gameOver) return false;

    const moveResult = this.performMove(this.state.board, direction);

    if (!moveResult.moved) {
      return false; // Invalid move - nothing changed
    }

    // Update state
    this.state.board = moveResult.board;
    this.state.score += moveResult.score;
    this.state.moves.push(this.directionToShort(direction));

    // Spawn new tile
    this.spawnTile(this.state.board);

    // Update max tile
    this.state.maxTile = getMaxTileValue(this.state.board);

    // Check win condition
    if (!this.state.won && this.state.maxTile >= 2048) {
      this.state.won = true;
    }

    // Check game over
    if (!this.hasValidMoves(this.state.board)) {
      this.state.gameOver = true;
    }

    return true;
  }

  /**
   * Get current game state (read-only)
   */
  getState(): Readonly<GameState> {
    return {
      ...this.state,
      board: this.copyBoard(this.state.board),
      moves: [...this.state.moves],
    };
  }

  /**
   * Cheap accessor: is the game over? Avoids the deep copy getState() makes.
   */
  isGameOver(): boolean {
    return this.state.gameOver;
  }

  /**
   * Cheap accessor: current score.
   */
  getScore(): number {
    return this.state.score;
  }

  /**
   * Cheap accessor: highest tile value currently on the board.
   */
  getMaxTileValue(): number {
    return this.state.maxTile;
  }

  /**
   * Read-only view of the LIVE board — no copy is made. Callers must not
   * mutate it and must not hold onto it across moves (the reference is
   * replaced on every successful move). Use getState() when a stable
   * snapshot is needed (UI, replay, persistence).
   */
  getBoardView(): readonly (readonly number[])[] {
    return this.state.board;
  }

  /**
   * Check if a move is valid (doesn't modify state)
   */
  isValidMove(direction: Direction): boolean {
    const result = this.performMove(this.state.board, direction);
    return result.moved;
  }

  /**
   * Get all valid moves from current position
   */
  getValidMoves(): Direction[] {
    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    return directions.filter(dir => this.isValidMove(dir));
  }

  /**
   * Get the seed used for this game
   */
  getSeed(): string {
    return this.seed;
  }

  /**
   * Reset game to initial state
   */
  reset(): void {
    this.rng.reset();
    this.state = this.createInitialState();
  }
}
