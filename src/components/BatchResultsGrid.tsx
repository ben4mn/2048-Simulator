/**
 * Batch Results Grid Component
 * Displays a grid of game results with sorting and filtering
 */

import React, { useState } from 'react';
import GameBoard from './GameBoard';
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

  // Sort results
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

  // Paginate
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
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Showing {paginatedResults.length} of {results.length} games
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value) as 10 | 20 | 30);
              setCurrentPage(0);
            }}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={30}>30 per page</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <button
            onClick={() => handleSort('score')}
            className={`px-3 py-1 text-sm rounded ${
              sortField === 'score' ? 'bg-amber-600 text-white' : 'bg-gray-200'
            }`}
          >
            Score {sortField === 'score' && (sortDesc ? '↓' : '↑')}
          </button>
          <button
            onClick={() => handleSort('maxTile')}
            className={`px-3 py-1 text-sm rounded ${
              sortField === 'maxTile' ? 'bg-amber-600 text-white' : 'bg-gray-200'
            }`}
          >
            Max Tile {sortField === 'maxTile' && (sortDesc ? '↓' : '↑')}
          </button>
          <button
            onClick={() => handleSort('moves')}
            className={`px-3 py-1 text-sm rounded ${
              sortField === 'moves' ? 'bg-amber-600 text-white' : 'bg-gray-200'
            }`}
          >
            Moves {sortField === 'moves' && (sortDesc ? '↓' : '↑')}
          </button>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {paginatedResults.map((result) => (
          <GameResultCard
            key={result.id}
            result={result}
            onClick={() => onSelectGame(result.id)}
            onPlaySeed={onPlaySeed}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
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
  // Reconstruct board from final state (simplified - just show empty board for now)
  const emptyBoard = Array(4).fill(null).map(() => Array(4).fill(0));

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-md p-3 cursor-pointer hover:shadow-xl transition-shadow border-2 border-transparent hover:border-amber-500"
    >
      <div className="mb-2">
        <GameBoard board={emptyBoard} size="small" />
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600">Seed:</span>
          <span className="font-bold font-mono text-[10px]">{result.seed}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Score:</span>
          <span className="font-bold">{result.finalScore.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Max:</span>
          <span className="font-bold">{result.maxTile}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Moves:</span>
          <span className="font-bold">{result.moveCount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Result:</span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-bold ${
              result.result === 'win' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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
            className="w-full mt-2 px-2 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-semibold rounded transition-colors"
          >
            Play This Seed
          </button>
        )}
      </div>
    </div>
  );
};

export default BatchResultsGrid;
