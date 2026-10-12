// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../../App';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';

vi.mock('../views/BatchView', () => ({ default: () => null }));
vi.mock('../views/ResultsView', () => ({ default: () => null }));
vi.mock('../views/PlayView', () => ({
  default: () => (
    <>
      <input aria-label="Seed" />
      <div contentEditable aria-label="Editable text" />
    </>
  ),
}));
vi.mock('../BottomNav', () => ({ default: () => null }));
const originalGame = useGameStore.getState();
const originalAuth = useAuthStore.getState();
const move = vi.fn();
beforeEach(() => {
  move.mockReset();
  useGameStore.setState({
    viewMode: 'play',
    selectedGameId: null,
    initialize: async () => {},
    makeMove: move,
  });
  useAuthStore.setState({ refresh: async () => {} });
});
afterEach(() => {
  cleanup();
  useGameStore.setState(originalGame);
  useAuthStore.setState(originalAuth);
});

describe('game keyboard input', () => {
  it('lets users type seeds and edit text without moving the board or preventing typing', () => {
    render(<App />);
    expect(
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Seed' }), {
        key: 'a',
      }),
    ).toBe(true);
    expect(
      fireEvent.keyDown(screen.getByLabelText('Editable text'), {
        key: 'ArrowLeft',
      }),
    ).toBe(true);
    expect(move).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(move).toHaveBeenCalledWith('left');
  });
  it('keeps replay navigation and browser shortcuts from moving the game', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'ArrowLeft', metaKey: true });
    useGameStore.setState({ selectedGameId: 'replay' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(move).not.toHaveBeenCalled();
  });
  it('accepts uppercase WASD during gameplay', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'W' });
    expect(move).toHaveBeenCalledWith('up');
  });
});
