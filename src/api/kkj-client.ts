import { XMLParser } from "fast-xml-parser";
import { LRUCache } from "lru-cache";
import { createAttribution } from "../domain/attribution.js";
import type { Bid, BidSearchResult } from "../domain/bid.js";
import { UpstreamError, UserInputError } from "../lib/errors.js";
import { TokenBucketRateLimiter } from "../lib/rate-limiter.js";

export interface KkjSearchParams {
  Query?: string;
  Project_Name?: string;
  Organization_Name?: string;
  LG_Code?: string;
  Category?: 1 | 2 | 3;
  Procedure_Type?: 1 | 2 | 3;
  Certification?: string;
  CFT_Issue_Date?: string;
  Tender_Submission_Deadline?: string;
  Opening_Tenders_Event?: string;
  Period_End_Time?: string;
  Count?: number;
}

export interface KkjClientOptions {
  fetchImpl?: typeof fetch;
  endpoint?: string;
  userAgent?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
  rateLimitPerSecond?: number;
}

type XmlRecord = Record<string, unknown>;

const defaultEndpoint = "http://www.kkj.go.jp/api/";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

export class KkjClient {
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly cache: LRUCache<string, BidSearchResult>;
  private readonly limiter: TokenBucketRateLimiter;
  private recentBidKeys: string[] = [];
  private recentOrganizationNames: string[] = [];
  private readonly recentBids = new Map<string, Bid>();

  constructor(options: KkjClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.endpoint = options.endpoint ?? defaultEndpoint;
    this.userAgent = options.userAgent ?? "JP Bids MCP/0.3.3";
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.cache = new LRUCache<string, BidSearchResult>({
      max: 500,
      ttl: options.cacheTtlMs ?? 10 * 60 * 1000,
    });
    const perSecond = options.rateLimitPerSecond ?? 1;
    this.limiter = new TokenBucketRateLimiter(Math.max(1, Math.floor(1000 / perSecond)));
  }

  async search(params: KkjSearchParams): Promise<BidSearchResult> {
    ensureSearchParams(params);
    const normalizedParams = normalizeParams(params);
    const cacheKey = JSON.stringify(normalizedParams);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    await this.limiter.wait();
    const url = new URL(this.endpoint);
    for (const [key, value] of Object.entries(normalizedParams)) {
      url.searchParams.set(key, String(value));
    }

    const response = await this.fetchImpl(url, {
      headers: { "User-Agent": this.userAgent },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new UpstreamError(`kkj.go.jp returned ${response.status}`, response.status);
    }

    const xml = await response.text();
    const result = parseKkjXml(xml, normalizedParams);
    this.rememberBidKeys(result.bids);
    this.cache.set(cacheKey, result);
    return result;
  }

  completeBidKeys(value: string): string[] {
    return this.recentBidKeys.filter((key) => key.includes(value)).slice(0, 100);
  }

  getCachedBid(key: string): Bid | undefined {
    return this.recentBids.get(key);
  }

  completeOrganizationNames(value: string): string[] {
    return this.recentOrganizationNames
      .filter((organizationName) => organizationName.includes(value))
      .slice(0, 100);
  }

  private rememberBidKeys(bids: Bid[]): void {
    for (const bid of bids) {
      this.recentBids.set(bid.key, bid);
    }
    const merged = [bids.map((bid) => bid.key), this.recentBidKeys].flat();
    this.recentBidKeys = [...new Set(merged)].slice(0, 200);
    const organizationNames = bids
      .map((bid) => bid.organizationName)
      .filter((organizationName): organizationName is string => Boolean(organizationName));
    this.recentOrganizationNames = [
      ...new Set([...organizationNames, ...this.recentOrganizationNames]),
    ].slice(0, 200);
    for (const key of this.recentBids.keys()) {
      if (!this.recentBidKeys.includes(key)) {
        this.recentBids.delete(key);
      }
    }
  }
}

export function parseKkjXml(xml: string, query: Record<string, string | number>): BidSearchResult {
  const parsed = xmlParser.parse(xml) as unknown;
  const root = getRecord(parsed, "Results");
  if (!root) {
    throw new UpstreamError("KKJ API response did not include Results");
  }
  const error = root.Error;
  if (typeof error === "string" && error.length > 0) {
    throw new UserInputError(`KKJ API error: ${error}`);
  }
  const searchResults = getRecord(root, "SearchResults");
  const rawResults = toArray(searchResults?.SearchResult);
  const bids = rawResults.map((raw) => normalizeBid(raw));
  return {
    searchHits: toNumber(searchResults?.SearchHits) ?? bids.length,
    returnedCount: bids.length,
    bids,
    query,
    attribution: createAttribution(),
  };
}

function ensureSearchParams(params: KkjSearchParams): void {
  if (!params.Query && !params.Project_Name && !params.Organization_Name && !params.LG_Code) {
    throw new UserInputError(
      "検索条件が不足しています。query（全文検索）、project_name（件名）、organization_name（発注機関）、prefecture（都道府県）のいずれかを指定してください。Add one of query, project_name, organization_name, or prefecture.",
    );
  }
}

function normalizeParams(params: KkjSearchParams): Record<string, string | number> {
  const normalized: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      normalized[key] = value;
    }
  }
  return normalized;
}

