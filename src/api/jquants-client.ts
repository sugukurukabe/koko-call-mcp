import { createHash } from "node:crypto";
import { LRUCache } from "lru-cache";
import {
  bundledListedCompanies,
  type ListedCompany,
  normalizeTickerCode,
} from "../domain/listed-company.js";
import { UpstreamError, UserInputError } from "../lib/errors.js";
import { TokenBucketRateLimiter } from "../lib/rate-limiter.js";
import { VERSION } from "../lib/version.js";

export interface JquantsClientOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
  rateLimitPerSecond?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

export interface DailyBar {
  date: string;
  code: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  adjustmentClose: number | null;
}

export interface EventWindowSeries {
  code: string;
  eventDate: string;
  from: string;
  to: string;
  bars: DailyBar[];
  closeAtOrBeforeEvent: number | null;
  closeAtOrAfterWindowEnd: number | null;
  pctChange: number | null;
}

const defaultBaseUrl = "https://api.jquants.com/v2";
const idTokenTtlMs = 20 * 60 * 60 * 1000;

type JsonRecord = Record<string, unknown>;

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex").slice(0, 16);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function asRecord(value: unknown): JsonRecord | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toIsoDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return value.slice(0, 10);
}

function parseDailyBar(value: unknown): DailyBar | undefined {
  const row = asRecord(value);
  if (!row) {
    return undefined;
  }
  const dateRaw = asString(row.Date) ?? asString(row.date);
  const codeRaw = asString(row.Code) ?? asString(row.code);
  if (!dateRaw || !codeRaw) {
    return undefined;
  }
  return {
    date: toIsoDate(dateRaw),
    code: codeRaw,
    open: asNumber(row.Open ?? row.open),
    high: asNumber(row.High ?? row.high),
    low: asNumber(row.Low ?? row.low),
    close: asNumber(row.Close ?? row.close),
    volume: asNumber(row.Volume ?? row.volume),
    adjustmentClose: asNumber(row.AdjustmentClose ?? row.adjustmentClose ?? row.Close ?? row.close),
  };
}

function parseListedCompany(value: unknown): ListedCompany | undefined {
  const row = asRecord(value);
  if (!row) {
    return undefined;
  }
  const codeRaw = asString(row.Code) ?? asString(row.code);
  const name = asString(row.CompanyName) ?? asString(row.companyName) ?? asString(row.Name);
  if (!codeRaw || !name) {
    return undefined;
  }
  const code = normalizeTickerCode(codeRaw) ?? codeRaw.slice(0, 4);
  const sector = asString(row.Sector33CodeName) ?? asString(row.sector) ?? "不明";
  return { code, name, sector, aliases: [] };
}

