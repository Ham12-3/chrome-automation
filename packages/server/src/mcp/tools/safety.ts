import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { automationSafety } from '../../safety/state.js';
import { getAuditLogger } from '../../safety/audit.js';

export function registerSafetyTools(server: McpServer) {
  server.registerTool(
    'automation_status',
    {
      description: 'Get automation pause and kill-switch status',
      inputSchema: z.object({}),
    },
    async () => ({
      content: [{ type: 'text' as const, text: JSON.stringify(automationSafety.getStatus()) }],
    }),
  );

  server.registerTool(
    'automation_pause',
    {
      description: 'Pause browser and desktop automation until automation_resume is called',
      inputSchema: z.object({}),
    },
    async () => {
      automationSafety.pause();
      getAuditLogger().log({ kind: 'safety', action: 'pause', ok: true });
      return { content: [{ type: 'text' as const, text: 'Automation paused.' }] };
    },
  );

  server.registerTool(
    'automation_resume',
    {
      description: 'Resume automation after a pause',
      inputSchema: z.object({}),
    },
    async () => {
      automationSafety.resume();
      getAuditLogger().log({ kind: 'safety', action: 'resume', ok: true });
      return { content: [{ type: 'text' as const, text: 'Automation resumed.' }] };
    },
  );

  server.registerTool(
    'automation_kill_switch',
    {
      description: 'Stop all further automation until the server is restarted',
      inputSchema: z.object({
        confirm: z.boolean().describe('Must be true to activate the kill switch'),
      }),
    },
    async ({ confirm }: { confirm: boolean }) => {
      if (!confirm) {
        return { content: [{ type: 'text' as const, text: 'Kill switch not activated; confirm must be true.' }], isError: true };
      }
      automationSafety.kill();
      getAuditLogger().log({ kind: 'safety', action: 'kill_switch', ok: true });
      return { content: [{ type: 'text' as const, text: 'Kill switch activated. Restart the server to automate again.' }] };
    },
  );
}
