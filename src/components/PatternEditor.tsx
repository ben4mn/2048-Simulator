import type { PatternRule } from '../engine/customRules';
import type { Direction } from '../engine/types';

const DIRECTIONS: Direction[] = ['left', 'down', 'right', 'up'];
const ARROWS: Record<Direction, string> = { left: '←', down: '↓', right: '→', up: '↑' };

export function PatternEditor({ rule, onChange }: { rule: PatternRule; onChange: (rule: PatternRule) => void }) {
  return (
    <div className="rounded-xl border border-dark-border bg-surface-raised p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Your move loop</h3>
        <p className="text-xs text-text-muted mt-1">Repeat these moves in order. Blocked directions are skipped; the game stops if every direction in the loop is blocked.</p>
      </div>
      <ol className="flex flex-wrap gap-2" aria-label="Move sequence">
        {rule.sequence.map((direction, index) => (
          <li key={index} className="flex items-center gap-1 rounded-lg bg-accent/10 border border-accent/30 p-2">
            <span className="text-[10px] text-text-muted">{index + 1}</span>
            <select
              aria-label={`Move ${index + 1} direction`}
              value={direction}
              onChange={(event) => onChange({ ...rule, sequence: rule.sequence.map((move, i) => i === index ? event.target.value as Direction : move) })}
              className="bg-surface-elevated rounded-md px-2 py-1 text-sm text-accent border border-dark-border"
            >
              {DIRECTIONS.map((move) => <option value={move} key={move}>{ARROWS[move]} {move}</option>)}
            </select>
            <button
              type="button"
              aria-label={`Remove move ${index + 1}`}
              onClick={() => onChange({ ...rule, sequence: rule.sequence.filter((_, i) => i !== index) })}
              className="px-1 text-text-muted hover:text-danger"
            >×</button>
          </li>
        ))}
      </ol>
      {rule.sequence.length === 0 && <p role="alert" className="text-sm text-danger">Add at least one direction to your loop.</p>}
      <div className="flex flex-wrap gap-2">
        {DIRECTIONS.map((direction) => (
          <button
            type="button"
            key={direction}
            disabled={rule.sequence.length >= 16}
            onClick={() => onChange({ ...rule, sequence: [...rule.sequence, direction] })}
            className="px-3 py-2 rounded-lg border border-dark-border bg-surface-elevated hover:border-accent/50 text-sm text-text-primary disabled:opacity-40"
          >+ {ARROWS[direction]} {direction}</button>
        ))}
      </div>
      <p className="text-xs text-text-muted">Up to 16 moves. Include all four directions for a loop that can always find a legal move.</p>
    </div>
  );
}
