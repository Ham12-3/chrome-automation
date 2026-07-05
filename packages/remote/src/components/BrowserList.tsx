import React from 'react';

interface Session {
  id: string;
  name: string;
  tabCount: number;
  connectionState?: string;
  lastHeartbeat?: number;
  browserVersion?: string;
  platform?: string;
}

interface Props {
  sessions: Session[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
}

export function BrowserList({ sessions, activeSessionId, onSelect }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-center">
        <p className="text-gray-500 text-sm">No browsers connected</p>
        <p className="text-gray-600 text-xs mt-1">
          Install the Chrome Automation extension and connect it to the server
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Connected Browsers
      </h2>
      {sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => onSelect(session.id)}
          className={`w-full text-left p-3 rounded-lg border transition-colors ${
            session.id === activeSessionId
              ? 'bg-indigo-900/30 border-indigo-700'
              : 'bg-gray-900 border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {session.name}{session.browserVersion ? ` ${session.browserVersion}` : ''}
            </span>
            <span className="text-xs text-gray-500">{session.tabCount} tabs</span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <div className="text-xs text-gray-600 font-mono">{session.id}</div>
            <div className="text-xs text-gray-500">
              {session.connectionState ?? 'connected'}
            </div>
          </div>
          {session.lastHeartbeat && (
            <div className="text-[11px] text-gray-600 mt-1">
              Last seen {new Date(session.lastHeartbeat).toLocaleTimeString()}
              {session.platform ? ` on ${session.platform}` : ''}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
