import React, { useState, useCallback, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useAuth } from './hooks/useAuth';
import { StatusBar } from './components/StatusBar';
import { BrowserList } from './components/BrowserList';
import { Chat } from './components/Chat';
import { Screenshot } from './components/Screenshot';

interface SessionSummary {
  id: string;
  name: string;
  tabCount: number;
  connectionState?: string;
  lastHeartbeat?: number;
  browserVersion?: string;
  platform?: string;
}

export function App() {
  const { token, isLoggedIn, login, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const handleMessage = useCallback((msg: Record<string, unknown>) => {
    if (msg.type === 'screenshot') {
      const dataUrl = msg.dataUrl as string | undefined;
      if (dataUrl) {
        setScreenshot(dataUrl);
      }
    }
    if (msg.type === 'sessions') {
      setSessions(msg.sessions as SessionSummary[]);
      setActiveSessionId(msg.activeSessionId as string | null);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions ?? []);
      setActiveSessionId(data.activeSessionId ?? null);
    } catch {
      // Ignore; WebSocket will retry live updates
    }
  }, [token]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const { isConnected, sendMessage } = useWebSocket(
    token ? `ws://127.0.0.1:3456/ws?token=${token}` : null,
    handleMessage,
  );

  const handleLogin = async () => {
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.token) {
        login(data.token);
      } else {
        setLoginError(data.error ?? 'Login failed');
      }
    } catch {
      setLoginError('Connection failed. Is the server running?');
    }
  };

  const handleSendChat = (message: string) => {
    sendMessage({ type: 'chat', message, sessionId: activeSessionId });
  };

  const handleTakeScreenshot = () => {
    if (activeSessionId) {
      sendMessage({ type: 'takeScreenshot', sessionId: activeSessionId });
    }
  };

  // ─── Login Screen ──────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center mb-2 text-indigo-400">
            🔧 Chrome Automation
          </h1>
          <p className="text-center text-gray-400 mb-6 text-sm">
            Remote control for your browser
          </p>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <label className="block text-sm text-gray-400 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Enter server password"
              autoFocus
            />
            {loginError && (
              <p className="text-red-400 text-xs mt-2">{loginError}</p>
            )}
            <button
              onClick={handleLogin}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
            >
              Connect
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Dashboard ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      <StatusBar isConnected={isConnected} sessionCount={sessions.length} onLogout={logout} />

      <main className="flex-1 p-4 space-y-4 max-w-lg mx-auto w-full">
        <BrowserList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={(id) => {
            setActiveSessionId(id);
            sendMessage({ type: 'setActiveSession', sessionId: id });
          }}
        />

        {screenshot && (
          <Screenshot dataUrl={screenshot} onRefresh={handleTakeScreenshot} />
        )}

        {!screenshot && activeSessionId && (
          <button
            onClick={handleTakeScreenshot}
            className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-lg text-sm transition-colors border border-gray-700"
          >
            📸 Take Screenshot
          </button>
        )}

        <Chat onSend={handleSendChat} />
      </main>
    </div>
  );
}
