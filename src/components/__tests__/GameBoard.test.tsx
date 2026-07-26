// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import GameBoard from '../GameBoard';
import type { Board } from '../../engine/types';

afterEach(cleanup);

const emptyBoard: Board = Array.from({ length: 4 }, () => [0, 0, 0, 0]);

describe('GameBoard', () => {
  it('renders 16 gridcells', () => {
    render(<GameBoard board={emptyBoard} />);
    expect(screen.getAllByRole('gridcell')).toHaveLength(16);
  });

  it('labels empty cells as "empty" and filled cells with their value', () => {
    const board: Board = emptyBoard.map((row) => [...row]);
    board[0][0] = 2;
    board[1][2] = 256;

    render(<GameBoard board={board} />);

    const cells = screen.getAllByRole('gridcell');
    expect(cells[0]).toHaveAttribute('aria-label', '2');
    expect(cells[1]).toHaveAttribute('aria-label', 'empty');
    expect(screen.getByRole('gridcell', { name: '256' })).toBeInTheDocument();
  });

  it('describes the board via the grid container aria-label', () => {
    const board: Board = emptyBoard.map((row) => [...row]);
    board[3][3] = 128;

    render(<GameBoard board={board} />);

    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('aria-label', expect.stringContaining('highest tile 128'));
  });
});
