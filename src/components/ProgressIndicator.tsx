/**
 * Progress Indicator Component
 * Shows progress for batch simulations
 */

import React from 'react';

interface ProgressIndicatorProps {
  current: number;
  total: number;
  label?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  current,
  total,
  label = 'Progress',
}) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-medium text-gray-700">
          {current} / {total} ({percentage}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
        <div
          className="bg-amber-600 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        >
          <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      </div>
    </div>
  );
};

export default ProgressIndicator;
