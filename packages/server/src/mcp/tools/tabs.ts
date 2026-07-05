import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { WsServer } from '../../ws/wsServer.js';
import type { SessionStore } from '../../session/store.js';

export function registerTabTools(
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

  // ─── browser_list_tabs ──────────────────────────────────────────────
  server.registerTool(
    'browser_list_tabs',
    {
      description: 'List all open tabs in the browser',
      inputSchema: z.object({
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ sessionId }: { sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'getTabs' });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'list_tabs',
    {
      description: 'List all open tabs in the browser',
      inputSchema: z.object({
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ sessionId }: { sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'getTabs' });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'get_active_tab',
    {
      description: 'Get the currently active browser tab',
      inputSchema: z.object({
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ sessionId }: { sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'getActiveTab' });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'open_new_tab',
    {
      description: 'Open a new browser tab',
      inputSchema: z.object({
        url: z.string().url().optional().describe('Optional URL for the new tab'),
        active: z.boolean().optional().describe('Whether to make the new tab active'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ url, active, sessionId }: { url?: string; active?: boolean; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'openNewTab', url, active });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // ─── browser_switch_tab ─────────────────────────────────────────────
  server.registerTool(
    'browser_switch_tab',
    {
      description: 'Switch to a specific tab by its ID',
      inputSchema: z.object({
        tabId: z.number().int().positive().describe('The tab ID to switch to'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ tabId, sessionId }: { tabId: number; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'switchTab', tabId });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'switch_tab',
    {
      description: 'Switch to a specific tab by its ID',
      inputSchema: z.object({
        tabId: z.number().int().positive().describe('The tab ID to switch to'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ tabId, sessionId }: { tabId: number; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'switchTab', tabId });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // ─── browser_close_tab ──────────────────────────────────────────────
  server.registerTool(
    'browser_close_tab',
    {
      description: 'Close a specific tab by its ID',
      inputSchema: z.object({
        tabId: z.number().int().positive().describe('The tab ID to close'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ tabId, sessionId }: { tabId: number; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'closeTab', tabId });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'close_tab',
    {
      description: 'Close a specific tab by its ID',
      inputSchema: z.object({
        tabId: z.number().int().positive().describe('The tab ID to close'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ tabId, sessionId }: { tabId: number; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'closeTab', tabId });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  for (const [name, commandType] of [
    ['go_back', 'goBack'],
    ['go_forward', 'goForward'],
    ['reload', 'reload'],
  ] as const) {
    server.registerTool(
      name,
      {
        description: `${name.replace('_', ' ')} in the active browser tab`,
        inputSchema: z.object({
          sessionId: z.string().optional().describe('Browser session ID'),
        }),
      },
      async ({ sessionId }: { sessionId?: string }) => {
        const target = getTarget(sessionId);
        const result = await wsServer.sendToSession(target, { type: commandType });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
      },
    );
  }
}
