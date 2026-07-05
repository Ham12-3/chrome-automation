import React from 'react';

interface Props {
  dataUrl: string;
  onRefresh: () => void;
}

export function Screenshot({ dataUrl, onRefresh }: Props) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-xs text-gray-500">Screenshot</span>
        <button
          onClick={onRefresh}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>
      <img
        src={dataUrl}
        alt="Browser screenshot"
        className="w-full"
        onClick={() => {
          // Open full-size in new tab
          window.open(dataUrl, '_blank');
        }}
      />
    </div>
  );
}