export class JquantsClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly cache: LRUCache<string, DailyBar[] | ListedCompany[]>;
  private readonly limiter: TokenBucketRateLimiter;
  private readonly idTokens = new Map<string, { token: string; expiresAt: number }>();

  constructor(options: JquantsClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? defaultBaseUrl;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 500;
    this.cache = new LRUCache<string, DailyBar[] | ListedCompany[]>({
      max: 200,
      ttl: options.cacheTtlMs ?? 10 * 60 * 1000,
    });
    const perSecond = options.rateLimitPerSecond ?? 1;
    this.limiter = new TokenBucketRateLimiter(Math.max(1, Math.floor(1000 / perSecond)));
  }

  bundledMaster(): ListedCompany[] {
    return bundledListedCompanies();
  }

  async listedMaster(apiKey: string): Promise<ListedCompany[]> {
    const namespace = hashSecret(apiKey);
    const cacheKey = `${namespace}:master`;
    const cached = this.cache.get(cacheKey);
    if (Array.isArray(cached)) {
      return cached as ListedCompany[];
    }
    const payload = await this.authorizedGet(apiKey, "/equities/master");
    const rows = asArray(payload.data ?? payload.listed_info ?? payload.companies);
    const companies = rows
      .map((row) => parseListedCompany(row))
      .filter((company): company is ListedCompany => company !== undefined);
    const merged = mergeCatalog(this.bundledMaster(), companies);
    this.cache.set(cacheKey, merged);
    return merged;
  }

  async dailyBars(apiKey: string, code: string, from: string, to: string): Promise<DailyBar[]> {
    const namespace = hashSecret(apiKey);
    const equityCode = normalizeTickerCode(code) ?? code;
    const cacheKey = `${namespace}:bars:${equityCode}:${from}:${to}`;
    const cached = this.cache.get(cacheKey);
    if (Array.isArray(cached)) {
      return cached as DailyBar[];
    }
    const path = `/equities/bars/daily?code=${encodeURIComponent(equityCode)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const payload = await this.authorizedGet(apiKey, path);
    const rows = asArray(payload.data ?? payload.daily_quotes ?? payload.bars);
    const bars = rows
      .map((row) => parseDailyBar(row))
      .filter((bar): bar is DailyBar => bar !== undefined)
      .sort((left, right) => left.date.localeCompare(right.date));
    this.cache.set(cacheKey, bars);
    return bars;
  }

  async eventWindow(
    apiKey: string,
    code: string,
    eventDate: string,
    windowDays: number,
  ): Promise<EventWindowSeries> {
    const from = shiftIsoDate(eventDate, -windowDays);
    const to = shiftIsoDate(eventDate, windowDays);
    const bars = await this.dailyBars(apiKey, code, from, to);
    const closeAtOrBeforeEvent = lastCloseOnOrBefore(bars, eventDate);
    const closeAtOrAfterWindowEnd = lastCloseOnOrBefore(bars, to) ?? closeAtOrBeforeEvent;
    const pctChange = computePctChange(closeAtOrBeforeEvent, closeAtOrAfterWindowEnd);
    return {
      code: normalizeTickerCode(code) ?? code,
      eventDate,
      from,
      to,
      bars,
      closeAtOrBeforeEvent,
      closeAtOrAfterWindowEnd,
      pctChange,
    };
  }

  private async authorizedGet(apiKey: string, path: string): Promise<JsonRecord> {
    const idToken = await this.resolveIdToken(apiKey);
    return this.fetchJson("GET", path, {
      Authorization: `Bearer ${idToken}`,
    });
  }

  private async resolveIdToken(apiKey: string): Promise<string> {
    const namespace = hashSecret(apiKey);
    const cached = this.idTokens.get(namespace);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }
    const payload = await this.fetchJson("POST", "/token/auth_refresh", undefined, {
      refreshtoken: apiKey,
    });
    const token = asString(payload.idToken) ?? asString(payload.id_token);
    if (!token) {
      throw new UpstreamError("J-Quants authentication did not return an idToken.");
    }
    this.idTokens.set(namespace, { token, expiresAt: Date.now() + idTokenTtlMs });
    return token;
  }

  private async fetchJson(
    method: "GET" | "POST",
    path: string,
    headers?: Record<string, string>,
    body?: JsonRecord,
  ): Promise<JsonRecord> {
    let attempt = 0;
    for (;;) {
      await this.limiter.wait();
      try {
        return await this.fetchJsonOnce(method, path, headers, body);
      } catch (error) {
        if (attempt >= this.maxRetries || !isRetryableError(error)) {
          throw error;
        }
        const delay = this.retryBaseDelayMs * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt += 1;
      }
    }
  }

  private async fetchJsonOnce(
    method: "GET" | "POST",
    path: string,
    headers?: Record<string, string>,
    body?: JsonRecord,
  ): Promise<JsonRecord> {
    const url = `${this.baseUrl}${path}`;
    const requestInit: RequestInit = {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        "User-Agent": `JP Bids MCP/${VERSION}`,
        ...headers,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    };
    if (body) {
      requestInit.body = JSON.stringify(body);
    }
    const response = await this.fetchImpl(url, requestInit);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new UserInputError(
          "J-Quants APIキーが無効か期限切れです。https://jpx-jquants.com/ で再発行し、jquants_api_key または JQUANTS_API_KEY を更新してください。",
        );
      }
      const error = new UpstreamError(`J-Quants HTTP ${response.status}`, response.status);
      if (!isRetryableStatus(response.status)) {
        throw error;
      }
      throw error;
    }
    const payload: unknown = await response.json();
    return asRecord(payload) ?? {};
  }
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof UserInputError) {
    return false;
  }
  if (error instanceof UpstreamError) {
    return error.status === undefined || isRetryableStatus(error.status);
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return true;
  }
  return error instanceof TypeError;
}

function mergeCatalog(bundled: ListedCompany[], remote: ListedCompany[]): ListedCompany[] {
  const byCode = new Map<string, ListedCompany>();
  for (const company of [...bundled, ...remote]) {
    const existing = byCode.get(company.code);
    if (!existing) {
      byCode.set(company.code, company);
      continue;
    }
    const aliases = [
      ...new Set([...existing.aliases, ...company.aliases, company.name, existing.name]),
    ];
    byCode.set(company.code, {
      code: company.code,
      name: existing.name.length >= company.name.length ? existing.name : company.name,
      sector: existing.sector === "不明" ? company.sector : existing.sector,
      aliases: aliases.filter((alias) => alias !== existing.name),
    });
  }
  return [...byCode.values()];
}

export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

export function lastCloseOnOrBefore(bars: readonly DailyBar[], isoDate: string): number | null {
  for (let index = bars.length - 1; index >= 0; index -= 1) {
    const bar = bars[index];
    if (!bar || bar.date > isoDate) {
      continue;
    }
    return bar.adjustmentClose ?? bar.close;
  }
  return null;
}

export function computePctChange(start: number | null, end: number | null): number | null {
  if (start === null || end === null || start === 0) {
    return null;
  }
  return ((end - start) / start) * 100;
}

export function resolveJquantsApiKey(toolArg?: string): string | undefined {
  const fromArg = toolArg?.trim();
  if (fromArg) {
    return fromArg;
  }
  const fromEnv = process.env.JQUANTS_API_KEY?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return undefined;
}
