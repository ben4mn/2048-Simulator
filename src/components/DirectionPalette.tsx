/**
 * DirectionPalette Component
 * Source palette of four direction cards that can be dragged into the rule list
 */

import React from 'react';
import type { Direction } from '../engine/types';

interface DirectionPaletteProps {
  onAdd: (direction: Direction) => void;
}

const DIRECTIONS: { dir: Direction; arrow: string; color: string; label: string }[] = [
  { dir: 'left', arrow: '\u2190', color: 'bg-blue-500 hover:bg-blue-600', label: 'Left' },
  { dir: 'down', arrow: '\u2193', color: 'bg-orange-500 hover:bg-orange-600', label: 'Down' },
  { dir: 'right', arrow: '\u2192', color: 'bg-emerald-500 hover:bg-emerald-600', label: 'Right' },
  { dir: 'up', arrow: '\u2191', color: 'bg-purple-500 hover:bg-purple-600', label: 'Up' },
];

export const DirectionPalette: React.FC<DirectionPaletteProps> = ({ onAdd }) => {
  const handleDragStart = (e: React.DragEvent, dir: Direction) => {
    e.dataTransfer.setData('direction', dir);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
        Directions
      </label>
      <div className="grid grid-cols-2 gap-2">
        {DIRECTIONS.map(({ dir, arrow, color, label }) => (
          <button
            key={dir}
            draggable
            onDragStart={(e) => handleDragStart(e, dir)}
            onClick={() => onAdd(dir)}
            className={`
              ${color} text-white
              rounded-lg p-3
              flex flex-col items-center gap-1
              cursor-grab active:cursor-grabbing
              transition-all duration-150
              hover:scale-105 hover:shadow-lg
              active:scale-95
              select-none
            `}
          >
            <span className="text-2xl font-bold leading-none">{arrow}</span>
            <span className="text-xs font-medium opacity-90">{label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2 text-center">
        Click or drag to add
      </p>
    </div>
  );
};

export default DirectionPalette;
