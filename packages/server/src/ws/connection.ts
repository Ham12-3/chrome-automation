import type { BrowserCommand, WsMessage } from '@chrome-automation/shared';
import { generateId } from '@chrome-automation/shared';
import WebSocket from 'ws';

/**
 * Manages a single browser extension connection.
 * Handles command dispatch and response routing.
 */
export class BrowserConnection {
  private pendingRequests: Map<string, {
    resolve: (data: unknown) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = new Map();

  private requestTimeout = 30000; // 30s timeout for commands

  constructor(
    public readonly sessionId: string,
    private ws: WebSocket,
  ) {}

  /** Send a command to the browser and wait for the result */
  async sendCommand(command: BrowserCommand): Promise<unknown> {
    const requestId = generateId();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Command timed out: ${command.type}`));
      }, this.requestTimeout);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      const message: WsMessage = {
        type: 'command',
        requestId,
        command,
      };

      this.ws.send(JSON.stringify(message));
    });
  }

  /** Handle a response from the browser */
  handleResponse(requestId: string, data: unknown): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(requestId);
      pending.resolve(data);
    }
  }

  /** Handle an error from the browser */
  handleError(requestId: string, message: string): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(requestId);
      pending.reject(new Error(message));
    }
  }

  /** Send a raw message to the browser (for events, etc.) */
  send(message: WsMessage): void {
    this.ws.send(JSON.stringify(message));
  }

  /** Check if the WebSocket is still open */
  get isConnected(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  /** Clean up all pending requests */
  destroy(): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Browser disconnected'));
      this.pendingRequests.delete(id);
    }
  }
}
