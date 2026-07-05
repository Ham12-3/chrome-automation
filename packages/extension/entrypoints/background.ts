import { backoffDelay, generateId, type ExtensionConnectionStatus } from '@chrome-automation/shared';

export default defineBackground(() => {
  // ─── Configuration ─────────────────────────────────────────────────────────

  const WS_URL = 'ws://127.0.0.1:7890';
  const AUTH_TOKEN = 'chrome-automation-token-change-me';
  const KEEPALIVE_INTERVAL_MS = 15_000;
  const RECONNECT_BASE_MS = 1_000;
  const RECONNECT_MAX_MS = 30_000;

  // ─── State ──────────────────────────────────────────────────────────────────

  let ws: WebSocket | null = null;
  let sessionId: string | null = null;
  let reconnectAttempt = 0;
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let browserInfo = getBrowserInfo();
  let status: ExtensionConnectionStatus = {
    connected: false,
    state: 'idle',
    wsUrl: WS_URL,
    browserName: browserInfo.name,
    browserVersion: browserInfo.version,
    extensionVersion: chrome.runtime.getManifest().version,
    platform: navigator.platform,
    sessionId: null,
    reconnectAttempt: 0,
    nextReconnectAt: null,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    lastHeartbeatAt: null,
    lastError: null,
  };

  function setStatus(patch: Partial<ExtensionConnectionStatus>): void {
    status = { ...status, ...patch };
    chrome.storage.local.set({ connectionStatus: status });
  }

  function getBrowserInfo(): { name: string; version?: string } {
    const ua = navigator.userAgent;
    const matchers: Array<[string, RegExp]> = [
      ['Microsoft Edge', /Edg\/([\d.]+)/],
      ['Firefox', /Firefox\/([\d.]+)/],
      ['Chrome', /Chrome\/([\d.]+)/],
      ['Safari', /Version\/([\d.]+).*Safari/],
    ];
    const match = matchers.find(([, pattern]) => pattern.test(ua));
    return {
      name: match?.[0] ?? 'Browser',
      version: match?.[1].exec(ua)?.[1],
    };
  }

  // ─── WebSocket Connection ──────────────────────────────────────────────────

  function connect(): void {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    browserInfo = getBrowserInfo();
    setStatus({
      connected: false,
      state: reconnectAttempt > 0 ? 'reconnecting' : 'connecting',
      browserName: browserInfo.name,
      browserVersion: browserInfo.version,
      extensionVersion: chrome.runtime.getManifest().version,
      platform: navigator.platform,
      reconnectAttempt,
      lastError: null,
    });

    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[BG] WebSocket connected, sending handshake...');
      reconnectAttempt = 0;

      ws!.send(JSON.stringify({
        type: 'handshake',
        token: AUTH_TOKEN,
        browserName: browserInfo.name,
        browserVersion: browserInfo.version,
        extensionVersion: chrome.runtime.getManifest().version,
        platform: navigator.platform,
        userAgent: navigator.userAgent,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'handshake_ack') {
          sessionId = msg.sessionId;
          console.log('[BG] Authenticated, session:', sessionId);
          chrome.storage.local.set({ sessionId });
          setStatus({
            connected: true,
            state: 'connected',
            sessionId,
            reconnectAttempt: 0,
            nextReconnectAt: null,
            lastConnectedAt: Date.now(),
            lastError: null,
          });
          startKeepalive();
          reportTabs();
          return;
        }

        if (msg.type === 'pong') {
          setStatus({ lastHeartbeatAt: Date.now() });
          return;
        }

        if (msg.type === 'command') {
          handleCommand(msg.requestId, msg.command);
          return;
        }
      } catch (err) {
        console.error('[BG] Error handling message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[BG] WebSocket disconnected');
      sessionId = null;
      chrome.storage.local.remove('sessionId');
      setStatus({
        connected: false,
        state: 'disconnected',
        sessionId: null,
        lastDisconnectedAt: Date.now(),
      });
      stopKeepalive();
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error('[BG] WebSocket error:', err);
      setStatus({
        connected: false,
        state: 'error',
        lastError: 'WebSocket connection failed. Is the local automation server running?',
      });
    };
  }

  // ─── Keepalive ──────────────────────────────────────────────────────────────

  function startKeepalive(): void {
    stopKeepalive();
    keepaliveTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
        setStatus({ lastHeartbeatAt: Date.now() });
      }
    }, KEEPALIVE_INTERVAL_MS);
  }

  function stopKeepalive(): void {
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
  }

  // ─── Reconnection ───────────────────────────────────────────────────────────

  function scheduleReconnect(): void {
    if (reconnectTimer) return;

    const delay = backoffDelay(reconnectAttempt, RECONNECT_BASE_MS, RECONNECT_MAX_MS);
    console.log(`[BG] Reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1})...`);
    reconnectAttempt++;
    setStatus({
      connected: false,
      state: 'reconnecting',
      reconnectAttempt,
      nextReconnectAt: Date.now() + delay,
    });

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  // ─── Command Handling ──────────────────────────────────────────────────────

  async function handleCommand(requestId: string, command: { type: string; [key: string]: unknown }): Promise<void> {
    try {
      let result: unknown;

      switch (command.type) {
        case 'navigate': {
          const tab = await getActiveTab();
          await chrome.tabs.update(tab.id, { url: command.url as string });
          const completed = await waitForTabComplete(tab.id);
          result = { url: completed.url ?? command.url, title: completed.title ?? '' };
          break;
        }

        case 'openNewTab': {
          const tab = await chrome.tabs.create({
            url: (command.url as string | undefined) ?? 'about:blank',
            active: command.active !== false,
          });
          result = {
            id: tab.id ?? 0,
            url: tab.url ?? '',
            title: tab.title ?? '',
            active: tab.active,
          };
          break;
        }

        case 'getActiveTab': {
          const tab = await getActiveTab();
          result = {
            id: tab.id,
            url: tab.url ?? '',
            title: tab.title ?? '',
            active: tab.active,
          };
          break;
        }

        case 'goBack': {
          const tab = await getActiveTab();
          await sendContentMessage(tab.id, { type: 'GO_BACK' });
          const completed = await waitForTabComplete(tab.id);
          result = { url: completed.url ?? '', title: completed.title ?? '' };
          break;
        }

        case 'goForward': {
          const tab = await getActiveTab();
          await sendContentMessage(tab.id, { type: 'GO_FORWARD' });
          const completed = await waitForTabComplete(tab.id);
          result = { url: completed.url ?? '', title: completed.title ?? '' };
          break;
        }

        case 'reload': {
          const tab = await getActiveTab();
          await chrome.tabs.reload(tab.id);
          const completed = await waitForTabComplete(tab.id);
          result = { url: completed.url ?? '', title: completed.title ?? '' };
          break;
        }

        case 'click': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'CLICK',
            selector: command.selector,
          });
          result = response;
          break;
        }

        case 'clickText': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'CLICK_TEXT',
            text: command.text,
            exact: command.exact,
          });
          result = response;
          break;
        }

        case 'clickCoordinates': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'CLICK_COORDINATES',
            x: command.x,
            y: command.y,
          });
          result = response;
          break;
        }

        case 'doubleClick': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'DOUBLE_CLICK',
            selector: command.selector,
          });
          result = response;
          break;
        }

        case 'hover': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'HOVER',
            selector: command.selector,
          });
          result = response;
          break;
        }

        case 'type': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'TYPE',
            selector: command.selector,
            text: command.text,
            clear: command.clear,
          });
          result = response;
          break;
        }

        case 'typeFocused': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'TYPE_FOCUSED',
            text: command.text,
          });
          result = response;
          break;
        }

        case 'pressKey': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'PRESS_KEY',
            selector: command.selector,
            key: command.key,
          });
          result = response;
          break;
        }

        case 'scroll': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'SCROLL',
            selector: command.selector,
            x: command.x,
            y: command.y,
          });
          result = response;
          break;
        }

        case 'selectOption': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'SELECT_OPTION',
            selector: command.selector,
            value: command.value,
          });
          result = response;
          break;
        }

        case 'uploadFile': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'UPLOAD_FILE',
            selector: command.selector,
            fileName: command.fileName,
            mimeType: command.mimeType,
            dataBase64: command.dataBase64,
          });
          result = response;
          break;
        }

        case 'waitForSelector': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'WAIT_FOR_SELECTOR',
            selector: command.selector,
            timeoutMs: command.timeoutMs,
          });
          result = response;
          break;
        }

        case 'waitForText': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'WAIT_FOR_TEXT',
            text: command.text,
            timeoutMs: command.timeoutMs,
          });
          result = response;
          break;
        }

        case 'search': {
          const query = encodeURIComponent(command.query as string);
          const engine = command.engine as string | undefined;
          const baseUrl = engine === 'bing'
            ? 'https://www.bing.com/search?q='
            : engine === 'duckduckgo'
              ? 'https://duckduckgo.com/?q='
              : 'https://www.google.com/search?q=';
          const tab = await getActiveTab();
          await chrome.tabs.update(tab.id, { url: `${baseUrl}${query}` });
          const completed = await waitForTabComplete(tab.id);
          result = { url: completed.url ?? `${baseUrl}${query}`, title: completed.title ?? '' };
          break;
        }

        case 'screenshot': {
          const tab = await getActiveTab();
          const format = (command.format as string) === 'jpeg' ? 'jpeg' : 'png';
          const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format });
          result = { format, dataUrl };
          break;
        }

        case 'getDOM': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'GET_DOM',
            selector: command.selector,
          });
          result = response;
          break;
        }

        case 'getPageText': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'GET_PAGE_TEXT',
          });
          result = response;
          break;
        }

        case 'getInteractiveElements': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'GET_INTERACTIVE_ELEMENTS',
          });
          result = response;
          break;
        }

        case 'executeJS': {
          const tab = await getActiveTab();
          const response = await sendContentMessage(tab.id, {
            type: 'EXECUTE_JS',
            code: command.code,
          });
          result = response;
          break;
        }

        case 'getTabs': {
          const tabs = await chrome.tabs.query({});
          const activeTabId = tabs.find(t => t.active)?.id ?? 0;
          result = {
            tabs: tabs.map(t => ({
              id: t.id ?? 0,
              url: t.url ?? '',
              title: t.title ?? '',
              active: t.active,
            })),
            activeTabId,
          };
          break;
        }

        case 'switchTab': {
          await chrome.tabs.update(command.tabId as number, { active: true });
          result = { switchedTo: command.tabId };
          break;
        }

        case 'closeTab': {
          await chrome.tabs.remove(command.tabId as number);
          result = { closed: command.tabId };
          break;
        }

        case 'getBookmarks': {
          const tree = await chrome.bookmarks.getTree();
          result = { bookmarks: tree };
          break;
        }

        case 'getHistory': {
          const items = await chrome.history.search({
            text: '',
            maxResults: (command.limit as number) ?? 50,
            startTime: 0,
          });
          result = {
            items: items.map(h => ({
              id: h.id,
              url: h.url,
              title: h.title,
              lastVisitTime: h.lastVisitTime ?? 0,
            })),
          };
          break;
        }

        default:
          throw new Error(`Unknown command: ${command.type}`);
      }

      ws?.send(JSON.stringify({
        type: 'result',
        requestId,
        data: result,
      }));
    } catch (err) {
      ws?.send(JSON.stringify({
        type: 'error',
        requestId,
        message: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  // ─── Tab Event Reporting ───────────────────────────────────────────────────

  async function reportTabs(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({});
      const activeTabId = tabs.find(t => t.active)?.id ?? 0;
      ws?.send(JSON.stringify({
        type: 'event',
        event: 'tabUpdated',
        data: {
          tabs: tabs.map(t => ({
            id: t.id ?? 0,
            url: t.url ?? '',
            title: t.title ?? '',
            active: t.active,
          })),
          activeTabId,
        },
      }));
    } catch {
      // Ignore
    }
  }

  async function getActiveTab(): Promise<chrome.tabs.Tab & { id: number; windowId: number }> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || tab.windowId === undefined) {
      throw new Error('No active browser tab');
    }
    return tab as chrome.tabs.Tab & { id: number; windowId: number };
  }

  async function sendContentMessage(tabId: number, message: Record<string, unknown>): Promise<unknown> {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (err) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['/content-scripts/content.js'],
      });
      try {
        return await chrome.tabs.sendMessage(tabId, message);
      } catch {
        throw new Error(`Unable to run page automation in this tab: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  function waitForTabComplete(tabId: number, timeoutMs = 30_000): Promise<chrome.tabs.Tab> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Navigation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const cleanup = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
      };

      const finish = async () => {
        cleanup();
        const tab = await chrome.tabs.get(tabId);
        resolve(tab);
      };

      const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          void finish();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
      chrome.tabs.get(tabId).then((tab) => {
        if (tab.status === 'complete') {
          void finish();
        }
      }).catch((err) => {
        cleanup();
        reject(err);
      });
    });
  }

  // ─── Top-Level Event Listeners (MV3 requirement) ───────────────────────────

  chrome.runtime.onInstalled.addListener(() => {
    console.log('[BG] Extension installed');
    connect();
  });

  chrome.runtime.onStartup.addListener(() => {
    console.log('[BG] Browser started');
    connect();
  });

  // Keep service worker alive with alarms
  chrome.alarms.create('keepalive', { periodInMinutes: 0.25 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepalive') {
      // This empty handler keeps the SW from being terminated
    }
  });

  // Tab events
  chrome.tabs.onCreated.addListener(() => reportTabs());
  chrome.tabs.onRemoved.addListener(() => reportTabs());
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
      reportTabs();
    }
  });

  // ─── Popup Message Handlers ─────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'RECONNECT') {
      // Force disconnect then reconnect
      if (ws) {
        ws.close();
        ws = null;
      }
      reconnectAttempt = 0;
      connect();
      sendResponse({ success: true });
      return true;
    }

    if (msg.type === 'DISCONNECT') {
      if (ws) {
        ws.close();
        ws = null;
      }
      sessionId = null;
      stopKeepalive();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      chrome.storage.local.remove('sessionId');
      setStatus({
        connected: false,
        state: 'disconnected',
        sessionId: null,
        nextReconnectAt: null,
        lastDisconnectedAt: Date.now(),
      });
      sendResponse({ success: true });
      return true;
    }

    if (msg.type === 'GET_STATUS') {
      sendResponse({
        ...status,
        connected: ws?.readyState === WebSocket.OPEN && !!sessionId,
        sessionId,
      });
      return true;
    }

    // Forward automation commands from popup to the active tab
    if (msg.type === 'RUN_COMMAND') {
      handleCommand(msg.requestId ?? generateId(), msg.command)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }
  });

  // ─── Initial Connection ────────────────────────────────────────────────────

  connect();
  setStatus(status);
});