function normalizeBid(raw: XmlRecord): Bid {
  const bid: Bid = {
    resultId: toNumber(raw.ResultId) ?? 0,
    key: toStringValue(raw.Key) ?? "",
    projectName: toStringValue(raw.ProjectName) ?? "Untitled procurement",
  };
  setOptional(bid, "externalDocumentUri", toStringValue(raw.ExternalDocumentURI));
  setOptional(bid, "date", toStringValue(raw.Date));
  setOptional(bid, "fileType", toStringValue(raw.FileType));
  setOptional(bid, "fileSize", toNumber(raw.FileSize));
  setOptional(bid, "lgCode", toStringValue(raw.LgCode));
  setOptional(bid, "prefectureName", toStringValue(raw.PrefectureName));
  setOptional(bid, "cityCode", toStringValue(raw.CityCode));
  setOptional(bid, "cityName", toStringValue(raw.CityName));
  setOptional(bid, "organizationName", toStringValue(raw.OrganizationName));
  setOptional(bid, "certification", toStringValue(raw.Certification));
  setOptional(bid, "cftIssueDate", toStringValue(raw.CftIssueDate));
  setOptional(bid, "periodEndTime", toStringValue(raw.PeriodEndTime));
  setOptional(bid, "category", toStringValue(raw.Category));
  setOptional(bid, "procedureType", toStringValue(raw.ProcedureType));
  setOptional(bid, "location", toStringValue(raw.Location));
  setOptional(bid, "tenderSubmissionDeadline", toStringValue(raw.TenderSubmissionDeadline));
  setOptional(bid, "openingTendersEvent", toStringValue(raw.OpeningTendersEvent));
  setOptional(bid, "itemCode", toStringValue(raw.ItemCode));
  setOptional(bid, "projectDescription", toStringValue(raw.ProjectDescription));

  const attachmentRecords = toArray(getRecord(raw, "Attachments")?.Attachment);
  if (attachmentRecords.length > 0) {
    bid.attachments = attachmentRecords.map((attachment) => ({
      name: toStringValue(attachment.Name) ?? "Attachment",
      uri: toStringValue(attachment.Uri) ?? "",
    }));
  }
  return bid;
}

function getRecord(value: unknown, key: string): XmlRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const child = value[key];
  return isRecord(child) ? child : undefined;
}

function isRecord(value: unknown): value is XmlRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toArray(value: unknown): XmlRecord[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  return isRecord(value) ? [value] : [];
}

function toStringValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return String(value);
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function setOptional<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
