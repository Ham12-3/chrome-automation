import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_CONFIG, type ServerConfig } from '@chrome-automation/shared';

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function loadConfig(): ServerConfig {
  const configPath = process.env.AUTOMATION_CONFIG ?? path.resolve(process.cwd(), 'automation.config.json');
  let fileConfig: Partial<ServerConfig> = {};

  if (fs.existsSync(configPath)) {
    fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Partial<ServerConfig>;
  }

  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    wsPort: parseInt(process.env.WS_PORT ?? String(fileConfig.wsPort ?? DEFAULT_CONFIG.wsPort), 10),
    httpPort: parseInt(process.env.HTTP_PORT ?? String(fileConfig.httpPort ?? DEFAULT_CONFIG.httpPort), 10),
    host: process.env.HOST ?? fileConfig.host ?? DEFAULT_CONFIG.host,
    authToken: process.env.AUTH_TOKEN ?? fileConfig.authToken ?? DEFAULT_CONFIG.authToken,
    jwtSecret: process.env.JWT_SECRET ?? fileConfig.jwtSecret ?? DEFAULT_CONFIG.jwtSecret,
    remotePassword: process.env.REMOTE_PASSWORD ?? fileConfig.remotePassword ?? DEFAULT_CONFIG.remotePassword,
    enableRemoteControl: parseBool(process.env.ENABLE_REMOTE_CONTROL, fileConfig.enableRemoteControl ?? DEFAULT_CONFIG.enableRemoteControl),
    enableMcpStdio: parseBool(process.env.ENABLE_MCP_STDIO, fileConfig.enableMcpStdio ?? DEFAULT_CONFIG.enableMcpStdio),
    enableComputerUse: parseBool(process.env.ENABLE_COMPUTER_USE, fileConfig.enableComputerUse ?? DEFAULT_CONFIG.enableComputerUse),
    enableDangerousEval: parseBool(process.env.ENABLE_DANGEROUS_EVAL, fileConfig.enableDangerousEval ?? DEFAULT_CONFIG.enableDangerousEval),
    requireRiskConfirmation: parseBool(process.env.REQUIRE_RISK_CONFIRMATION, fileConfig.requireRiskConfirmation ?? DEFAULT_CONFIG.requireRiskConfirmation),
    auditLogPath: process.env.AUDIT_LOG_PATH ?? fileConfig.auditLogPath ?? DEFAULT_CONFIG.auditLogPath,
  };
}
