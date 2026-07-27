// @vitest-environment jsdom
/**
 * Builder behavior: deterministic summary card, auto-naming at save time,
 * test drive vs Random baseline, and legacy-rule migration on open.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { CustomStrategyBuilder } from '../CustomStrategyBuilder';
import { DEFAULT_WEIGHTS } from '../../engine/customRules';

describe('CustomStrategyBuilder', () => {
  afterEach(() => {
    cleanup();
  });

  it('saves with an auto-generated name when the name field is blank', () => {
    const onSave = vi.fn();
    render(<CustomStrategyBuilder onSave={onSave} onCancel={() => {}} />);

    fireEvent.click(screen.getByText('Save Strategy'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [rules, name] = onSave.mock.calls[0];
    expect(rules).toHaveLength(1);
    expect(rules[0].type).toBe('evaluation');
    expect(name.length).toBeGreaterThan(0);
  });

  it('shows a plain-English summary card derived from the config', () => {
    render(<CustomStrategyBuilder onSave={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('What this strategy does')).toBeTruthy();
    // Default weights: corner anchoring is the top trait.
    expect(screen.getAllByText(/corner/i).length).toBeGreaterThan(0);
  });

  it('migrates legacy weighted rules into the evaluation editor', () => {
    const onSave = vi.fn();
    render(
      <CustomStrategyBuilder
        onSave={onSave}
        onCancel={() => {}}
        initialRules={[{ type: 'weighted', weights: DEFAULT_WEIGHTS }]}
        initialName="Legacy"
      />
    );

    fireEvent.click(screen.getByText('Save Strategy'));
    const [rules] = onSave.mock.calls[0];
    expect(rules[0]).toMatchObject({ type: 'evaluation', depth: 1 });
  });

  it('test drive reports strategy vs random averages', async () => {
    render(<CustomStrategyBuilder onSave={() => {}} onCancel={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Test drive' }));

    await waitFor(
      () => {
        expect(screen.getByText('your avg score')).toBeTruthy();
        expect(screen.getByText('random avg')).toBeTruthy();
      },
      { timeout: 10000 }
    );
  }, 15000);
});
