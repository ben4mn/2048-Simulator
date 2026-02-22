import React from 'react';

interface BottomNavProps {
  activeTab: 'play' | 'batch' | 'results';
  onTabChange: (tab: 'play' | 'batch' | 'results') => void;
  resultCount: number;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, resultCount }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-dark-border md:hidden bottom-nav z-40 backdrop-blur-md">
      <div className="flex items-center justify-around h-14">
        <button
          onClick={() => onTabChange('play')}
          className={`flex flex-col items-center gap-0.5 px-4 py-1.5 transition-colors ${
            activeTab === 'play' ? 'text-accent' : 'text-text-muted'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[10px] font-medium">Play</span>
        </button>

        <button
          onClick={() => onTabChange('batch')}
          className={`flex flex-col items-center gap-0.5 px-4 py-1.5 transition-colors ${
            activeTab === 'batch' ? 'text-accent' : 'text-text-muted'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="text-[10px] font-medium">Batch</span>
        </button>

        <button
          onClick={() => onTabChange('results')}
          className={`relative flex flex-col items-center gap-0.5 px-4 py-1.5 transition-colors ${
            activeTab === 'results' ? 'text-accent' : 'text-text-muted'
          }`}
        >
          <div className="relative">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            {resultCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center bg-accent text-gray-950 text-[9px] font-bold rounded-full px-1">
                {resultCount > 99 ? '99+' : resultCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">Results</span>
        </button>
      </div>
    </div>
  );
};

export default BottomNav;
