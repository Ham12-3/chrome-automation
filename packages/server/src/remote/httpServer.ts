import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'node:path';
import type { ServerConfig } from '@chrome-automation/shared';
import { AuthService } from './auth.js';
import { sessionStore } from '../session/store.js';
import type { WsServer } from '../ws/wsServer.js';

/**
 * HTTP + WebSocket server for the remote control web app.
 * Provides auth, session listing, and real-time chat/screenshot relay.
 */
export class RemoteHttpServer {
  private app: express.Application;
  private httpServer: ReturnType<express.Application['listen']> | null = null;
  private wss: WebSocketServer | null = null;
  private auth: AuthService;
  private config: ServerConfig;
  private wsServer: WsServer;
  private remoteClients: Set<WebSocket> = new Set();

  private unsubscribeSessions: (() => void) | null = null;

  constructor(config: ServerConfig, wsServer: WsServer) {
    this.config = config;
    this.wsServer = wsServer;
    this.auth = new AuthService(config);
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.subscribeToSessionChanges();
  }

  private setupMiddleware(): void {
    this.app.use(cors({
      origin: (origin, callback) => {
        if (!origin || this.config.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin not allowed: ${origin}`));
      },
    }));
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', sessions: sessionStore.count });
    });

    this.app.get('/demo', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'demo/automation-test.html'));
    });

    // Login
    this.app.post('/api/auth/login', (req, res) => {
      const { password } = req.body;
      const token = this.auth.login(password);
      if (!token) {
        res.status(401).json({ error: 'Invalid password' });
        return;
      }
      res.json({ token });
    });

    // List sessions (requires auth)
    this.app.get('/api/sessions', (req, res) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token || !this.auth.verify(token)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const sessions = sessionStore.getAllSessions();
      res.json({
        sessions: sessions.map(s => ({
          id: s.id,
          name: s.name,
          connectedAt: s.connectedAt,
          connectionState: s.connectionState,
          lastHeartbeat: s.lastHeartbeat,
          lastSeenAt: s.lastSeenAt,
          browserVersion: s.browserVersion,
          platform: s.platform,
          tabCount: s.tabs.length,
          activeTabId: s.activeTabId,
        })),
        activeSessionId: sessionStore.getActiveSession()?.id ?? null,
      });
    });

    // Get screenshot for a session
    this.app.get('/api/screenshot/:sessionId', async (req, res) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token || !this.auth.verify(token)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      try {
        const result = await this.wsServer.sendToSession(req.params.sessionId, {
          type: 'screenshot',
          format: 'jpeg',
        });
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });
  }

  /** Subscribe to session-store changes and push updates to remote clients */
  private subscribeToSessionChanges(): void {
    this.unsubscribeSessions = sessionStore.onChange(() => {
      this.broadcastSessions();
    });
  }

  /** Build the current sessions payload */
  private buildSessionsMessage(): {
    type: 'sessions';
    sessions: Array<{
      id: string;
      name: string;
      tabCount: number;
      activeTabId: number;
      connectionState: string;
      lastHeartbeat: number;
      browserVersion?: string;
      platform?: string;
    }>;
    activeSessionId: string | null;
  } {
    const sessions = sessionStore.getAllSessions();
    return {
      type: 'sessions',
      sessions: sessions.map(s => ({
        id: s.id,
        name: s.name,
        tabCount: s.tabs.length,
        activeTabId: s.activeTabId,
        connectionState: s.connectionState,
        lastHeartbeat: s.lastHeartbeat,
        browserVersion: s.browserVersion,
        platform: s.platform,
      })),
      activeSessionId: sessionStore.getActiveSession()?.id ?? null,
    };
  }

  /** Push the current session list to all connected remote clients */
  broadcastSessions(): void {
    this.broadcast(this.buildSessionsMessage());
  }

  /** Start the HTTP + WebSocket server */
  start(): void {
    this.httpServer = this.app.listen(this.config.httpPort, this.config.host, () => {
      console.log(`[HTTP] Remote control server listening on http://${this.config.host}:${this.config.httpPort}`);
    });

    this.httpServer.on('error', (err: NodeJS.ErrnoException) => {
      console.error(`[HTTP] Failed to start remote control server on port ${this.config.httpPort}: ${err.message}`);
      process.exit(1);
    });

    // WebSocket upgrade for remote clients
    this.wss = new WebSocketServer({ server: this.httpServer as unknown as import('http').Server });

    this.wss.on('connection', (ws, req) => {
      // Auth via query param
      const url = new URL(req.url ?? '/', `http://${this.config.host}:${this.config.httpPort}`);
      const token = url.searchParams.get('token');
      if (!token || !this.auth.verify(token)) {
        ws.close(4001, 'Unauthorized');
        return;
      }

      this.remoteClients.add(ws);
      console.log('[HTTP] Remote client connected');

      // Send the current session list immediately
      ws.send(JSON.stringify(this.buildSessionsMessage()));

      ws.on('message', (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          this.handleRemoteMessage(ws, data);
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on('close', () => {
        this.remoteClients.delete(ws);
        console.log('[HTTP] Remote client disconnected');
      });
    });
  }

  /** Handle messages from the remote web app */
  private handleRemoteMessage(ws: WebSocket, data: Record<string, unknown>): void {
    if (data.type === 'chat') {
      // Relay chat messages to all other remote clients
      for (const client of this.remoteClients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      }
      return;
    }

    if (data.type === 'getSessions') {
      ws.send(JSON.stringify(this.buildSessionsMessage()));
      return;
    }

    if (data.type === 'takeScreenshot') {
      const sessionId = typeof data.sessionId === 'string' ? data.sessionId : undefined;
      if (!sessionId) {
        ws.send(JSON.stringify({ type: 'screenshot', sessionId: null as string | null, error: 'No session selected' }));
        return;
      }
      this.wsServer.sendToSession(sessionId, { type: 'screenshot', format: 'jpeg' }).then((result) => {
        const screenshotResult = result as { format: string; dataUrl: string };
        ws.send(JSON.stringify({
          type: 'screenshot',
          sessionId,
          format: screenshotResult.format,
          dataUrl: screenshotResult.dataUrl,
        }));
      }).catch((err) => {
        ws.send(JSON.stringify({ type: 'screenshot', sessionId, error: err instanceof Error ? err.message : String(err) }));
      });
      return;
    }

    if (data.type === 'setActiveSession') {
      const sessionId = typeof data.sessionId === 'string' ? data.sessionId : undefined;
      if (sessionId) {
        sessionStore.setActiveSession(sessionId);
      }
      return;
    }
  }

  /** Broadcast a message to all connected remote clients */
  broadcast(data: unknown): void {
    const message = JSON.stringify(data);
    for (const client of this.remoteClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  /** Stop the server */
  stop(): void {
    this.unsubscribeSessions?.();
    for (const client of this.remoteClients) {
      client.close();
    }
    this.remoteClients.clear();
    this.wss?.close();
    this.httpServer?.close();
  }
}
