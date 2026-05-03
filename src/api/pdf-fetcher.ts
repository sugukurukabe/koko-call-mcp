import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { LRUCache } from "lru-cache";
import { parsePositiveNumberEnv } from "../lib/env.js";
import { UpstreamError, UserInputError } from "../lib/errors.js";

export interface FetchedDocument {
  sourceUri: string;
  finalUri: string;
  mimeType: string;
  bytes: Uint8Array;
  sizeBytes: number;
  sha256: string;
}

export interface PdfFetcherOptions {
  fetchImpl?: typeof fetch;
  resolveHostname?: (hostname: string) => Promise<string[]>;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  allowedHosts?: string[];
}

interface CachedDocument {
  finalUri: string;
  mimeType: string;
  bytes: Uint8Array;
  sizeBytes: number;
  sha256: string;
}

const defaultMaxBytes = 20 * 1024 * 1024;
const defaultTimeoutMs = 15_000;
const defaultMaxRedirects = 5;
const allowedMimeTypes = new Set(["application/pdf", "text/html"]);
const documentCache = new LRUCache<string, CachedDocument>({
  max: 10,
  maxSize: 200 * 1024 * 1024,
  sizeCalculation: (value) => value.sizeBytes,
  ttl: 5 * 60 * 1000,
});

export async function fetchDocument(
  uri: string,
  options: PdfFetcherOptions = {},
): Promise<FetchedDocument> {
  const sourceUrl = parseHttpUrl(uri);
  const allowedHosts =
    options.allowedHosts ?? parseAllowedHosts(process.env.JP_BIDS_PDF_ALLOWED_HOSTS);
  assertAllowedHost(sourceUrl, allowedHosts);

  const cached = documentCache.get(sourceUrl.toString());
  if (cached) {
    return { sourceUri: sourceUrl.toString(), ...cached };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const resolveHostname = options.resolveHostname ?? defaultResolveHostname;
  const maxBytes =
    options.maxBytes ?? parsePositiveNumberEnv(process.env.JP_BIDS_PDF_MAX_BYTES, defaultMaxBytes);
  const timeoutMs =
    options.timeoutMs ??
    parsePositiveNumberEnv(process.env.JP_BIDS_PDF_TIMEOUT_MS, defaultTimeoutMs);
  const maxRedirects = options.maxRedirects ?? defaultMaxRedirects;

  const fetched = await fetchWithRedirects(sourceUrl, {
    fetchImpl,
    resolveHostname,
    maxBytes,
    timeoutMs,
    maxRedirects,
    allowedHosts,
  });
  const sha256 = createHash("sha256").update(fetched.bytes).digest("hex");
  const cachedDocument = { ...fetched, sha256 };
  documentCache.set(sourceUrl.toString(), cachedDocument);
  documentCache.set(sha256, cachedDocument);
  return {
    sourceUri: sourceUrl.toString(),
    ...cachedDocument,
  };
}

export function clearDocumentCache(): void {
  documentCache.clear();
}

async function fetchWithRedirects(
  startUrl: URL,
  options: Required<Pick<PdfFetcherOptions, "fetchImpl" | "resolveHostname">> & {
    maxBytes: number;
    timeoutMs: number;
    maxRedirects: number;
    allowedHosts: string[];
  },
): Promise<Omit<CachedDocument, "sha256">> {
  let currentUrl = startUrl;
  for (let redirectCount = 0; redirectCount <= options.maxRedirects; redirectCount += 1) {
    await assertPublicHttpTarget(currentUrl, options.resolveHostname);
    const response = await fetchWithTimeout(currentUrl, options);

    if (isRedirect(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new UpstreamError("PDF取得先がLocationなしのredirectを返しました。", response.status);
      }
      if (redirectCount === options.maxRedirects) {
        throw new UpstreamError("PDF取得先のredirect回数が上限を超えました。", response.status);
      }
      currentUrl = parseHttpUrl(new URL(location, currentUrl).toString());
      assertAllowedHost(currentUrl, options.allowedHosts);
      continue;
    }

    if (!response.ok) {
      throw new UpstreamError(`PDF取得先がHTTP ${response.status}を返しました。`, response.status);
    }

    const mimeType = normalizeMimeType(response.headers.get("content-type"));
    if (!allowedMimeTypes.has(mimeType)) {
      throw new UserInputError(
        `PDF取得対象のMIME type "${mimeType}" は未対応です。application/pdf または text/html を指定してください。`,
      );
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > options.maxBytes) {
      throw new UserInputError(
        `PDF取得対象がサイズ上限 ${options.maxBytes} bytes を超えています。`,
      );
    }

    const bytes = await readResponseBytes(response, options.maxBytes);
    return {
      finalUri: currentUrl.toString(),
      mimeType,
      bytes,
      sizeBytes: bytes.byteLength,
    };
  }
  throw new UpstreamError("PDF取得先のredirect処理に失敗しました。");
}

async function fetchWithTimeout(
  url: URL,
  options: Required<Pick<PdfFetcherOptions, "fetchImpl">> & { timeoutMs: number },
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    return await options.fetchImpl(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "application/pdf,text/html;q=0.8,*/*;q=0.1",
        "User-Agent": "JP Bids MCP PDF Fetcher/0.5.0",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new UpstreamError(`PDF取得が ${options.timeoutMs}ms でタイムアウトしました。`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) {
    return new Uint8Array(await response.arrayBuffer());
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new UserInputError(`PDF取得対象がサイズ上限 ${maxBytes} bytes を超えています。`);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function parseHttpUrl(uri: string): URL {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new UserInputError("PDF取得対象URIは有効なURLで指定してください。");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UserInputError("PDF取得対象URIは http または https URL で指定してください。");
  }
  url.hash = "";
  return url;
}

function assertAllowedHost(url: URL, allowedHosts: string[]): void {
  if (allowedHosts.length === 0) {
    return;
  }
  if (!allowedHosts.includes(url.hostname)) {
    throw new UserInputError(`PDF取得対象host "${url.hostname}" は許可されていません。`);
  }
}

async function assertPublicHttpTarget(
  url: URL,
  resolveHostname: (hostname: string) => Promise<string[]>,
): Promise<void> {
  const hostIp = isIP(url.hostname) ? url.hostname : undefined;
  const addresses = hostIp ? [hostIp] : await resolveHostname(url.hostname);
  if (addresses.length === 0) {
    throw new UpstreamError(`PDF取得対象host "${url.hostname}" を解決できませんでした。`);
  }
  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      throw new UserInputError(
        `PDF取得対象host "${url.hostname}" はprivate addressへ解決されるため拒否しました。`,
      );
    }
  }
}

async function defaultResolveHostname(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

function isPrivateAddress(address: string): boolean {
  if (address === "::1") {
    return true;
  }
  if (address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) {
    return true;
  }
  if (address.startsWith("::ffff:")) {
    return isPrivateAddress(address.slice("::ffff:".length));
  }

  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  const [a = 0, b = 0] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function normalizeMimeType(contentType: string | null): string {
  return (contentType ?? "application/octet-stream").split(";")[0]?.trim().toLowerCase() ?? "";
}

function parseAllowedHosts(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((host) => host.trim())
    .filter((host) => host.length > 0);
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
