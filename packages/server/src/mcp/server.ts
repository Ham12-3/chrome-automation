import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { WsServer } from '../ws/wsServer.js';
import { sessionStore } from '../session/store.js';
import type { ServerConfig } from '@chrome-automation/shared';
import { registerBrowserTools } from './tools/browser.js';
import { registerPageTools } from './tools/page.js';
import { registerTabTools } from './tools/tabs.js';
import { registerSyncTools } from './tools/sync.js';
import { registerComputerTools } from './tools/computer.js';
import { registerSafetyTools } from './tools/safety.js';

/**
 * Create and configure the MCP server with all browser automation tools.
 */
export function createMcpServer(wsServer: WsServer, config: ServerConfig): McpServer {
  const server = new McpServer({
    name: 'chrome-automation',
    version: '0.1.0',
  });

  // Register all tool categories
  registerBrowserTools(server, wsServer, sessionStore, config);
  registerPageTools(server, wsServer, sessionStore, config);
  registerTabTools(server, wsServer, sessionStore);
  registerSyncTools(server, wsServer, sessionStore);
  registerComputerTools(server, config);
  registerSafetyTools(server);

  // ─── Session management tools ──────────────────────────────────────

  server.registerTool(
    'browser_status',
    {
      description: 'Get local browser bridge status, connected browsers, and active session',
      inputSchema: z.object({}),
    },
    async () => {
      const sessions = sessionStore.getAllSessions();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            connectedBrowserCount: sessions.length,
            activeSessionId: sessionStore.getActiveSession()?.id ?? null,
            sessions: sessions.map(s => ({
              id: s.id,
              name: s.name,
              connectionState: s.connectionState,
              lastHeartbeat: s.lastHeartbeat,
              tabCount: s.tabs.length,
              activeTabId: s.activeTabId,
              browserVersion: s.browserVersion,
              platform: s.platform,
            })),
          }),
        }],
      };
    },
  );

  server.registerTool(
    'browser_list_sessions',
    {
      description: 'List all connected browser sessions',
      inputSchema: z.object({}),
    },
    async () => {
      const sessions = sessionStore.getAllSessions();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            sessions: sessions.map(s => ({
              id: s.id,
              name: s.name,
              connectedAt: s.connectedAt,
              connectionState: s.connectionState,
              lastHeartbeat: s.lastHeartbeat,
              browserVersion: s.browserVersion,
              extensionVersion: s.extensionVersion,
              platform: s.platform,
              tabCount: s.tabs.length,
              activeTabId: s.activeTabId,
            })),
            activeSessionId: sessionStore.getActiveSession()?.id ?? null,
          }),
        }],
      };
    },
  );

  server.registerTool(
    'list_connected_browsers',
    {
      description: 'List connected browser extension sessions',
      inputSchema: z.object({}),
    },
    async () => {
      const sessions = sessionStore.getAllSessions();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            sessions: sessions.map(s => ({
              id: s.id,
              name: s.name,
              connectedAt: s.connectedAt,
              connectionState: s.connectionState,
              lastHeartbeat: s.lastHeartbeat,
              tabCount: s.tabs.length,
              activeTabId: s.activeTabId,
              browserVersion: s.browserVersion,
              extensionVersion: s.extensionVersion,
              platform: s.platform,
            })),
            activeSessionId: sessionStore.getActiveSession()?.id ?? null,
          }),
        }],
      };
    },
  );

  server.registerTool(
    'browser_select_session',
    {
      description: 'Select which connected browser to control',
      inputSchema: z.object({
        sessionId: z.string().describe('The browser session ID to make active'),
      }),
    },
    async ({ sessionId }: { sessionId: string }) => {
      const success = sessionStore.setActiveSession(sessionId);
      if (!success) {
        return { content: [{ type: 'text' as const, text: `Error: No browser found with session ID: ${sessionId}` }], isError: true };
      }
      const session = sessionStore.getSession(sessionId);
      return { content: [{ type: 'text' as const, text: `Active browser set to: ${session?.name} (${sessionId})` }] };
    },
  );

  return server;
}
