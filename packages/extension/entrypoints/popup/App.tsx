import React, { useEffect, useState } from 'react';
import type { ExtensionConnectionStatus } from '@chrome-automation/shared';

const fallbackStatus: ExtensionConnectionStatus = {
  connected: false,
  state: 'idle',
  wsUrl: 'ws://127.0.0.1:7890',
  browserName: 'Browser',
  sessionId: null,
  reconnectAttempt: 0,
  nextReconnectAt: null,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  lastHeartbeatAt: null,
  lastError: null,
};

function formatTime(value: number | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleTimeString();
}

export function App() {
  const [status, setStatus] = useState<ExtensionConnectionStatus>(fallbackStatus);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response) {
        setStatus({ ...fallbackStatus, ...response });
      }
    });

    chrome.storage.local.get('connectionStatus').then((data) => {
      if (data.connectionStatus) {
        setStatus({ ...fallbackStatus, ...data.connectionStatus });
      }
    });

    // Listen for storage changes
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.connectionStatus) {
        setStatus({ ...fallbackStatus, ...changes.connectionStatus.newValue });
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

  const handleReconnect = () => {
    chrome.runtime.sendMessage({ type: 'RECONNECT' });
  };

  const handleDisconnect = () => {
    chrome.runtime.sendMessage({ type: 'DISCONNECT' });
  };

  return (
    <div>
      <div className="status">
        <div className={`dot ${status.connected ? 'connected' : 'disconnected'}`} />
        <span style={{ fontSize: 13 }}>
          {status.connected ? 'Connected' : status.state}
        </span>
      </div>

      <div className="info">Browser</div>
      <div className="value">
        {status.browserName}{status.browserVersion ? ` ${status.browserVersion}` : ''}
      </div>

      <div className="info">Server</div>
      <div className="value">{status.wsUrl}</div>

      {status.sessionId && (
        <>
          <div className="info">Session ID</div>
          <div className="value">{status.sessionId}</div>
        </>
      )}

      <div className="info">Last heartbeat</div>
      <div className="value">{formatTime(status.lastHeartbeatAt)}</div>

      {status.nextReconnectAt && !status.connected && (
        <>
          <div className="info">Next reconnect</div>
          <div className="value">{formatTime(status.nextReconnectAt)}</div>
        </>
      )}

      {status.lastError && (
        <div style={{ marginTop: 10, color: '#fca5a5', fontSize: 12, lineHeight: 1.4 }}>
          {status.lastError}
        </div>
      )}

      <div className="actions">
        <button className="btn-connect" onClick={handleReconnect}>
          Reconnect
        </button>
        <button className="btn-disconnect" onClick={handleDisconnect}>
          Disconnect
        </button>
      </div>
    </div>
  );
}
