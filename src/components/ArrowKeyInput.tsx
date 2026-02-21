/**
 * ArrowKeyInput Component
 * Keyboard capture mode for quickly building a directional priority sequence
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Direction } from '../engine/types';

interface ArrowKeyInputProps {
  onSequenceChange: (directions: Direction[]) => void;
  sequence: Direction[];
}

const DIRECTION_MAP: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

const ARROW_DISPLAY: Record<Direction, { arrow: string; color: string }> = {
  left: { arrow: '\u2190', color: 'bg-blue-500' },
  right: { arrow: '\u2192', color: 'bg-emerald-500' },
  up: { arrow: '\u2191', color: 'bg-purple-500' },
  down: { arrow: '\u2193', color: 'bg-orange-500' },
};

export const ArrowKeyInput: React.FC<ArrowKeyInputProps> = ({ onSequenceChange, sequence }) => {
  const [focused, setFocused] = useState(false);
  const [lastKey, setLastKey] = useState<Direction | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!focused) return;

    const dir = DIRECTION_MAP[e.key];
    if (dir) {
      e.preventDefault();
      setLastKey(dir);
      setTimeout(() => setLastKey(null), 300);
      onSequenceChange([...sequence, dir]);
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      onSequenceChange(sequence.slice(0, -1));
      return;
    }
  }, [focused, sequence, onSequenceChange]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleClear = () => {
    onSequenceChange([]);
  };

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        tabIndex={0}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`
          relative rounded-xl p-6 text-center cursor-pointer
          transition-all duration-200 min-h-[160px]
          flex flex-col items-center justify-center gap-4
          ${focused
            ? 'bg-amber-50 border-2 border-amber-500 shadow-lg ring-4 ring-amber-200/50'
            : 'bg-gray-50 border-2 border-dashed border-gray-300 hover:border-amber-400 hover:bg-amber-50/50'
          }
        `}
      >
        {!focused && sequence.length === 0 && (
          <div className="text-gray-500">
            <div className="text-4xl mb-2 opacity-40">
              {'\u2190'} {'\u2193'} {'\u2192'} {'\u2191'}
            </div>
            <div className="text-sm font-medium">Click here, then press arrow keys</div>
            <div className="text-xs text-gray-400 mt-1">Build your priority sequence</div>
          </div>
        )}

        {focused && sequence.length === 0 && (
          <div className="text-amber-700">
            <div className={`text-5xl mb-2 transition-transform ${lastKey ? 'scale-125' : ''}`}>
              {'\u2328'}
            </div>
            <div className="text-sm font-medium animate-pulse">Press arrow keys in priority order...</div>
            <div className="text-xs text-gray-500 mt-1">Backspace to undo</div>
          </div>
        )}

        {sequence.length > 0 && (
          <div className="w-full">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {sequence.map((dir, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <svg width="16" height="16" viewBox="0 0 16 16" className="text-gray-300 flex-shrink-0">
                      <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                  <div
                    className={`
                      ${ARROW_DISPLAY[dir].color} text-white
                      w-12 h-12 rounded-lg
                      flex items-center justify-center
                      text-xl font-bold shadow-md
                      ${lastKey === dir && i === sequence.length - 1 ? 'animate-bounce-in scale-110' : ''}
                      transition-transform duration-200
                    `}
                  >
                    {ARROW_DISPLAY[dir].arrow}
                  </div>
                </React.Fragment>
              ))}
            </div>
            {focused && (
              <div className="text-xs text-gray-500 mt-3">
                Keep pressing arrows to add more, or Backspace to remove
              </div>
            )}
          </div>
        )}
      </div>

      {sequence.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {sequence.length} rule{sequence.length !== 1 ? 's' : ''} in sequence
          </span>
          <button
            onClick={handleClear}
            className="text-sm text-red-500 hover:text-red-700 font-medium"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};

export default ArrowKeyInput;
