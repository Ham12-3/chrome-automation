import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { WsServer } from '../../ws/wsServer.js';
import type { SessionStore } from '../../session/store.js';
import type { ServerConfig } from '@chrome-automation/shared';
import fs from 'node:fs/promises';
import path from 'node:path';

export function registerBrowserTools(
  server: McpServer,
  wsServer: WsServer,
  sessionStore: SessionStore,
  _config: ServerConfig,
) {
  const getTarget = (sessionId?: string) => {
    if (sessionId) return sessionId;
    const active = sessionStore.getActiveSession();
    if (!active) throw new Error('No browser connected. Connect a browser extension first.');
    return active.id;
  };

  // ─── browser_navigate ───────────────────────────────────────────────
  server.registerTool(
    'browser_navigate',
    {
      description: 'Navigate the browser to a URL',
      inputSchema: z.object({
        url: z.string().describe('The URL to navigate to'),
        sessionId: z.string().optional().describe('Browser session ID (uses active if omitted)'),
      }),
    },
    async ({ url, sessionId }: { url: string; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'navigate', url });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'navigate',
    {
      description: 'Navigate the active browser tab to a URL',
      inputSchema: z.object({
        url: z.string().url().describe('The URL to navigate to'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ url, sessionId }: { url: string; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'navigate', url });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // ─── browser_click ──────────────────────────────────────────────────
  server.registerTool(
    'browser_click',
    {
      description: 'Click an element on the page by CSS selector',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector of the element to click'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ selector, sessionId }: { selector: string; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'click', selector });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'click',
    {
      description: 'Click an element by CSS selector, visible text, or viewport coordinates',
      inputSchema: z.object({
        selector: z.string().optional().describe('CSS selector to click'),
        text: z.string().optional().describe('Visible text to click'),
        exact: z.boolean().optional().describe('Require exact text match'),
        x: z.number().optional().describe('Viewport x coordinate'),
        y: z.number().optional().describe('Viewport y coordinate'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ selector, text, exact, x, y, sessionId }: { selector?: string; text?: string; exact?: boolean; x?: number; y?: number; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const command = selector
        ? { type: 'click' as const, selector }
        : text
          ? { type: 'clickText' as const, text, exact }
          : typeof x === 'number' && typeof y === 'number'
            ? { type: 'clickCoordinates' as const, x, y }
            : null;
      if (!command) throw new Error('Provide selector, text, or x/y coordinates.');
      const result = await wsServer.sendToSession(target, command);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'double_click',
    {
      description: 'Double-click an element by CSS selector',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector of the element to double-click'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ selector, sessionId }: { selector: string; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'doubleClick', selector });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'hover',
    {
      description: 'Hover an element by CSS selector',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector of the element to hover'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ selector, sessionId }: { selector: string; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'hover', selector });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // ─── browser_type ───────────────────────────────────────────────────
  server.registerTool(
    'browser_type',
    {
      description: 'Type text into an input element',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector of the input element'),
        text: z.string().describe('Text to type'),
        clear: z.boolean().optional().describe('Clear the field before typing'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ selector, text, clear, sessionId }: { selector: string; text: string; clear?: boolean; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'type', selector, text, clear });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'type_text',
    {
      description: 'Type text into a selector or the currently focused element',
      inputSchema: z.object({
        text: z.string().describe('Text to type'),
        selector: z.string().optional().describe('Optional CSS selector of the input element'),
        clear: z.boolean().optional().describe('Clear the field before typing'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ selector, text, clear, sessionId }: { selector?: string; text: string; clear?: boolean; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, selector
        ? { type: 'type', selector, text, clear }
        : { type: 'typeFocused', text });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'browser_press_key',
    {
      description: 'Press a keyboard key on the active page or a specific element',
      inputSchema: z.object({
        key: z.string().describe('Key value, for example Enter, Escape, Tab, or a single character'),
        selector: z.string().optional().describe('Optional CSS selector to focus before pressing the key'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ key, selector, sessionId }: { key: string; selector?: string; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'pressKey', key, selector });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'press_key',
    {
      description: 'Press a keyboard key on the active page or a selected element',
      inputSchema: z.object({
        key: z.string().describe('Key value, for example Enter, Escape, Tab, or a single character'),
        selector: z.string().optional().describe('Optional CSS selector to focus before pressing the key'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ key, selector, sessionId }: { key: string; selector?: string; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'pressKey', key, selector });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'browser_scroll',
    {
      description: 'Scroll the page or a scrollable element',
      inputSchema: z.object({
        selector: z.string().optional().describe('Optional CSS selector for a scrollable element'),
        x: z.number().optional().describe('Horizontal scroll delta'),
        y: z.number().optional().describe('Vertical scroll delta'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ selector, x, y, sessionId }: { selector?: string; x?: number; y?: number; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'scroll', selector, x, y });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'scroll',
    {
      description: 'Scroll the page or a scrollable element',
      inputSchema: z.object({
        selector: z.string().optional().describe('Optional CSS selector for a scrollable element'),
        x: z.number().optional().describe('Horizontal scroll delta'),
        y: z.number().optional().describe('Vertical scroll delta'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ selector, x, y, sessionId }: { selector?: string; x?: number; y?: number; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'scroll', selector, x, y });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'select_option',
    {
      description: 'Select an option in a select element',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector of the select element'),
        value: z.string().describe('Option value to select'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ selector, value, sessionId }: { selector: string; value: string; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'selectOption', selector, value });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'upload_file',
    {
      description: 'Upload an explicitly provided local file to a file input',
      inputSchema: z.object({
        selector: z.string().describe('CSS selector of the file input'),
        filePath: z.string().describe('Absolute or project-relative local file path'),
        mimeType: z.string().optional().describe('Optional MIME type'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ selector, filePath, mimeType, sessionId }: { selector: string; filePath: string; mimeType?: string; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const absolute = path.resolve(process.cwd(), filePath);
      const stat = await fs.stat(absolute);
      if (!stat.isFile()) throw new Error(`Not a file: ${absolute}`);
      const data = await fs.readFile(absolute);
      const result = await wsServer.sendToSession(target, {
        type: 'uploadFile',
        selector,
        fileName: path.basename(absolute),
        mimeType: mimeType ?? 'application/octet-stream',
        dataBase64: data.toString('base64'),
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'browser_search',
    {
      description: 'Search the web in the active browser tab using a selected search engine',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        engine: z.enum(['google', 'bing', 'duckduckgo']).optional().describe('Search engine'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ query, engine, sessionId }: { query: string; engine?: 'google' | 'bing' | 'duckduckgo'; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'search', query, engine });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  // ─── browser_screenshot ──────────────────────────────────────────────
  server.registerTool(
    'browser_screenshot',
    {
      description: 'Take a screenshot of the current page',
      inputSchema: z.object({
        format: z.enum(['png', 'jpeg']).optional().describe('Image format (default: png)'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ format, sessionId }: { format?: 'png' | 'jpeg'; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'screenshot', format });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'take_screenshot',
    {
      description: 'Take a screenshot of the current browser viewport',
      inputSchema: z.object({
        format: z.enum(['png', 'jpeg']).optional().describe('Image format (default: png)'),
        sessionId: z.string().optional().describe('Browser session ID'),
      }),
    },
    async ({ format, sessionId }: { format?: 'png' | 'jpeg'; sessionId?: string }) => {
      const target = getTarget(sessionId);
      const result = await wsServer.sendToSession(target, { type: 'screenshot', format });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
