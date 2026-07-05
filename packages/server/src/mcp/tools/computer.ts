import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { ServerConfig } from '@chrome-automation/shared';
import { automationSafety } from '../../safety/state.js';
import { getAuditLogger } from '../../safety/audit.js';

const execFileAsync = promisify(execFile);

async function callOpenComputerUse(tool: string, args: Record<string, unknown> = {}): Promise<unknown> {
  try {
    const { stdout } = await execFileAsync('open-computer-use', [
      'call',
      tool,
      '--args',
      JSON.stringify(args),
    ], {
      timeout: 30_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 10,
    });

    const trimmed = stdout.trim();
    if (!trimmed) return { ok: true };

    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Open Computer Use is unavailable or failed (${message}). Install it with "npm install -g open-computer-use" and verify "open-computer-use call list_apps".`,
    );
  }
}

function assertComputerUseEnabled(config: ServerConfig): void {
  if (!config.enableComputerUse) {
    throw new Error('Computer-use fallback is disabled. Set enableComputerUse in automation.config.json or ENABLE_COMPUTER_USE=true to enable it locally.');
  }
  automationSafety.assertCanRun();
}

function jsonToolResult(data: unknown) {
  return {
    content: [{
      type: 'text' as const,
      text: typeof data === 'string' ? data : JSON.stringify(data),
    }],
  };
}

async function callComputerTool(config: ServerConfig, tool: string, args: Record<string, unknown> = {}) {
  assertComputerUseEnabled(config);
  try {
    const result = await callOpenComputerUse(tool, args);
    getAuditLogger().log({ kind: 'computer_command', action: tool, ok: true, details: args });
    return jsonToolResult(result);
  } catch (err) {
    getAuditLogger().log({ kind: 'computer_command', action: tool, ok: false, error: err instanceof Error ? err.message : String(err), details: args });
    throw err;
  }
}

export function registerComputerTools(server: McpServer, config: ServerConfig) {
  server.registerTool(
    'computer_list_apps',
    {
      description: 'List desktop apps available to Open Computer Use',
      inputSchema: z.object({}),
    },
    async () => callComputerTool(config, 'list_apps'),
  );

  server.registerTool(
    'computer_get_app_state',
    {
      description: 'Get the accessible UI state for a desktop app',
      inputSchema: z.object({
        app: z.string().describe('App name returned by computer_list_apps'),
      }),
    },
    async ({ app }: { app: string }) => callComputerTool(config, 'get_app_state', { app }),
  );

  server.registerTool(
    'computer_click',
    {
      description: 'Click an app UI element by element_index from the latest app state',
      inputSchema: z.object({
        app: z.string().describe('App name returned by computer_list_apps'),
        element_index: z.string().describe('Element index from computer_get_app_state'),
      }),
    },
    async ({ app, element_index }: { app: string; element_index: string }) => (
      callComputerTool(config, 'click', { app, element_index })
    ),
  );

  server.registerTool(
    'computer_type_text',
    {
      description: 'Type text into the focused desktop app element',
      inputSchema: z.object({
        app: z.string().describe('App name returned by computer_list_apps'),
        text: z.string().describe('Text to type'),
      }),
    },
    async ({ app, text }: { app: string; text: string }) => callComputerTool(config, 'type_text', { app, text }),
  );

  server.registerTool(
    'computer_press_key',
    {
      description: 'Press a keyboard key in a desktop app',
      inputSchema: z.object({
        app: z.string().describe('App name returned by computer_list_apps'),
        key: z.string().describe('Key to press, for example Enter, Tab, or Escape'),
      }),
    },
    async ({ app, key }: { app: string; key: string }) => callComputerTool(config, 'press_key', { app, key }),
  );

  server.registerTool(
    'computer_set_value',
    {
      description: 'Set the value of an editable desktop app element',
      inputSchema: z.object({
        app: z.string().describe('App name returned by computer_list_apps'),
        element_index: z.string().describe('Element index from computer_get_app_state'),
        value: z.string().describe('Value to set'),
      }),
    },
    async ({ app, element_index, value }: { app: string; element_index: string; value: string }) => (
      callComputerTool(config, 'set_value', { app, element_index, value })
    ),
  );

  server.registerTool(
    'get_active_window',
    {
      description: 'List desktop apps and top-level windows visible to Open Computer Use',
      inputSchema: z.object({}),
    },
    async () => callComputerTool(config, 'list_apps'),
  );

  server.registerTool(
    'type_on_desktop',
    {
      description: 'Type text into the focused desktop app element',
      inputSchema: z.object({
        app: z.string().describe('App name returned by computer_list_apps'),
        text: z.string().describe('Text to type'),
      }),
    },
    async ({ app, text }: { app: string; text: string }) => callComputerTool(config, 'type_text', { app, text }),
  );

  server.registerTool(
    'press_hotkey',
    {
      description: 'Press a desktop key or hotkey through Open Computer Use',
      inputSchema: z.object({
        app: z.string().describe('App name returned by computer_list_apps'),
        key: z.string().describe('Key or hotkey to press'),
      }),
    },
    async ({ app, key }: { app: string; key: string }) => callComputerTool(config, 'press_key', { app, key }),
  );

  server.registerTool(
    'focus_browser_window',
    {
      description: 'Focus a known browser window by clicking an exposed browser UI element',
      inputSchema: z.object({
        app: z.string().describe('Browser app name, for example chrome, brave, or msedge'),
        element_index: z.string().optional().describe('Optional element index to click after reading app state'),
      }),
    },
    async ({ app, element_index }: { app: string; element_index?: string }) => (
      element_index
        ? callComputerTool(config, 'click', { app, element_index })
        : callComputerTool(config, 'get_app_state', { app })
    ),
  );
}
