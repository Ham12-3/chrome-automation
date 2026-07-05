import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { WsServer } from './ws/wsServer.js';
import { RemoteHttpServer } from './remote/httpServer.js';
import { createMcpServer } from './mcp/server.js';
import { loadConfig } from './config.js';
import { initAuditLogger } from './safety/audit.js';

async function main() {
  const config = loadConfig();
  initAuditLogger(config.auditLogPath);

  if (config.enableMcpStdio) {
    console.log = console.error.bind(console);
    console.info = console.error.bind(console);
  }

  console.log('Browser Automation MCP Server v0.1.0');
  console.log(`[Config] Browser bridge: ws://${config.host}:${config.wsPort}`);
  console.log(`[Config] Remote control: ${config.enableRemoteControl ? `http://${config.host}:${config.httpPort}` : 'disabled'}`);
  console.log(`[Config] MCP stdio: ${config.enableMcpStdio ? 'enabled' : 'disabled'}`);
  console.log(`[Config] Computer use fallback: ${config.enableComputerUse ? 'enabled' : 'disabled'}`);
  console.log(`[Config] Dangerous JS evaluation: ${config.enableDangerousEval ? 'enabled' : 'disabled'}`);

  const wsServer = new WsServer(config);
  wsServer.start();

  const remoteServer = new RemoteHttpServer(config, wsServer);
  if (config.enableRemoteControl) {
    remoteServer.start();
  }

  if (config.enableMcpStdio) {
    console.log('[MCP] Starting MCP server over stdio...');
    serveStdio(() => createMcpServer(wsServer, config));
  }

  const shutdown = () => {
    console.log('\nShutting down...');
    wsServer.stop();
    remoteServer.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
