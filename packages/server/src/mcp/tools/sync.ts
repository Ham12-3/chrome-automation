import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { WsServer } from '../../ws/wsServer.js';
import type { SessionStore } from '../../session/store.js';

export function registerSyncTools(
  server: McpServer,
  wsServer: WsServer,
  sessionStore: SessionStore,
) {
  const getTarget = (sessionId?: string) => {
    if (sessionId) return sessionId;
    const active = sessionStore.getActiveSession();
    if (!active) throw new Error('No browser connected. Connect a browser extension first.');
    return active.id;
  };

  // ─── browser_get_bookmarks ──────────────────────────────────────────
  server.registerTool(
    'browser_get_bookmarks',
    {
      description: 'Get all bookmarks from the browser',
      inputSchema: z.object({
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ sessionId }: { sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'getBookmarks' });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // ─── browser_get_history ────────────────────────────────────────────
  server.registerTool(
    'browser_get_history',
    {
      description: 'Get browsing history from the browser',
      inputSchema: z.object({
        limit: z.number().int().positive().optional().describe('Max number of history items (default: 50)'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ limit, sessionId }: { limit?: number; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'getHistory', limit });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
