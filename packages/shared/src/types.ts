// ─── Browser Session ───────────────────────────────────────────────────────

export interface TabInfo {
  id: number;
  url: string;
  title: string;
  active: boolean;
}

export interface BrowserSession {
  id: string;
  name: string;
  browserVersion?: string;
  extensionVersion?: string;
  platform?: string;
  userAgent?: string;
  connectionState: 'connected' | 'stale' | 'disconnected';
  connectedAt: number;
  tabs: TabInfo[];
  activeTabId: number;
  lastHeartbeat: number;
  lastSeenAt: number;
  reconnectCount: number;
}

export interface ExtensionConnectionStatus {
  connected: boolean;
  state: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
  wsUrl: string;
  browserName: string;
  browserVersion?: string;
  extensionVersion?: string;
  platform?: string;
  sessionId: string | null;
  reconnectAttempt: number;
  nextReconnectAt: number | null;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  lastHeartbeatAt: number | null;
  lastError: string | null;
}

// ─── Server Configuration ──────────────────────────────────────────────────

export interface ServerConfig {
  wsPort: number;
  httpPort: number;
  host: string;
  allowedOrigins: string[];
  authToken: string;
  jwtSecret: string;
  remotePassword: string;
  enableRemoteControl: boolean;
  enableMcpStdio: boolean;
  enableComputerUse: boolean;
  enableDangerousEval: boolean;
  requireRiskConfirmation: boolean;
  auditLogPath: string;
}

export const DEFAULT_CONFIG: ServerConfig = {
  wsPort: 7890,
  httpPort: 3456,
  host: '127.0.0.1',
  allowedOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  authToken: 'chrome-automation-token-change-me',
  jwtSecret: 'change-me-to-a-random-secret',
  remotePassword: 'admin',
  enableRemoteControl: true,
  enableMcpStdio: true,
  enableComputerUse: false,
  enableDangerousEval: false,
  requireRiskConfirmation: true,
  auditLogPath: 'logs/audit.jsonl',
};

// ─── Tool Result Types ─────────────────────────────────────────────────────

export interface NavigateResult {
  url: string;
  title: string;
}

export interface ClickResult {
  selector: string;
  clicked: boolean;
}

export interface TypeResult {
  selector: string;
  text: string;
  clear?: boolean;
}

export interface ScreenshotResult {
  format: 'png' | 'jpeg';
  dataUrl: string;
}

export interface DOMResult {
  html: string;
  selector?: string;
}

export interface ExecuteJSResult {
  result: unknown;
}

export interface TabsResult {
  tabs: TabInfo[];
  activeTabId: number;
}

export interface BookmarksResult {
  bookmarks: BookmarkNode[];
}

export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  children?: BookmarkNode[];
}

export interface HistoryResult {
  items: HistoryItem[];
}

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  lastVisitTime: number;
}

export interface SessionsResult {
  sessions: BrowserSession[];
}

export interface ElementInfo {
  selector: string;
  tagName: string;
  text: string;
  role?: string;
  label?: string;
  name?: string;
  type?: string;
  href?: string;
  value?: string;
  placeholder?: string;
  disabled: boolean;
  visible: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
