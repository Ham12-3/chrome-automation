import type { BrowserSession, TabInfo } from '@chrome-automation/shared';

/**
 * In-memory store for connected browser sessions.
 * Tracks all browser extensions currently connected via WebSocket.
 */
export type SessionChangeListener = () => void;

export class SessionStore {
  private sessions: Map<string, BrowserSession> = new Map();
  private activeSessionId: string | null = null;
  private listeners: Set<SessionChangeListener> = new Set();

  /** Subscribe to session store changes */
  onChange(listener: SessionChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /** Register a new browser connection */
  addSession(
    id: string,
    name: string,
    metadata: Partial<Pick<BrowserSession, 'browserVersion' | 'extensionVersion' | 'platform' | 'userAgent'>> = {},
  ): BrowserSession {
    const now = Date.now();
    const session: BrowserSession = {
      id,
      name,
      ...metadata,
      connectionState: 'connected',
      connectedAt: now,
      tabs: [],
      activeTabId: 0,
      lastHeartbeat: now,
      lastSeenAt: now,
      reconnectCount: 0,
    };
    this.sessions.set(id, session);

    // Auto-select first session
    if (!this.activeSessionId) {
      this.activeSessionId = id;
    }

    this.emitChange();
    return session;
  }

  /** Remove a disconnected browser */
  removeSession(id: string): void {
    this.sessions.delete(id);
    if (this.activeSessionId === id) {
      const next = this.sessions.keys().next().value;
      this.activeSessionId = next ?? null;
    }
    this.emitChange();
  }

  /** Get a session by ID */
  getSession(id: string): BrowserSession | undefined {
    return this.sessions.get(id);
  }

  /** Get all sessions */
  getAllSessions(): BrowserSession[] {
    return Array.from(this.sessions.values());
  }

  /** Get the currently active session */
  getActiveSession(): BrowserSession | undefined {
    if (!this.activeSessionId) return undefined;
    return this.sessions.get(this.activeSessionId);
  }

  /** Set the active session */
  setActiveSession(id: string): boolean {
    if (this.sessions.has(id)) {
      this.activeSessionId = id;
      this.emitChange();
      return true;
    }
    return false;
  }

  /** Update tabs for a session */
  updateTabs(sessionId: string, tabs: TabInfo[], activeTabId: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.tabs = tabs;
      session.activeTabId = activeTabId;
      this.emitChange();
    }
  }

  /** Update heartbeat timestamp */
  heartbeat(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const now = Date.now();
      session.lastHeartbeat = now;
      session.lastSeenAt = now;
      session.connectionState = 'connected';
      this.emitChange();
    }
  }

  /** Get session count */
  get count(): number {
    return this.sessions.size;
  }
}

/** Singleton instance */
export const sessionStore = new SessionStore();
