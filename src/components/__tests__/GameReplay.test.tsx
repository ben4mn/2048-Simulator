// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import GameReplay from '../GameReplay';

afterEach(cleanup);

describe('GameReplay', () => {
  it('renders as an accessible dialog with transport controls', () => {
    render(<GameReplay seed="TESTSEED" moves="" onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'Game Replay' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    expect(screen.getByRole('button', { name: 'Close replay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset to start' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step forward' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /move progress/i })).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<GameReplay seed="TESTSEED" moves="" onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<GameReplay seed="TESTSEED" moves="" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close replay' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
