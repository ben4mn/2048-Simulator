/**
 * Batch Results Grid Component
 * Displays a grid of game results with sorting and filtering
 */

import React, { useEffect, useState } from 'react';
import type { GameResult } from '../engine/types';

interface BatchResultsGridProps {
  results: GameResult[];
  onSelectGame: (gameId: string) => void;
  onPlaySeed?: (seed: string) => void;
  pageSize?: 10 | 20 | 30;
}

type SortField = 'score' | 'maxTile' | 'moves' | 'result';

export const BatchResultsGrid: React.FC<BatchResultsGridProps> = ({
  results,
  onSelectGame,
  onPlaySeed,
  pageSize: initialPageSize = 10,
}) => {
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    setCurrentPage(0);
  }, [results]);

  const sortedResults = [...results].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'score':
        comparison = a.finalScore - b.finalScore;
        break;
      case 'maxTile':
        comparison = a.maxTile - b.maxTile;
        break;
      case 'moves':
        comparison = a.moveCount - b.moveCount;
        break;
      case 'result':
        comparison = a.result === b.result ? 0 : a.result === 'win' ? 1 : -1;
        break;
    }

    return sortDesc ? -comparison : comparison;
  });

  const totalPages = Math.ceil(sortedResults.length / pageSize);
  const paginatedResults = sortedResults.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm text-text-muted">
            Showing {paginatedResults.length} of {results.length} games
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value) as 10 | 20 | 30);
              setCurrentPage(0);
            }}
            className="px-3 py-1 border border-dark-border bg-surface-raised text-text-primary rounded-md text-sm"
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={30}>30 per page</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-text-muted">Sort by:</span>
          <button
            onClick={() => handleSort('score')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              sortField === 'score' ? 'bg-accent text-gray-950' : 'bg-surface-raised text-text-primary hover:bg-surface-elevated'
            }`}
          >
            Score {sortField === 'score' && (sortDesc ? '↓' : '↑')}
          </button>
          <button
            onClick={() => handleSort('maxTile')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              sortField === 'maxTile' ? 'bg-accent text-gray-950' : 'bg-surface-raised text-text-primary hover:bg-surface-elevated'
            }`}
          >
            Max Tile {sortField === 'maxTile' && (sortDesc ? '↓' : '↑')}
          </button>
          <button
            onClick={() => handleSort('moves')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              sortField === 'moves' ? 'bg-accent text-gray-950' : 'bg-surface-raised text-text-primary hover:bg-surface-elevated'
            }`}
          >
            Moves {sortField === 'moves' && (sortDesc ? '↓' : '↑')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {paginatedResults.map((result) => (
          <GameResultCard
            key={result.id}
            result={result}
            onClick={() => onSelectGame(result.id)}
            onPlaySeed={onPlaySeed}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="px-3 py-1 bg-surface-raised text-text-primary rounded border border-dark-border disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-text-muted">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
            className="px-3 py-1 bg-surface-raised text-text-primary rounded border border-dark-border disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

const GameResultCard: React.FC<{
  result: GameResult;
  onClick: () => void;
  onPlaySeed?: (seed: string) => void;
}> = ({ result, onClick, onPlaySeed }) => {
  return (
    <div
      onClick={onClick}
      className="bg-surface-raised rounded-lg cursor-pointer hover:border-accent transition-all border border-dark-border overflow-hidden"
    >
      <div
        className={`h-1.5 rounded-t-lg ${
          result.result === 'win' ? 'bg-success' : 'bg-danger'
        }`}
      />

      <div className="p-3 space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <span className="text-text-muted">Seed:</span>
          <span className="font-bold font-mono text-[10px] text-text-primary">{result.seed}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-text-muted">Score:</span>
          <span className="font-bold text-text-primary">{result.finalScore.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-text-muted">Max:</span>
          <span className="font-bold text-text-primary">{result.maxTile}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-text-muted">Moves:</span>
          <span className="font-bold text-text-primary">{result.moveCount}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-text-muted">Result:</span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-bold ${
              result.result === 'win'
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'bg-red-500/20 text-red-200'
            }`}
          >
            {result.result.toUpperCase()}
          </span>
        </div>
        {onPlaySeed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlaySeed(result.seed);
            }}
            className="w-full mt-2 px-2 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-100 text-xs font-semibold rounded transition-colors"
          >
            Play This Seed
          </button>
        )}
      </div>
    </div>
  );
};

export default BatchResultsGrid;
