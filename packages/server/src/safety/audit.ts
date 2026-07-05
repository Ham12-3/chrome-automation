import fs from 'node:fs';
import path from 'node:path';

export interface AuditEvent {
  kind: 'browser_command' | 'computer_command' | 'safety';
  action: string;
  sessionId?: string;
  ok?: boolean;
  error?: string;
  details?: unknown;
}

export class AuditLogger {
  constructor(private readonly logPath: string) {}

  log(event: AuditEvent): void {
    const absolute = path.resolve(process.cwd(), this.logPath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.appendFileSync(absolute, `${JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
    })}\n`);
  }
}

let auditLogger: AuditLogger | null = null;

export function initAuditLogger(logPath: string): AuditLogger {
  auditLogger = new AuditLogger(logPath);
  return auditLogger;
}

export function getAuditLogger(): AuditLogger {
  if (!auditLogger) {
    auditLogger = new AuditLogger('logs/audit.jsonl');
  }
  return auditLogger;
}
