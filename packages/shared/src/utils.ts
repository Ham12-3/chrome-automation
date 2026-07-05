/**
 * Generate a simple unique ID (not a full UUID, but good enough for request IDs).
 * Uses crypto.randomUUID() when available, falls back to a simple generator.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `${ts}-${rand}`;
}

/**
 * Generate a short session ID for browser connections.
 */
export function generateSessionId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Simple delay utility.
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff calculation.
 */
export function backoffDelay(attempt: number, baseMs = 1000, maxMs = 30000): number {
  return Math.min(baseMs * Math.pow(2, attempt), maxMs);
}
