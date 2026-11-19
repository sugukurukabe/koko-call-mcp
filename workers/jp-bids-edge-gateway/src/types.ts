export interface AnalyticsEngineDataPoint {
  blobs?: string[];
  doubles?: number[];
  indexes?: string[];
}

export interface AnalyticsEngineDataset {
  writeDataPoint(event?: AnalyticsEngineDataPoint): void;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

export interface CloudflareRequest extends Request {
  cf?: {
    country?: string;
    colo?: string;
  };
}

export interface GatewayEnv {
  ORIGIN_URL: string;
  PUBLIC_BASE_URL: string;
  EDGE_AUTH_SECRET?: string;
  IP_HASH_SALT?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_CHANNEL_ID?: string;
  CIRCUIT_BREAKER_THRESHOLD?: string;
  CIRCUIT_BREAKER_WINDOW_SEC?: string;
  CIRCUIT_BREAKER_OPEN_SEC?: string;
  TELEMETRY?: AnalyticsEngineDataset;
  FEEDBACK_DB?: D1Database;
  STATE_KV?: KVNamespace;
}
