import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { WsServer } from '../../ws/wsServer.js';
import type { SessionStore } from '../../session/store.js';
import type { ServerConfig } from '@chrome-automation/shared';

export function registerPageTools(
  server: McpServer,
  wsServer: WsServer,
  sessionStore: SessionStore,
  config: ServerConfig,
) {
  const getTarget = (sessionId?: string) => {
    if (sessionId) return sessionId;
    const active = sessionStore.getActiveSession();
    if (!active) throw new Error('No browser connected. Connect a browser extension first.');
    return active.id;
  };

  // ─── browser_get_dom ────────────────────────────────────────────────
  server.registerTool(
    'browser_get_dom',
    {
      description: 'Get the DOM (HTML) of the current page, optionally filtered by a CSS selector',
      inputSchema: z.object({
        selector: z.string().optional().describe('CSS selector to filter (returns full body HTML if omitted)'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ selector, sessionId }: { selector?: string; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'getDOM', selector });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'get_page_html',
    {
      description: 'Get visible page HTML, optionally filtered by selector',
      inputSchema: z.object({
        selector: z.string().optional().describe('CSS selector to filter'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ selector, sessionId }: { selector?: string; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'getDOM', selector });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'get_page_text',
    {
      description: 'Extract visible text from the current page',
      inputSchema: z.object({
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ sessionId }: { sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'getPageText' });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'get_interactive_elements',
    {
      description: 'Get links, buttons, inputs, and other interactive elements with labels, selectors, roles, and bounds',
      inputSchema: z.object({
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ sessionId }: { sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'getInteractiveElements' });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // ─── browser_execute_js ─────────────────────────────────────────────
  server.registerTool(
    'browser_execute_js',
    {
      description: 'Execute JavaScript code on the current page and return the result',
      inputSchema: z.object({
        code: z.string().describe('JavaScript code to execute on the page'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ code, sessionId }: { code: string; sessionId?: string }) => {
      if (!config.enableDangerousEval) {
        return {
          content: [{
            type: 'text' as const,
            text: 'browser_execute_js is disabled by default. Set enableDangerousEval or ENABLE_DANGEROUS_EVAL=true only for trusted local debugging.',
          }],
          isError: true,
        };
      }
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'executeJS', code });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'browser_wait_for_selector',
    {
      description: 'Wait until an element appears on the current page',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector to wait for'),
        timeoutMs: z.number().int().positive().optional().describe('Timeout in milliseconds'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ selector, timeoutMs, sessionId }: { selector: string; timeoutMs?: number; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'waitForSelector', selector, timeoutMs });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'wait_for_selector',
    {
      description: 'Wait until an element appears on the current page',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector to wait for'),
        timeoutMs: z.number().int().positive().optional().describe('Timeout in milliseconds'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ selector, timeoutMs, sessionId }: { selector: string; timeoutMs?: number; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'waitForSelector', selector, timeoutMs });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'wait_for_text',
    {
      description: 'Wait until visible page text appears',
      inputSchema: z.object({
        text: z.string().describe('Text to wait for'),
        timeoutMs: z.number().int().positive().optional().describe('Timeout in milliseconds'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ text, timeoutMs, sessionId }: { text: string; timeoutMs?: number; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'waitForText', text, timeoutMs });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
