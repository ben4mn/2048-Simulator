// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import BatchConfigPanel from '../BatchConfigPanel';
import { useGameStore } from '../../store/gameStore';
import { DEFAULT_WEIGHTS } from '../../engine/customRules';
import type { Strategy } from '../../storage/db';

vi.mock('../CustomStrategyBuilder', () => ({
  CustomStrategyBuilder: ({
    onSave,
    initialName,
  }: {
    onSave: (rules: unknown[], name: string) => Promise<void>;
    initialName: string;
  }) => (
    <div>
      <span>Editing {initialName || 'new strategy'}</span>
      <button
        onClick={() =>
          void onSave(
            [{ type: 'evaluation', weights: DEFAULT_WEIGHTS, depth: 1 }],
            'My strategy',
          ).catch(() => {})
        }
      >
        Save test strategy
      </button>
    </div>
  ),
}));
const original = useGameStore.getState();
const saved: Strategy = {
  id: 'mine',
  name: 'My strategy',
  type: 'custom',
  params: {
    customRules: [{ type: 'evaluation', weights: DEFAULT_WEIGHTS, depth: 1 }],
  },
  stats: { gamesPlayed: 0, winRate: 0, avgScore: 0, avgMoves: 0, bestScore: 0 },
};
const saveStrategy = vi.fn();
const deleteStrategy = vi.fn();
beforeEach(() => {
  saveStrategy.mockReset().mockResolvedValue('mine');
  deleteStrategy.mockReset().mockResolvedValue(true);
  useGameStore.setState({
    savedStrategies: [],
    saveCustomStrategy: saveStrategy,
    deleteCustomStrategy: deleteStrategy,
    storageError: null,
  });
});
afterEach(() => {
  cleanup();
  useGameStore.setState(original);
});
function setup() {
  const onStartBatch = vi.fn();
  const onStartComparison = vi.fn();
  render(
    <BatchConfigPanel
      onStartBatch={onStartBatch}
      onStartComparison={onStartComparison}
      isRunning={false}
    />,
  );
  return { onStartBatch, onStartComparison };
}

describe('simulation configuration', () => {
  it('rejects empty or fractional batch sizes instead of silently coercing them', () => {
    const { onStartBatch } = setup();
    const count = screen.getByRole('spinbutton');
    for (const value of ['', '1.5', '10001']) {
      fireEvent.change(count, { target: { value } });
      const start = screen.getByRole('button', {
        name: /Start simulation/,
      }) as HTMLButtonElement;
      expect(start.disabled).toBe(true);
      fireEvent.click(start);
    }
    expect(onStartBatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '10' }));
    fireEvent.click(screen.getByRole('button', { name: /Start simulation/ }));
    expect(onStartBatch).toHaveBeenCalledWith(
      expect.objectContaining({ batchSize: 10, seedMode: 'random' }),
    );
  });
  it('requires a nonempty fixed seed and blocks an empty move sequence', () => {
    setup();
    fireEvent.click(screen.getByRole('radio', { name: 'Fixed seed' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Fixed seed' }), {
      target: { value: '   ' },
    });
    expect(
      (
        screen.getByRole('button', {
          name: /Start simulation/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'Fresh seeds' }));
    fireEvent.click(screen.getByRole('button', { name: /Repeat Sequence/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(
      (
        screen.getByRole('button', {
          name: /Start simulation/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
  it('saves a builder opened on side B to side B without changing side A', async () => {
    const { onStartComparison } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Head to head' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: /Build your own/ })[1],
    );
    useGameStore.setState({ savedStrategies: [saved] });
    fireEvent.click(screen.getByRole('button', { name: 'Save test strategy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /Run head-to-head/ }));
    expect(onStartComparison).toHaveBeenCalledWith(
      { strategyType: 'directional_priority' },
      expect.objectContaining({
        strategyType: 'custom',
        customStrategyName: 'My strategy',
      }),
      100,
    );
  });
  it('updates a saved strategy using its ID', async () => {
    useGameStore.setState({ savedStrategies: [saved] });
    setup();
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit strategy My strategy' }),
    );
    expect(screen.getByText('Editing My strategy')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save test strategy' }));
    await waitFor(() =>
      expect(saveStrategy).toHaveBeenCalledWith(
        'My strategy',
        expect.any(Array),
        'mine',
      ),
    );
  });
  it('keeps the draft dialog open when persistence fails', async () => {
    saveStrategy.mockResolvedValue(null);
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Build your own/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save test strategy' }));
    await waitFor(() => expect(saveStrategy).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
  it('retains selection when deleting a saved strategy fails', async () => {
    deleteStrategy.mockResolvedValue(false);
    useGameStore.setState({ savedStrategies: [saved] });
    setup();
    fireEvent.click(screen.getByRole('button', { name: /My strategy Saved/ }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete strategy My strategy' }),
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete strategy',
      }),
    );
    await waitFor(() => expect(deleteStrategy).toHaveBeenCalledWith('mine'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: /My strategy Selected/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });
});
