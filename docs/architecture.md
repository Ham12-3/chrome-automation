# Architecture

Browser Automation Bridge is a local MCP system for controlling a browser that is already open on the user's laptop.

```text
AI MCP client
  -> local MCP server over stdio
  -> localhost WebSocket bridge
  -> browser extension background worker
  -> active browser tab content script
```

## Packages

- `packages/server`: MCP server, local WebSocket bridge, remote HTTP/WebSocket UI, audit logging, safety state.
- `packages/extension`: WXT browser extension with background worker, content script, and popup status UI.
- `packages/remote`: optional React remote control UI.
- `packages/shared`: shared protocol schemas and TypeScript types.

## Main Control Path

The primary automation path is extension-based. The server sends a typed command to the connected extension, the background worker routes it to the active tab or browser API, and the content script performs page-level inspection or interaction.

This avoids launching a fresh browser profile and allows automation to work with the user's existing browser sessions, cookies, and authentication state without reading or exporting those secrets.

## Optional Desktop Fallback

Open Computer Use can be enabled with `enableComputerUse` or `ENABLE_COMPUTER_USE=true`. It is intended for cases where browser-level control cannot reach an operating-system dialog or browser chrome UI. It is disabled by default.

## Local Defaults

The default config binds both local servers to `127.0.0.1`:

- Browser extension WebSocket: `ws://127.0.0.1:7890`
- Remote control HTTP/WebSocket: `http://127.0.0.1:3456`

Settings live in `automation.config.json` and can be overridden with environment variables.
