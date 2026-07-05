import React from 'react';

interface Props {
  isConnected: boolean;
  sessionCount: number;
  onLogout: () => void;
}

export function StatusBar({ isConnected, sessionCount, onLogout }: Props) {
  return (
    <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm font-medium">
          {isConnected ? `${sessionCount} browser${sessionCount !== 1 ? 's' : ''}` : 'Disconnected'}
        </span>
      </div>
      <button
        onClick={onLogout}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        Logout
      </button>
    </header>
  );
}
