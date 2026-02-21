/**
 * RuleCard Component
 * Individual draggable rule card with condition picker
 */

import React, { useState } from 'react';
import type { Rule, Direction, RuleCondition } from '../engine/types';

interface RuleCardProps {
  rule: Rule;
  index: number;
  onUpdate: (id: string, updates: Partial<Rule>) => void;
  onRemove: (id: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  isDragOver: boolean;
}

const DIRECTION_ARROWS: Record<Direction, string> = {
  left: '\u2190',
  right: '\u2192',
  up: '\u2191',
  down: '\u2193',
};

const DIRECTION_COLORS: Record<Direction, string> = {
  left: 'bg-blue-500',
  right: 'bg-emerald-500',
  up: 'bg-purple-500',
  down: 'bg-orange-500',
};

const DIRECTION_COLORS_LIGHT: Record<Direction, string> = {
  left: 'bg-blue-50 border-blue-200',
  right: 'bg-emerald-50 border-emerald-200',
  up: 'bg-purple-50 border-purple-200',
  down: 'bg-orange-50 border-orange-200',
};

function conditionLabel(condition: RuleCondition): string {
  switch (condition.type) {
    case 'always':
      return 'Always';
    case 'fallback':
      return `When ${condition.whenUnavailable.map(d => DIRECTION_ARROWS[d]).join(', ')} unavailable`;
    case 'board':
      switch (condition.check.type) {
        case 'highest_tile_in':
          return 'Highest tile in position';
        case 'merge_available':
          return `Merge available ${DIRECTION_ARROWS[condition.check.direction]}`;
        case 'empty_cells_above':
          return `Board open (>${condition.check.threshold} empty)`;
        case 'empty_cells_below':
          return `Board crowded (<${condition.check.threshold} empty)`;
        default:
          return 'Board condition';
      }
    default:
      return 'Always';
  }
}

const ALL_DIRECTIONS: Direction[] = ['left', 'right', 'up', 'down'];

export const RuleCard: React.FC<RuleCardProps> = ({
  rule,
  index,
  onUpdate,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragOver,
}) => {
  const [expanded, setExpanded] = useState(false);

  const handleConditionTypeChange = (type: string) => {
    let condition: RuleCondition;
    switch (type) {
      case 'fallback':
        condition = { type: 'fallback', whenUnavailable: ALL_DIRECTIONS.filter(d => d !== rule.direction) };
        break;
      case 'board_crowded':
        condition = { type: 'board', check: { type: 'empty_cells_below', threshold: 4 } };
        break;
      case 'board_open':
        condition = { type: 'board', check: { type: 'empty_cells_above', threshold: 6 } };
        break;
      case 'merge_available':
        condition = { type: 'board', check: { type: 'merge_available', direction: rule.direction } };
        break;
      case 'highest_in_corner':
        condition = { type: 'board', check: { type: 'highest_tile_in', positions: [[3, 0]] } };
        break;
      default:
        condition = { type: 'always' };
    }
    onUpdate(rule.id, { condition });
  };

  const getConditionType = (): string => {
    if (rule.condition.type === 'always') return 'always';
    if (rule.condition.type === 'fallback') return 'fallback';
    if (rule.condition.type === 'board') {
      switch (rule.condition.check.type) {
        case 'empty_cells_below': return 'board_crowded';
        case 'empty_cells_above': return 'board_open';
        case 'merge_available': return 'merge_available';
        case 'highest_tile_in': return 'highest_in_corner';
        default: return 'always';
      }
    }
    return 'always';
  };

  const handleFallbackToggle = (dir: Direction) => {
    if (rule.condition.type !== 'fallback') return;
    const current = rule.condition.whenUnavailable;
    const updated = current.includes(dir)
      ? current.filter(d => d !== dir)
      : [...current, dir];
    if (updated.length === 0) return; // must have at least one
    onUpdate(rule.id, { condition: { type: 'fallback', whenUnavailable: updated } });
  };

  const handleThresholdChange = (threshold: number) => {
    if (rule.condition.type !== 'board') return;
    const check = rule.condition.check;
    if (check.type === 'empty_cells_above' || check.type === 'empty_cells_below') {
      onUpdate(rule.id, { condition: { type: 'board', check: { ...check, threshold } } });
    }
  };

  const handleCornerChange = (corner: string) => {
    if (rule.condition.type !== 'board' || rule.condition.check.type !== 'highest_tile_in') return;
    const positions: Record<string, [number, number][]> = {
      'bottom-left': [[3, 0]],
      'bottom-right': [[3, 3]],
      'top-left': [[0, 0]],
      'top-right': [[0, 3]],
    };
    onUpdate(rule.id, {
      condition: { type: 'board', check: { type: 'highest_tile_in', positions: positions[corner] || [[3, 0]] } },
    });
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e, index); }}
      onDragEnd={onDragEnd}
      className={`
        border-2 rounded-lg transition-all duration-200 select-none
        ${DIRECTION_COLORS_LIGHT[rule.direction]}
        ${isDragOver ? 'border-amber-500 scale-[1.02] shadow-lg' : ''}
        hover:shadow-md
      `}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 p-3">
        {/* Drag handle */}
        <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
          </svg>
        </div>

        {/* Priority number */}
        <span className="text-xs font-mono text-gray-400 w-4 text-center flex-shrink-0">
          {index + 1}
        </span>

        {/* Direction badge */}
        <div className={`${DIRECTION_COLORS[rule.direction]} text-white px-3 py-1.5 rounded-md font-bold text-lg flex-shrink-0 min-w-[48px] text-center`}>
          {DIRECTION_ARROWS[rule.direction]}
        </div>

        {/* Direction label + condition */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm capitalize text-gray-800">
            {rule.direction}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {conditionLabel(rule.condition)}
          </div>
        </div>

        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
          title="Edit condition"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Remove button */}
        <button
          onClick={() => onRemove(rule.id)}
          className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"
          title="Remove rule"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Expanded condition picker */}
      {expanded && (
        <div className="border-t border-gray-200 p-3 space-y-3 bg-white/50 rounded-b-lg">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Condition</label>
            <select
              value={getConditionType()}
              onChange={(e) => handleConditionTypeChange(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="always">Always (no condition)</option>
              <option value="fallback">Only when other directions unavailable</option>
              <option value="board_crowded">When board is crowded</option>
              <option value="board_open">When board is open</option>
              <option value="merge_available">When merge is available</option>
              <option value="highest_in_corner">When highest tile is in corner</option>
            </select>
          </div>

          {/* Fallback direction picker */}
          {rule.condition.type === 'fallback' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                When these are unavailable:
              </label>
              <div className="flex gap-2">
                {ALL_DIRECTIONS.filter(d => d !== rule.direction).map(dir => (
                  <button
                    key={dir}
                    onClick={() => handleFallbackToggle(dir)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      rule.condition.type === 'fallback' && rule.condition.whenUnavailable.includes(dir)
                        ? `${DIRECTION_COLORS[dir]} text-white`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {DIRECTION_ARROWS[dir]} {dir}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Threshold slider for board conditions */}
          {rule.condition.type === 'board' &&
            (rule.condition.check.type === 'empty_cells_above' || rule.condition.check.type === 'empty_cells_below') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Threshold: {rule.condition.check.threshold} empty cells
              </label>
              <input
                type="range"
                min={1}
                max={14}
                value={rule.condition.check.threshold}
                onChange={(e) => handleThresholdChange(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>1 (very crowded)</span>
                <span>14 (very open)</span>
              </div>
            </div>
          )}

          {/* Corner picker for highest_tile_in */}
          {rule.condition.type === 'board' && rule.condition.check.type === 'highest_tile_in' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Corner position</label>
              <div className="grid grid-cols-2 gap-2 w-48">
                {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(corner => {
                  const posMap: Record<string, string> = {
                    'top-left': '0,0', 'top-right': '0,3',
                    'bottom-left': '3,0', 'bottom-right': '3,3',
                  };
                  const isActive = rule.condition.type === 'board'
                    && rule.condition.check.type === 'highest_tile_in'
                    && rule.condition.check.positions[0]?.join(',') === posMap[corner];
                  return (
                    <button
                      key={corner}
                      onClick={() => handleCornerChange(corner)}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        isActive ? 'bg-amber-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                      }`}
                    >
                      {corner}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RuleCard;
