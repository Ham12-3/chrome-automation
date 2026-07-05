import { z } from 'zod';

// ─── WebSocket Message Protocol ────────────────────────────────────────────

export const BrowserCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('navigate'), url: z.string().url() }),
  z.object({ type: z.literal('openNewTab'), url: z.string().url().optional(), active: z.boolean().optional() }),
  z.object({ type: z.literal('getActiveTab') }),
  z.object({ type: z.literal('goBack') }),
  z.object({ type: z.literal('goForward') }),
  z.object({ type: z.literal('reload') }),
  z.object({ type: z.literal('click'), selector: z.string().min(1) }),
  z.object({ type: z.literal('clickText'), text: z.string().min(1), exact: z.boolean().optional() }),
  z.object({ type: z.literal('clickCoordinates'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('doubleClick'), selector: z.string().min(1) }),
  z.object({ type: z.literal('hover'), selector: z.string().min(1) }),
  z.object({ type: z.literal('type'), selector: z.string().min(1), text: z.string(), clear: z.boolean().optional() }),
  z.object({ type: z.literal('typeFocused'), text: z.string() }),
  z.object({ type: z.literal('pressKey'), key: z.string().min(1), selector: z.string().min(1).optional() }),
  z.object({ type: z.literal('scroll'), selector: z.string().min(1).optional(), x: z.number().optional(), y: z.number().optional() }),
  z.object({ type: z.literal('selectOption'), selector: z.string().min(1), value: z.string() }),
  z.object({
    type: z.literal('uploadFile'),
    selector: z.string().min(1),
    fileName: z.string().min(1),
    mimeType: z.string(),
    dataBase64: z.string().min(1),
  }),
  z.object({ type: z.literal('waitForSelector'), selector: z.string().min(1), timeoutMs: z.number().int().positive().optional() }),
  z.object({ type: z.literal('waitForText'), text: z.string().min(1), timeoutMs: z.number().int().positive().optional() }),
  z.object({ type: z.literal('search'), query: z.string().min(1), engine: z.enum(['google', 'bing', 'duckduckgo']).optional() }),
  z.object({ type: z.literal('screenshot'), format: z.enum(['png', 'jpeg']).optional() }),
  z.object({ type: z.literal('getDOM'), selector: z.string().optional() }),
  z.object({ type: z.literal('getPageText') }),
  z.object({ type: z.literal('getInteractiveElements') }),
  z.object({ type: z.literal('executeJS'), code: z.string().min(1) }),
  z.object({ type: z.literal('getTabs') }),
  z.object({ type: z.literal('switchTab'), tabId: z.number().int().positive() }),
  z.object({ type: z.literal('closeTab'), tabId: z.number().int().positive() }),
  z.object({ type: z.literal('getBookmarks') }),
  z.object({ type: z.literal('getHistory'), limit: z.number().int().positive().optional() }),
]);

export type BrowserCommand = z.infer<typeof BrowserCommandSchema>;

// ─── WebSocket Envelope ────────────────────────────────────────────────────

export const WsRequestSchema = z.object({
  type: z.literal('command'),
  requestId: z.string().min(1),
  command: BrowserCommandSchema,
});

export type WsRequest = z.infer<typeof WsRequestSchema>;

export const WsResultSchema = z.object({
  type: z.literal('result'),
  requestId: z.string().min(1),
  data: z.unknown(),
});

export type WsResult = z.infer<typeof WsResultSchema>;

export const WsErrorSchema = z.object({
  type: z.literal('error'),
  requestId: z.string().min(1),
  message: z.string(),
});

export type WsError = z.infer<typeof WsErrorSchema>;

export const WsEventSchema = z.object({
  type: z.literal('event'),
  event: z.enum(['tabCreated', 'tabClosed', 'tabUpdated', 'navigationComplete']),
  data: z.unknown(),
});

export type WsEvent = z.infer<typeof WsEventSchema>;

export const WsMessageSchema = z.discriminatedUnion('type', [
  WsRequestSchema,
  WsResultSchema,
  WsErrorSchema,
  WsEventSchema,
]);

export type WsMessage = z.infer<typeof WsMessageSchema>;

// ─── Auth / Handshake ──────────────────────────────────────────────────────

export const HandshakeSchema = z.object({
  type: z.literal('handshake'),
  token: z.string().min(1),
  browserName: z.string().min(1),
  browserVersion: z.string().optional(),
  extensionVersion: z.string().optional(),
  platform: z.string().optional(),
  userAgent: z.string().optional(),
});

export type Handshake = z.infer<typeof HandshakeSchema>;

export const HandshakeAckSchema = z.object({
  type: z.literal('handshake_ack'),
  sessionId: z.string(),
  serverTime: z.number().optional(),
});

export type HandshakeAck = z.infer<typeof HandshakeAckSchema>;

// ─── Remote Control Messages ──────────────────────────────────────────────

export const RemoteChatSchema = z.object({
  type: z.literal('chat'),
  message: z.string().min(1),
  sessionId: z.string().optional(),
});

export type RemoteChat = z.infer<typeof RemoteChatSchema>;

export const RemoteChatResponseSchema = z.object({
  type: z.literal('chatResponse'),
  message: z.string(),
  toolCalls: z.array(z.object({
    tool: z.string(),
    params: z.unknown(),
  })).optional(),
});

export type RemoteChatResponse = z.infer<typeof RemoteChatResponseSchema>;

export const RemoteScreenshotSchema = z.object({
  type: z.literal('screenshot'),
  sessionId: z.string(),
  dataUrl: z.string(),
});

export type RemoteScreenshot = z.infer<typeof RemoteScreenshotSchema>;

export const RemoteMessageSchema = z.discriminatedUnion('type', [
  RemoteChatSchema,
  RemoteChatResponseSchema,
  RemoteScreenshotSchema,
]);

export type RemoteMessage = z.infer<typeof RemoteMessageSchema>;
