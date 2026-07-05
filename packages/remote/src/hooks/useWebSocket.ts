import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebSocket(
  url: string | null,
  onMessage: (msg: Record<string, unknown>) => void,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connect = useCallback(() => {
    if (!url) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('[Remote] WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        onMessage(msg);
      } catch {
        // Ignore
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Reconnect after 3s
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { isConnected, sendMessage };
}
