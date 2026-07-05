import { WebSocketServer, WebSocket } from 'ws';
import { HandshakeSchema, WsResultSchema, WsErrorSchema, WsEventSchema } from '@chrome-automation/shared';
import { generateSessionId } from '@chrome-automation/shared';
import { sessionStore } from '../session/store.js';
import { BrowserConnection } from './connection.js';
import type { ServerConfig } from '@chrome-automation/shared';
import { automationSafety } from '../safety/state.js';
import { getAuditLogger } from '../safety/audit.js';

/**
 * WebSocket server that browser extensions connect to.
 * Manages connections and routes commands to the right browser.
 */
export class WsServer {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, BrowserConnection> = new Map();
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  /** Start the WebSocket server */
  start(): void {
    this.wss = new WebSocketServer({ port: this.config.wsPort, host: this.config.host });

    this.wss.on('error', (err) => {
      console.error(`[WS] Failed to start WebSocket server on port ${this.config.wsPort}: ${err.message}`);
      process.exit(1);
    });

    this.wss.on('listening', () => {
      console.log(`[WS] WebSocket server listening on ws://${this.config.host}:${this.config.wsPort}`);
    });

    this.wss.on('connection', (ws) => {
      this.handleConnection(ws);
    });

    // Heartbeat to detect dead connections
    const heartbeat = setInterval(() => {
      this.wss?.clients.forEach((ws) => {
        const client = ws as WebSocket & { isAlive?: boolean };
        if (client.isAlive === false) {
          return ws.terminate();
        }
        client.isAlive = false;
        ws.ping();
      });
    }, 15000);

    this.wss.on('close', () => clearInterval(heartbeat));
  }

  /** Handle a new WebSocket connection */
  private handleConnection(ws: WebSocket): void {
    let sessionId: string | null = null;
    let authenticated = false;

    (ws as WebSocket & { isAlive?: boolean }).isAlive = true;

    ws.on('pong', () => {
      (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
      if (sessionId) {
        sessionStore.heartbeat(sessionId);
      }
    });

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        // First message must be a handshake
        if (!authenticated) {
          const handshake = HandshakeSchema.safeParse(data);
          if (!handshake.success) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid handshake' }));
            ws.close();
            return;
          }

          if (handshake.data.token !== this.config.authToken) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid auth token' }));
            ws.close();
            return;
          }

          sessionId = generateSessionId();
          authenticated = true;

          sessionStore.addSession(sessionId, handshake.data.browserName, {
            browserVersion: handshake.data.browserVersion,
            extensionVersion: handshake.data.extensionVersion,
            platform: handshake.data.platform,
            userAgent: handshake.data.userAgent,
          });
          const conn = new BrowserConnection(sessionId, ws);
          this.connections.set(sessionId, conn);

          ws.send(JSON.stringify({ type: 'handshake_ack', sessionId, serverTime: Date.now() }));
          console.log(`[WS] Browser connected: ${handshake.data.browserName} (${sessionId})`);
          return;
        }

        if (data.type === 'ping' && sessionId) {
          sessionStore.heartbeat(sessionId);
          ws.send(JSON.stringify({ type: 'pong', serverTime: Date.now() }));
          return;
        }

        // Handle result messages from browser
        const result = WsResultSchema.safeParse(data);
        if (result.success && sessionId) {
          const conn = this.connections.get(sessionId);
          conn?.handleResponse(result.data.requestId, result.data.data);
          return;
        }

        // Handle error messages from browser
        const error = WsErrorSchema.safeParse(data);
        if (error.success && sessionId) {
          const conn = this.connections.get(sessionId);
          conn?.handleError(error.data.requestId, error.data.message);
          return;
        }

        // Handle events from browser
        const event = WsEventSchema.safeParse(data);
        if (event.success && sessionId) {
          this.handleBrowserEvent(sessionId, event.data.event, event.data.data);
          return;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      if (sessionId) {
        const conn = this.connections.get(sessionId);
        conn?.destroy();
        this.connections.delete(sessionId);
        sessionStore.removeSession(sessionId);
        console.log(`[WS] Browser disconnected: ${sessionId}`);
      }
    });

    ws.on('error', (err) => {
      console.error(`[WS] Connection error:`, err.message);
    });
  }

  /** Handle unsolicited events from the browser */
  private handleBrowserEvent(sessionId: string, event: string, data: unknown): void {
    console.log(`[WS] Event from ${sessionId}: ${event}`, data);

    if (event === 'tabCreated' || event === 'tabClosed' || event === 'tabUpdated') {
      // Refresh tab list for this session
      const conn = this.connections.get(sessionId);
      if (conn) {
        conn.sendCommand({ type: 'getTabs' }).then((tabsData) => {
          const tabs = tabsData as { tabs: Array<{ id: number; url: string; title: string; active: boolean }>; activeTabId: number };
          sessionStore.updateTabs(sessionId, tabs.tabs, tabs.activeTabId);
        }).catch(() => {
          // Ignore errors from tab refresh
        });
      }
    }
  }

  /** Send a command to a specific browser session */
  async sendToSession(sessionId: string, command: Parameters<BrowserConnection['sendCommand']>[0]): Promise<unknown> {
    automationSafety.assertCanRun();
    const conn = this.connections.get(sessionId);
    if (!conn) {
      throw new Error(`No browser connected with session ID: ${sessionId}`);
    }
    if (!conn.isConnected) {
      throw new Error(`Browser session ${sessionId} is disconnected`);
    }
    try {
      const result = await conn.sendCommand(command);
      getAuditLogger().log({
        kind: 'browser_command',
        action: command.type,
        sessionId,
        ok: true,
        details: sanitizeAuditDetails(command),
      });
      return result;
    } catch (err) {
      getAuditLogger().log({
        kind: 'browser_command',
        action: command.type,
        sessionId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        details: sanitizeAuditDetails(command),
      });
      throw err;
    }
  }

  /** Send a command to the active browser session */
  async sendToActive(command: Parameters<BrowserConnection['sendCommand']>[0]): Promise<unknown> {
    const active = sessionStore.getActiveSession();
    if (!active) {
      throw new Error('No active browser session');
    }
    return this.sendToSession(active.id, command);
  }

  /** Get a connection by session ID */
  getConnection(sessionId: string): BrowserConnection | undefined {
    return this.connections.get(sessionId);
  }

  /** Stop the WebSocket server */
  stop(): void {
    for (const conn of this.connections.values()) {
      conn.destroy();
    }
    this.connections.clear();
    this.wss?.close();
  }
}

function sanitizeAuditDetails(command: Parameters<BrowserConnection['sendCommand']>[0]): Record<string, unknown> {
  const details = { ...command } as Record<string, unknown>;
  if (typeof details.text === 'string' && details.text.length > 120) {
    details.text = `${details.text.slice(0, 120)}...`;
  }
  if ('dataBase64' in details) {
    details.dataBase64 = '[base64 file omitted]';
  }
  return details;
}
