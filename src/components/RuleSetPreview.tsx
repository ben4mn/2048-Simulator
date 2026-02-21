/**
 * RuleSetPreview Component
 * Compact visual summary of a RuleSet shown as a horizontal pill sequence
 */

import React from 'react';
import type { RuleSet, Direction, RuleCondition } from '../engine/types';

interface RuleSetPreviewProps {
  ruleSet: RuleSet;
  compact?: boolean;
}

const ARROWS: Record<Direction, string> = {
  left: '\u2190',
  right: '\u2192',
  up: '\u2191',
  down: '\u2193',
};

const COLORS: Record<Direction, { bg: string; text: string }> = {
  left: { bg: 'bg-blue-100', text: 'text-blue-800' },
  right: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  up: { bg: 'bg-purple-100', text: 'text-purple-800' },
  down: { bg: 'bg-orange-100', text: 'text-orange-800' },
};

function shortCondition(condition: RuleCondition): string | null {
  switch (condition.type) {
    case 'always':
      return null;
    case 'fallback':
      return `when ${condition.whenUnavailable.map(d => ARROWS[d]).join('')} unavail`;
    case 'board':
      switch (condition.check.type) {
        case 'empty_cells_below':
          return 'crowded';
        case 'empty_cells_above':
          return 'open';
        case 'merge_available':
          return `merge ${ARROWS[condition.check.direction]}`;
        case 'highest_tile_in':
          return 'corner';
        default:
          return 'cond';
      }
    default:
      return null;
  }
}

export const RuleSetPreview: React.FC<RuleSetPreviewProps> = ({ ruleSet, compact = false }) => {
  const sortedRules = [...ruleSet.rules].sort((a, b) => a.priority - b.priority);

  if (sortedRules.length === 0) {
    return <span className="text-xs text-gray-400 italic">No rules defined</span>;
  }

  return (
    <div className={`flex items-center gap-1 flex-wrap ${compact ? '' : 'bg-gray-50 rounded-lg px-3 py-2'}`}>
      {sortedRules.map((rule, i) => {
        const cond = shortCondition(rule.condition);
        const { bg, text } = COLORS[rule.direction];

        return (
          <React.Fragment key={rule.id}>
            {i > 0 && (
              <svg width="12" height="12" viewBox="0 0 12 12" className="text-gray-300 flex-shrink-0">
                <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
            <span className={`inline-flex items-center gap-1 ${bg} ${text} px-2 py-0.5 rounded-full text-xs font-medium`}>
              <span className="font-bold">{ARROWS[rule.direction]}</span>
              {cond && <span className="opacity-70 text-[10px]">({cond})</span>}
            </span>
          </React.Fragment>
        );
      })}
      {ruleSet.fallbackDirection && (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" className="text-gray-300 flex-shrink-0">
            <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="inline-flex items-center gap-1 bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium">
            {ARROWS[ruleSet.fallbackDirection]} <span className="opacity-70 text-[10px]">(fallback)</span>
          </span>
        </>
      )}
    </div>
  );
};

export default RuleSetPreview;
