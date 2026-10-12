// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CustomStrategyBuilder } from '../CustomStrategyBuilder';
import { DEFAULT_WEIGHTS } from '../../engine/customRules';
import { startStrategyPreview, type StrategyPreviewGame } from '../../services/strategyPreview';
import { AIStrategyGenerator } from '../../services/aiStrategyGenerator';

vi.mock('../../services/strategyPreview', () => ({ startStrategyPreview: vi.fn() }));
const mockedPreview = vi.mocked(startStrategyPreview);
const games: StrategyPreviewGame[] = ['TESTDRV1', 'TESTDRV2', 'TESTDRV3'].map((seed) => ({
  seed,
  strategy: { score: 2000, maxTile: 256, moveCount: 120, moves: 'LD', won: false },
  baseline: { score: 800, maxTile: 64, moveCount: 60, moves: 'UL', won: false },
}));

beforeEach(() => { mockedPreview.mockReset(); mockedPreview.mockReturnValue({ promise: Promise.resolve(games), cancel: vi.fn() }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); });

describe('CustomStrategyBuilder', () => {
  it('starts with editable controls and saves an auto-generated name', () => {
    const onSave = vi.fn();
    render(<CustomStrategyBuilder onSave={onSave} onCancel={() => {}} />);
    expect(screen.getByLabelText('Empty Tiles')).toBeInTheDocument();
    expect(screen.getByText('What this strategy does')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Save Strategy'));
    const [rules, name] = onSave.mock.calls[0];
    expect(rules).toEqual([{ type: 'evaluation', depth: 1, weights: DEFAULT_WEIGHTS }]);
    expect(name).toBe('Corner Keeper');
  });

  it('migrates legacy weighted rules without changing their settings', () => {
    const onSave = vi.fn();
    render(<CustomStrategyBuilder onSave={onSave} onCancel={() => {}} initialRules={[{ type: 'weighted', weights: DEFAULT_WEIGHTS }]} initialName="Legacy" />);
    fireEvent.click(screen.getByText('Save Strategy'));
    expect(onSave).toHaveBeenCalledWith([{ type: 'evaluation', depth: 1, weights: DEFAULT_WEIGHTS }], 'Legacy');
  });

  it('preserves and edits a stored pattern instead of replacing it with evaluation defaults', () => {
    const onSave = vi.fn();
    render(<CustomStrategyBuilder onSave={onSave} onCancel={() => {}} initialRules={[{ type: 'pattern', sequence: ['left', 'down'] }]} />);
    expect(screen.getByRole('button', { name: 'Move sequence' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Move 2 direction'), { target: { value: 'up' } });
    fireEvent.click(screen.getByText('Save Strategy'));
    expect(onSave).toHaveBeenCalledWith([{ type: 'pattern', sequence: ['left', 'up'] }], 'Repeat L-U');
  });

  it('keeps an AI-generated move sequence intact when saving', async () => {
    sessionStorage.setItem('ai_openai_key', 'sk-session');
    vi.spyOn(AIStrategyGenerator, 'generateStrategy').mockResolvedValue({ success: true, strategyName: 'Left Down', rules: [{ type: 'pattern', sequence: ['left', 'down'] }] });
    const onSave = vi.fn();
    render(<CustomStrategyBuilder onSave={onSave} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Describe your idea with AI'));
    fireEvent.change(screen.getByLabelText('Strategy Description'), { target: { value: 'Repeat left and down' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Strategy' }));
    await waitFor(() => expect(screen.getByLabelText('Move 1 direction')).toHaveValue('left'));
    fireEvent.click(screen.getByText('Save Strategy'));
    expect(onSave).toHaveBeenCalledWith([{ type: 'pattern', sequence: ['left', 'down'] }], 'Left Down');
  });

  it('switches modes without losing the draft controls', () => {
    render(<CustomStrategyBuilder onSave={() => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Empty Tiles weight'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move sequence' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weighted decisions' }));
    expect(screen.getByLabelText('Empty Tiles weight')).toHaveValue(8);
  });

  it('lets the user start from a corner preset and tune threshold parameters', () => {
    const onSave = vi.fn();
    render(<CustomStrategyBuilder onSave={onSave} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Corner keeper/i }));
    fireEvent.change(screen.getByLabelText('Override 1 condition'), { target: { value: 'empty_cells_count' } });
    fireEvent.change(screen.getByLabelText('Override 1 threshold'), { target: { value: '6' } });
    fireEvent.click(screen.getByText('Save Strategy'));
    expect(onSave.mock.calls[0][0][0].overrides[0]).toEqual({ when: 'empty_cells_count', params: { threshold: 6 }, action: ['left', 'down'] });
  });

  it('blocks saving an empty pattern with a readable error', () => {
    const onSave = vi.fn();
    render(<CustomStrategyBuilder onSave={onSave} onCancel={() => {}} initialRules={[{ type: 'pattern', sequence: ['left'] }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove move 1' }));
    fireEvent.click(screen.getByText('Save Strategy'));
    expect(screen.getByText('Pattern sequence cannot be empty')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('tests the exact depth and shows scores plus replay links', async () => {
    render(<CustomStrategyBuilder onSave={() => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Look-ahead depth'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test drive' }));
    expect(mockedPreview.mock.calls[0][0][0]).toMatchObject({ type: 'evaluation', depth: 5 });
    await waitFor(() => expect(screen.getByText('your avg score')).toBeInTheDocument());
    expect(screen.getByText('random avg')).toBeInTheDocument();
    expect(screen.getByText(/1,200 points ahead of Random/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replay test game 1' })).toBeInTheDocument();
  });

  it('cancels a pending preview and ignores its stale completion', async () => {
    let complete!: (games: StrategyPreviewGame[]) => void;
    const cancel = vi.fn();
    mockedPreview.mockReturnValue({ promise: new Promise((resolve) => { complete = resolve; }), cancel });
    render(<CustomStrategyBuilder onSave={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Test drive' }));
    expect(screen.getByRole('status')).toHaveTextContent('0 / 3 games');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel test' }));
    expect(cancel).toHaveBeenCalledTimes(1);
    await act(async () => { complete(games); });
    expect(screen.queryByText('your avg score')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test drive' })).toBeEnabled();
  });

  it('stops preview work when controls change or the builder unmounts', () => {
    const cancel = vi.fn();
    mockedPreview.mockReturnValue({ promise: new Promise(() => {}), cancel });
    const { unmount } = render(<CustomStrategyBuilder onSave={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Test drive' }));
    fireEvent.change(screen.getByLabelText('Empty Tiles'), { target: { value: '4' } });
    expect(cancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Test drive' }));
    unmount();
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it('surfaces worker failure and permits a retry', async () => {
    mockedPreview.mockReturnValue({ promise: Promise.reject(new Error('Test drive exceeded 60 seconds.')), cancel: vi.fn() });
    render(<CustomStrategyBuilder onSave={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Test drive' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Test drive exceeded 60 seconds.'));
    expect(screen.getByRole('button', { name: 'Test drive' })).toBeEnabled();
  });

  it('awaits persistence and keeps an unsuccessful save editable', async () => {
    let fail!: (error: Error) => void;
    const onSave = vi.fn(() => new Promise<void>((_, reject) => { fail = reject; }));
    render(<CustomStrategyBuilder onSave={onSave} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Save Strategy'));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByLabelText('Empty Tiles')).toBeDisabled();
    await act(async () => { fail(new Error('Could not write strategy to storage.')); });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not write strategy to storage.');
    expect(screen.getByRole('button', { name: 'Save Strategy' })).toBeEnabled();
    expect(screen.getByLabelText('Empty Tiles')).toBeEnabled();
  });
});
