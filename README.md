# Browser Automation Bridge

AI-driven browser automation with an MCP server, cross-browser extension, remote control UI, and optional Open Computer Use fallback tools.

## Architecture

```
Phone (Remote Web App) ──HTTP/WS──▶ MCP Server ◄──stdio/MCP── AI Model (Claude)
                                       │
                                       │ WebSocket (ws://localhost:7890)
                                       ▼
                               Browser Extension (Chrome/Edge/Brave/Firefox builds)
                                       │
                                       ▼
                               Content Scripts → Page DOM
```

## Packages

| Package | Description |
|---------|-------------|
| `packages/shared` | Shared types, protocol definitions, utilities |
| `packages/server` | MCP server + WebSocket server + HTTP API |
| `packages/extension` | Browser extension (WXT + Manifest V3, Chrome/Edge/Brave plus Firefox build script) |
| `packages/remote` | Remote control web app (React + Vite + Tailwind) |

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Start the MCP server

```bash
npm run dev -w @chrome-automation/server
```

This starts:
- MCP server over stdio (for AI model connections)
- WebSocket server on `ws://localhost:7890` (for browser extensions)
- HTTP + WebSocket server on `http://localhost:3456` (for remote control)

### 3. Load the browser extension

```bash
npm run dev -w @chrome-automation/extension
```

Then in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `packages/extension/.output/chrome-mv3`

Chromium browsers such as Edge and Brave can load the same MV3 output. For Firefox development builds, run:

```bash
npm run dev:firefox -w @chrome-automation/extension
```

### 4. Start the remote control web app

```bash
npm run dev -w @chrome-automation/remote
```

Open `http://localhost:5173` on your phone or desktop.

### 5. Connect Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "chrome-automation": {
      "command": "npx",
      "args": ["tsx", "packages/server/src/index.ts"],
      "cwd": "/path/to/chrome-automation"
    }
  }
}
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `browser_status` | Get connected browser and bridge health |
| `list_connected_browsers` | List connected browser extension sessions |
| `list_tabs` / `browser_list_tabs` | List all open tabs |
| `get_active_tab` | Read the active tab |
| `open_new_tab` | Open a new browser tab |
| `switch_tab` / `browser_switch_tab` | Switch to a specific tab |
| `close_tab` / `browser_close_tab` | Close a tab |
| `browser_navigate` | Navigate to a URL |
| `navigate` | Navigate to a URL |
| `click` / `browser_click` | Click by selector, visible text, or viewport coordinates |
| `double_click` | Double-click an element |
| `hover` | Hover an element |
| `type_text` / `browser_type` | Type into a selector or focused element |
| `press_key` / `browser_press_key` | Press keys such as Enter, Escape, or Tab |
| `scroll` / `browser_scroll` | Scroll the page or a scrollable element |
| `select_option` | Select an option in a `<select>` |
| `upload_file` | Upload an explicitly provided local file |
| `wait_for_selector` / `browser_wait_for_selector` | Wait for an element to appear |
| `wait_for_text` | Wait for page text to appear |
| `get_page_text` | Extract visible page text |
| `get_page_html` / `browser_get_dom` | Extract page HTML |
| `get_interactive_elements` | Extract links, buttons, inputs, selectors, labels, roles, and bounds |
| `take_screenshot` / `browser_screenshot` | Take a browser viewport screenshot |
| `go_back`, `go_forward`, `reload` | Browser history/navigation controls |
| `browser_search` | Search the web in the active browser tab |
| `browser_get_bookmarks` | Get all bookmarks |
| `browser_get_history` | Get browsing history |
| `browser_list_sessions` | List connected browser sessions |
| `browser_select_session` | Select which browser to control |
| `automation_status`, `automation_pause`, `automation_resume`, `automation_kill_switch` | Safety controls |

## Connection Health

The extension popup now shows:

- Live connection state (`connecting`, `connected`, `reconnecting`, `disconnected`, or `error`)
- Browser name/version and extension version
- WebSocket server URL
- Session ID
- Last heartbeat and next reconnect time
- The most recent connection error

The server stores the same metadata for remote clients and MCP session listing, so stale extension state is easier to diagnose.

## Computer Use Fallback

The MCP server also exposes optional desktop automation tools backed by Open Computer Use:

| Tool | Description |
|------|-------------|
| `computer_list_apps` | List desktop apps visible to Open Computer Use |
| `computer_get_app_state` | Inspect an app's accessible UI tree |
| `computer_click` | Click an element by `element_index` |
| `computer_type_text` | Type into the focused app element |
| `computer_press_key` | Press a key in a desktop app |
| `computer_set_value` | Set an editable element value |

Computer-use fallback is disabled by default. Enable it only for local desktop fallback:

```json
{
  "enableComputerUse": true
}
```

Install or update the fallback CLI with:

```bash
npm install -g open-computer-use
open-computer-use call list_apps
```

Use browser tools first for normal web workflows. Use `computer_*` tools when a site blocks DOM automation, a browser dialog is outside the page, file upload/download UI is involved, or an authenticated workflow depends on the user's already-open desktop browser session.

## Local Demo

Start the server and open the demo page:

```bash
npm run dev -w @chrome-automation/server
```

Then navigate the connected browser to:

```text
http://127.0.0.1:3456/demo
```

Basic MCP test flow:

1. `browser_status`
2. `navigate` to `http://127.0.0.1:3456/demo`
3. `type_text` with selector `#name-input`
4. `type_text` with selector `#message-input`
5. `select_option` with selector `#choice-select` and value `alpha`
6. `click` with selector `#submit-button`
7. `get_page_text`
8. `take_screenshot`

## Config

Settings live in `automation.config.json`. By default, the bridge is local-only:

```json
{
  "host": "127.0.0.1",
  "wsPort": 7890,
  "httpPort": 3456,
  "enableMcpStdio": true,
  "enableComputerUse": false,
  "enableDangerousEval": false
}
```

`browser_execute_js` is disabled unless `enableDangerousEval` or `ENABLE_DANGEROUS_EVAL=true` is set.

## Configuration

Environment variables (or defaults in `packages/shared/src/types.ts`):

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_PORT` | `7890` | WebSocket port for browser extensions |
| `HTTP_PORT` | `3456` | HTTP port for remote control |
| `AUTH_TOKEN` | `chrome-automation-token-change-me` | Auth token for extension handshake |
| `JWT_SECRET` | `change-me-to-a-random-secret` | JWT signing secret |
| `REMOTE_PASSWORD` | `admin` | Password for remote web app login |

## Security

- WebSocket server binds to `localhost` only
- Browser extension requires auth token for handshake
- Remote web app requires password-based JWT login
- Content scripts sanitize selectors before DOM access
