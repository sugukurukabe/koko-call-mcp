/**
 * Local Offline Headless-Browser & VM Module Acceptance Verifier for JP Bids MCP Apps UI
 *
 * Strictly offline / loopback-only (`127.0.0.1`):
 * - Spawns Chrome/Edge with `--host-resolver-rules="MAP * ~NOTFOUND , EXCLUDE 127.0.0.1"`
 *   so browser DNS/network egress outside 127.0.0.1 is impossible.
 * - Embeds the exact target `search-results.html` inside a true opaque-origin
 *   `<iframe sandbox="allow-scripts">` (no `allow-same-origin`) and drives it via
 *   the MCP Apps `2026-01-26` JSON-RPC `postMessage` protocol.
 * - Inspects live DOM, computed styles, keyboard focus, multi-select comparison,
 *   CSV/JSON download, and 3-tier `ManualExportPanel` fallback via CDP isolated worlds.
 * - Never writes to stdout (`console.log` prohibited); logs only to stderr when requested.
 */

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REPO_ROOT = path.resolve(__dirname, "../..");

const EXPECTED_16_COLUMNS = [
  "priority",
  "score",
  "key",
  "project_name",
  "organization_name",
  "prefecture",
  "city",
  "category",
  "procedure_type",
  "notice_date",
  "tender_submission_deadline",
  "opening_tenders_event",
  "fit_reasons",
  "risks",
  "next_action",
  "official_url",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function findLocalBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Step 1: Deterministic Node ESM VM startup & syntax gate (`--experimental-vm-modules`).
 * Detects unconditional top-level throws (such as `throw new Error("independent-audit-deliberately-disabled-ui")`),
 * syntax corruption, or unbundled module imports even before launching a browser.
 */
export function evaluateInlineModuleInVm(htmlText) {
  const firstModuleRegex = /(<script\b[^>]*\btype="module"[^>]*>)([\s\S]*?)(<\/script>)/i;
  const match = firstModuleRegex.exec(htmlText);
  if (!match) {
    return {
      ok: false,
      stage: "extract_inline_module",
      error: "Inline <script type='module'> tag not found in HTML bundle",
    };
  }

  const moduleSource = match[2];
  const workerScript = `
import vm from "node:vm";

let source = "";
for await (const chunk of process.stdin) {
  source += chunk;
}

const noop = () => {};
const REACHED_ENTRY_MOUNT = "__JP_BIDS_VM_REACHED_ENTRY_MOUNT__";
let reachedEntryMount = false;
const stubStyleEl = {
  nodeType: 1,
  tagName: "STYLE",
  style: {},
  textContent: "",
  setAttribute: noop,
  getAttribute: () => "",
  appendChild: noop,
};
const stubDoc = {
  head: { appendChild: noop, style: {} },
  body: { appendChild: noop, style: {} },
  documentElement: { dataset: {}, style: {}, getAttribute: () => "ja", setAttribute: noop },
  createElement: () => ({ ...stubStyleEl }),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: noop,
  removeEventListener: noop,
  getElementById: (id) => {
    if (id === "root") {
      reachedEntryMount = true;
      throw new Error(REACHED_ENTRY_MOUNT);
    }
    return null;
  },
};
const ctxGlobals = {
  document: stubDoc,
  navigator: { userAgent: "Mozilla/5.0 (Headless; VMGate)" },
  location: { href: "http://127.0.0.1/", origin: "http://127.0.0.1", protocol: "http:", host: "127.0.0.1" },
  addEventListener: noop,
  removeEventListener: noop,
  postMessage: noop,
  parent: { postMessage: noop },
  matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
  MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } },
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  HTMLElement: function HTMLElement() {},
  Event: Event,
  CustomEvent: CustomEvent,
  MessageEvent: MessageEvent,
  DOMException: DOMException,
  console: { error: noop, warn: noop, info: noop, log: noop, debug: noop },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  queueMicrotask,
  URL: globalThis.URL,
  URLSearchParams: globalThis.URLSearchParams,
  TextEncoder: globalThis.TextEncoder,
  TextDecoder: globalThis.TextDecoder,
  crypto: globalThis.crypto,
};
ctxGlobals.window = ctxGlobals;
ctxGlobals.globalThis = ctxGlobals;
ctxGlobals.self = ctxGlobals;

try {
  const ctx = vm.createContext(ctxGlobals);
  const mod = new vm.SourceTextModule(source, { context: ctx });
  await mod.link(() => {
    throw new Error("Unexpected external ESM import inside single-file UI bundle");
  });
  await mod.evaluate();
  process.stderr.write(JSON.stringify({ ok: true, reachedEntryMount }));
  process.exit(0);
} catch (err) {
  const msg = typeof err?.message === "string" ? err.message : String(err);
  if (reachedEntryMount && msg === REACHED_ENTRY_MOUNT) {
    process.stderr.write(JSON.stringify({ ok: true, reachedEntryMount: true }));
    process.exit(0);
  }
  process.stderr.write(JSON.stringify({ ok: false, stage: "vm_evaluate", error: msg, stack: err?.stack ?? null }));
  process.exit(2);
}
`;

  const res = spawnSync(
    process.execPath,
    ["--no-warnings", "--experimental-vm-modules", "--input-type=module", "-e", workerScript],
    {
      input: moduleSource,
      encoding: "utf8",
      stdio: ["pipe", "ignore", "pipe"],
      timeout: 10000,
      env: {
        ...process.env,
        NPM_CONFIG_UPDATE_NOTIFIER: "false",
        NO_UPDATE_NOTIFIER: "1",
      },
    },
  );
  const rawStderr = (res.stderr ?? "").trim();
  if (res.status === 0) {
    try {
      const parsed = JSON.parse(rawStderr || '{"ok":true}');
      return {
        ok: Boolean(parsed.ok),
        stage: "vm_evaluate",
        reachedEntryMount: Boolean(parsed.reachedEntryMount),
        error: parsed.error ?? null,
      };
    } catch {
      return { ok: true, stage: "vm_evaluate", reachedEntryMount: true, error: null };
    }
  }
  try {
    const firstBrace = rawStderr.indexOf("{");
    if (firstBrace !== -1) {
      const parsed = JSON.parse(rawStderr.slice(firstBrace));
      return {
        ok: false,
        stage: parsed.stage ?? "vm_evaluate",
        error: parsed.error ?? "VM evaluation failed",
        stack: parsed.stack ?? null,
      };
    }
  } catch {
    // Fall through
  }
  return {
    ok: false,
    stage: "vm_evaluate",
    error: rawStderr || (res.error ? res.error.message : `VM worker exited with ${res.status}`),
  };
}

export class CdpClient {
  nextId = 1;
  pending = new Map();
  eventListeners = new Map();

  constructor(socket, { requestTimeoutMs = 15000 } = {}) {
    this.socket = socket;
    this.requestTimeoutMs = requestTimeoutMs;
    this.closedError = null;
    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(String(event.data));
      if (payload.id !== undefined) {
        const entry = this.pending.get(payload.id);
        if (entry) {
          this.pending.delete(payload.id);
          clearTimeout(entry.timer);
          if (payload.error) {
            entry.reject(new Error(payload.error.message || JSON.stringify(payload.error)));
          } else {
            entry.resolve(payload.result);
          }
        }
        return;
      }
      if (payload.method) {
        const handlers = this.eventListeners.get(payload.method);
        if (handlers) {
          for (const fn of handlers) {
            fn(payload.params ?? {}, payload.sessionId);
          }
        }
      }
    });
    socket.addEventListener("close", () => this.failPending(new Error("CDP WebSocket closed")));
    socket.addEventListener("error", () => this.failPending(new Error("CDP WebSocket failed")));
  }

  static async connect(
    wsUrl,
    { WebSocketImpl = WebSocket, timeoutMs = 10000, requestTimeoutMs = 15000 } = {},
  ) {
    const socket = new WebSocketImpl(wsUrl);
    const client = new CdpClient(socket, { requestTimeoutMs });
    await new Promise((resolve, reject) => {
      const finish = (error) => {
        clearTimeout(timer);
        socket.removeEventListener("open", opened);
        socket.removeEventListener("error", failed);
        socket.removeEventListener("close", closed);
        if (error) {
          client.close();
          reject(error);
        } else resolve();
      };
      const opened = () => finish();
      const failed = () => finish(new Error("CDP WebSocket connection failed"));
      const closed = () => finish(new Error("CDP WebSocket closed before connection"));
      const timer = setTimeout(
        () => finish(new Error(`CDP WebSocket connection timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
      socket.addEventListener("open", opened, { once: true });
      socket.addEventListener("error", failed, { once: true });
      socket.addEventListener("close", closed, { once: true });
    });
    return client;
  }

  failPending(error) {
    this.closedError = error;
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    this.pending.clear();
  }

  on(method, handler) {
    const list = this.eventListeners.get(method) ?? [];
    list.push(handler);
    this.eventListeners.set(method, list);
  }

  send(method, params = {}, sessionId = undefined) {
    if (this.closedError) return Promise.reject(this.closedError);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out after ${this.requestTimeoutMs}ms`));
      }, this.requestTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      const msg = sessionId ? { id, method, params, sessionId } : { id, method, params };
      try {
        this.socket.send(JSON.stringify(msg));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  close() {
    this.failPending(new Error("CDP client closed"));
    try {
      this.socket.close();
    } catch {
      // Ignore close errors
    }
  }
}

function buildMockHostHtml(fixtureBids, options = {}) {
  const columnsJson = JSON.stringify(EXPECTED_16_COLUMNS);
  const bidsJson = JSON.stringify(fixtureBids);
  const corruptCsvMode = Boolean(options.corruptCsvMode);

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MCP Apps Offline Acceptance Host</title>
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
    #app-frame { display: block; border: 0; width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <iframe
    id="app-frame"
    src="/search-results.html"
    title="AI Bid Workspace"
    sandbox="allow-scripts"
  ></iframe>
  <script>
    const PROTOCOL_VERSION = "2026-01-26";
    const COLUMNS = ${columnsJson};
    const FIXTURE_BIDS = ${bidsJson};
    const ATTRIBUTION = {
      dataSource: "中小企業庁 官公需情報ポータルサイト",
      apiEndpoint: "http://www.kkj.go.jp/api/",
      licenseUrl: "https://www.kkj.go.jp/s/help/notes/",
      serviceDisclaimer: "JP Bids MCP returns public procurement search results as reference information. Verify official documents before bidding.",
      accessedAt: "2026-11-16T00:00:00.000Z"
    };

    window.__hostState = {
      initialized: false,
      denyDownload: false,
      denyMessage: false,
      corruptCsv: ${corruptCsvMode ? "true" : "false"},
      theme: "light",
      displayMode: "inline",
      rpcLog: [],
      toolCalls: [],
      downloads: [],
      messages: [],
      openLinks: [],
      contextUpdates: []
    };

    const frame = document.getElementById("app-frame");
    const postToApp = (payload) => frame.contentWindow.postMessage(payload, "*");

    function buildSearchResult(bids, criteria = { query: "システム", limit: 20 }) {
      return {
        searchHits: bids.length,
        returnedCount: bids.length,
        bids,
        query: { Query: criteria.query || "システム" },
        searchCriteria: criteria,
        attribution: ATTRIBUTION
      };
    }

    function escapeCsvCell(val) {
      const s = String(val ?? "");
      if (/[",\\r\\n]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }

    function buildRowRecord(bid, idx) {
      const score = idx === 0 ? "88" : "62";
      const priority = idx === 0 ? "pursue" : "review";
      return {
        priority,
        score,
        key: bid.key,
        project_name: bid.projectName,
        organization_name: bid.organizationName || "-",
        prefecture: bid.prefectureName || "-",
        city: bid.cityName || "-",
        category: bid.category || "-",
        procedure_type: bid.procedureType || "-",
        notice_date: bid.cftIssueDate || "-",
        tender_submission_deadline: bid.tenderSubmissionDeadline || "-",
        opening_tenders_event: bid.openingTendersEvent || "-",
        fit_reasons: idx === 0 ? "重点キーワード一致" : "地域・カテゴリ一致",
        risks: "公式公告で仕様確認",
        next_action: "仕様書確認",
        official_url: bid.externalDocumentUri || ""
      };
    }

    window.__pushToolResult = (bids, criteria) => {
      const sc = buildSearchResult(bids, criteria);
      postToApp({
        jsonrpc: "2.0",
        method: "ui/notifications/tool-result",
        params: {
          structuredContent: sc,
          content: [{ type: "text", text: bids.length + "件見つかりました。" }]
        }
      });
    };

    window.__pushHostTheme = (theme) => {
      window.__hostState.theme = theme;
      postToApp({
        jsonrpc: "2.0",
        method: "ui/notifications/host-context-changed",
        params: {
          theme,
          displayMode: window.__hostState.displayMode,
          availableDisplayModes: ["inline", "fullscreen"],
          locale: "ja-JP"
        }
      });
    };

    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (!msg || msg.jsonrpc !== "2.0") return;
      window.__hostState.rpcLog.push({ method: msg.method || "response", id: msg.id ?? null });

      if (msg.method === "ui/initialize") {
        postToApp({
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            hostInfo: { name: "local-browser-acceptance-host", version: "1.0.0" },
            hostCapabilities: {
              openLinks: {},
              serverTools: { listChanged: false },
              updateModelContext: { text: {} },
              message: { text: {} },
              downloadFile: {}
            },
            hostContext: {
              theme: window.__hostState.theme,
              displayMode: window.__hostState.displayMode,
              availableDisplayModes: ["inline", "fullscreen"],
              locale: "ja-JP"
            }
          }
        });
        return;
      }

      if (msg.method === "ui/notifications/initialized") {
        window.__hostState.initialized = true;
        return;
      }

      if (msg.method === "tools/call") {
        const name = msg.params?.name;
        const args = msg.params?.arguments || {};
        window.__hostState.toolCalls.push({ name, arguments: args });

        if (name === "search_bids_app") {
          const sc = buildSearchResult(FIXTURE_BIDS, args);
          postToApp({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              isError: false,
              content: [{ type: "text", text: FIXTURE_BIDS.length + "件" }],
              structuredContent: sc
            }
          });
          return;
        }

        if (name === "rank_bids") {
          const refs = Array.isArray(args.bid_refs) ? args.bid_refs : [];
          const rankedBids = refs.map((ref, idx) => {
            const bid = FIXTURE_BIDS.find((b) => b.bidRef === ref) || FIXTURE_BIDS[0];
            return {
              bid,
              selectionIndex: idx,
              score: idx === 0 ? 88 : 62,
              priority: idx === 0 ? "pursue" : "review",
              reasons: [idx === 0 ? "重点キーワード一致" : "地域・カテゴリ一致"]
            };
          });
          postToApp({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              isError: false,
              content: [{ type: "text", text: "ランキング完了" }],
              structuredContent: {
                rankedCount: rankedBids.length,
                rankedBids,
                scoringPolicy: { version: "1.0.0" },
                attribution: ATTRIBUTION
              }
            }
          });
          return;
        }

        if (name === "export_bid_shortlist") {
          const refs = Array.isArray(args.bid_refs) ? args.bid_refs : [];
          const format = args.format === "json" ? "json" : "csv";
          const matched = refs.map((ref) => FIXTURE_BIDS.find((b) => b.bidRef === ref)).filter(Boolean);
          const records = matched.map((b, idx) => buildRowRecord(b, idx));

          if (window.__hostState.corruptCsv && format === "csv") {
            postToApp({
              jsonrpc: "2.0",
              id: msg.id,
              result: {
                isError: false,
                content: [{ type: "text", text: "corrupted" }],
                structuredContent: {
                  format: "csv",
                  filename: "corrupted.csv",
                  rankedCount: records.length,
                  columns: COLUMNS.slice(0, 10),
                  csv: COLUMNS.slice(0, 10).join(",") + "\\n1,2,3,4,5,6,7,8,9,10\\n"
                }
              }
            });
            return;
          }

          if (format === "json") {
            postToApp({
              jsonrpc: "2.0",
              id: msg.id,
              result: {
                isError: false,
                content: [{ type: "text", text: "JSON出力完了" }],
                structuredContent: {
                  format: "json",
                  filename: "jp-bids-shortlist.json",
                  rankedCount: records.length,
                  columns: COLUMNS,
                  jsonContent: records,
                  attribution: ATTRIBUTION
                }
              }
            });
            return;
          }

          const csvLines = [
            COLUMNS.join(","),
            ...records.map((rec) => COLUMNS.map((col) => escapeCsvCell(rec[col])).join(","))
          ];
          postToApp({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              isError: false,
              content: [{ type: "text", text: "CSV出力完了" }],
              structuredContent: {
                format: "csv",
                filename: "jp-bids-shortlist.csv",
                rankedCount: records.length,
                columns: COLUMNS,
                csv: csvLines.join("\\n") + "\\n",
                attribution: ATTRIBUTION
              }
            }
          });
          return;
        }
      }

      if (msg.method === "ui/download-file") {
        window.__hostState.downloads.push(msg.params?.contents || []);
        if (window.__hostState.denyDownload) {
          postToApp({
            jsonrpc: "2.0",
            id: msg.id,
            result: { isError: true, content: [{ type: "text", text: "Host denied downloadFile" }] }
          });
        } else {
          postToApp({ jsonrpc: "2.0", id: msg.id, result: {} });
        }
        return;
      }

      if (msg.method === "ui/message") {
        window.__hostState.messages.push(msg.params);
        if (window.__hostState.denyMessage) {
          postToApp({
            jsonrpc: "2.0",
            id: msg.id,
            result: { isError: true, content: [{ type: "text", text: "Host denied message" }] }
          });
        } else {
          postToApp({ jsonrpc: "2.0", id: msg.id, result: {} });
        }
        return;
      }

      if (msg.method === "ui/open-link") {
        window.__hostState.openLinks.push(msg.params?.url);
        postToApp({ jsonrpc: "2.0", id: msg.id, result: {} });
        return;
      }

      if (msg.method === "ui/update-model-context") {
        window.__hostState.contextUpdates.push(msg.params);
        postToApp({ jsonrpc: "2.0", id: msg.id, result: {} });
        return;
      }

      if (msg.method === "ui/request-display-mode") {
        window.__hostState.displayMode = msg.params?.mode || "inline";
        postToApp({ jsonrpc: "2.0", id: msg.id, result: { mode: window.__hostState.displayMode } });
        return;
      }

      if (msg.id !== undefined) {
        postToApp({ jsonrpc: "2.0", id: msg.id, result: {} });
      }
    });
  </script>
</body>
</html>`;
}

async function createFixtureBids(repoRoot) {
  const bidRefMod = await import(pathToFileURL(path.join(repoRoot, "dist/domain/bid-ref.js")).href);
  const rawBids = [
    {
      resultId: 1,
      key: "KKJ-2026-46201-0311",
      projectName: "鹿児島市 学校教育情報システム 保守運用業務",
      organizationName: "鹿児島市",
      prefectureName: "鹿児島県",
      cityName: "鹿児島市",
      category: "役務",
      procedureType: "一般競争入札",
      cftIssueDate: "2026-07-21",
      tenderSubmissionDeadline: "2026-12-15T17:00:00+09:00",
      openingTendersEvent: "2026-12-20T14:00:00+09:00",
      externalDocumentUri: "https://www.pref.kagoshima.jp/docs/notice_0311.pdf",
      fileType: "pdf",
      fileSize: 486912,
    },
    {
      resultId: 2,
      key: "KKJ-2026-13100-0205",
      projectName: "東京都 クラウド基盤セキュリティ監査業務",
      organizationName: "東京都デジタルサービス局",
      prefectureName: "東京都",
      cityName: "新宿区",
      category: "役務",
      procedureType: "一般競争入札",
      cftIssueDate: "2026-07-22",
      tenderSubmissionDeadline: "2026-12-18T17:00:00+09:00",
      openingTendersEvent: "2026-12-22T10:00:00+09:00",
      externalDocumentUri: "https://www.metro.tokyo.lg.jp/docs/notice_0205.pdf",
      fileType: "pdf",
      fileSize: 271360,
    },
    {
      resultId: 3,
      key: "KKJ-2026-46215-0102",
      projectName: "霧島市 上下水道台帳システム更新業務",
      organizationName: "霧島市",
      prefectureName: "鹿児島県",
      cityName: "霧島市",
      category: "物品",
      procedureType: "一般競争入札",
      cftIssueDate: "2026-07-20",
      tenderSubmissionDeadline: "2026-12-25T17:00:00+09:00",
      openingTendersEvent: "2026-12-28T13:30:00+09:00",
      externalDocumentUri: "https://www.city.kirishima.lg.jp/docs/notice_0102.pdf",
      fileType: "pdf",
      fileSize: 158720,
    },
  ];
  return rawBids.map((bid) => ({
    ...bid,
    bidRef: bidRefMod.signBidRef(bid, { fetchedAt: "2026-11-16T00:00:00.000Z" }),
  }));
}

async function launchOfflineHeadlessChrome(browserPath, userDataDir) {
  const child = spawn(
    browserPath,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-client-side-phishing-detection",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-domain-reliability",
      "--disable-extensions",
      "--disable-sync",
      "--metrics-recording-only",
      "--safebrowsing-disable-auto-update",
      "--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1",
      "--remote-debugging-port=0",
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    {
      stdio: ["ignore", "ignore", "pipe"],
    },
  );

  const wsUrl = await new Promise((resolve, reject) => {
    let stderrBuf = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Timed out waiting for Chrome DevTools wsUrl. stderr=${stderrBuf}`));
    }, 30000);

    child.stderr.on("data", (chunk) => {
      stderrBuf += String(chunk);
      const match =
        /DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\r\n]+)/.exec(
          stderrBuf,
        );
      if (match?.[1]) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });

    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Browser exited prematurely with code ${code}. stderr=${stderrBuf}`));
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

  return { child, wsUrl };
}

/**
 * Executes the full MCP Apps UI runtime & DOM interaction suite against `htmlBundleText`
 * (or `htmlPath`). Returns structured pass/fail results for T08-C, T08-D, and T08-E.
 */
export async function verifyUiBrowserAcceptance(options = {}) {
  const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT;
  const htmlPath = options.htmlPath ?? path.join(repoRoot, "dist/apps/search-results.html");
  const htmlText = options.htmlText ?? (await readFile(htmlPath, "utf8"));
  const htmlSha256 = createHash("sha256").update(htmlText).digest("hex");
  const screenshotDir = options.screenshotDir ?? null;
  const injectBrokenSelectionFault = Boolean(options.injectBrokenSelectionFault);

  // Step 1: Deterministic Node VM module evaluation gate
  const vmGate = evaluateInlineModuleInVm(htmlText);
  if (!vmGate.ok) {
    return {
      ok: false,
      failedStage: "vm_module_gate",
      htmlSha256,
      htmlBytes: Buffer.byteLength(htmlText, "utf8"),
      vmGate,
      browserExecuted: false,
      uncaughtExceptions: [vmGate.error],
      checks: {
        startupAndWelcome: false,
        keyboardExampleChipSearch: false,
        populatedCardsRendered: false,
        zeroHitEmptyStateRendered: false,
        lightDarkThemeSwitched: false,
        narrowMobileViewportResponsive: false,
        selectionRankOrderPreserved: false,
        tier1DownloadCsv16Col: false,
        tier3ManualExportCsvFallback: false,
        tier3ManualExportJsonFallback: false,
        noStoppedProButtons: false,
      },
      failureReason: `Bundled module failed VM startup evaluation: ${vmGate.error}`,
    };
  }

  const browserPath = findLocalBrowserExecutable();
  if (!browserPath) {
    return {
      ok: false,
      failedStage: "browser_unavailable",
      htmlSha256,
      htmlBytes: Buffer.byteLength(htmlText, "utf8"),
      vmGate,
      browserExecuted: false,
      uncaughtExceptions: ["No local Chrome/Edge binary found for headless DOM verification"],
      checks: {},
      failureReason: "No local Chrome/Edge binary found",
    };
  }

  const fixtureBids = await createFixtureBids(repoRoot);
  const hostHtml = buildMockHostHtml(fixtureBids);

  const server = createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname === "/" || pathname === "/host.html") {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(hostHtml);
      return;
    }
    if (pathname === "/search-results.html") {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(htmlText);
      return;
    }
    if (pathname === "/favicon.ico") {
      res.writeHead(204).end();
      return;
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const harnessPort = server.address().port;

  const userDataDir = await mkdtemp(path.join(tmpdir(), "jp-bids-ui-accept-"));
  let chromeProc = null;
  let cdp = null;

  const uncaughtExceptions = [];
  const screenshotsSaved = [];

  try {
    if (screenshotDir) {
      await mkdir(screenshotDir, { recursive: true });
    }

    const launched = await launchOfflineHeadlessChrome(browserPath, userDataDir);
    chromeProc = launched.child;
    cdp = await CdpClient.connect(launched.wsUrl);

    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });

    let iframeSessionId = null;
    const defaultContextByFrameId = new Map();

    cdp.on("Target.attachedToTarget", (params, parentSessionId) => {
      if (parentSessionId !== sessionId) return;
      if (params.targetInfo?.type === "iframe" && params.sessionId) {
        iframeSessionId = params.sessionId;
        void cdp.send("Runtime.enable", {}, params.sessionId).catch(() => {});
      }
    });

    cdp.on("Runtime.executionContextCreated", (params, evtSessionId) => {
      if (evtSessionId !== sessionId && evtSessionId !== iframeSessionId) return;
      const ctx = params.context;
      if (ctx?.auxData?.isDefault && ctx.auxData.frameId) {
        defaultContextByFrameId.set(ctx.auxData.frameId, {
          contextId: ctx.id,
          sessionId: evtSessionId,
        });
      }
    });

    cdp.on("Runtime.exceptionThrown", (params, evtSessionId) => {
      if (evtSessionId !== sessionId && evtSessionId !== iframeSessionId) return;
      const details = params.exceptionDetails;
      const desc =
        details?.exception?.description ||
        details?.exception?.value ||
        details?.text ||
        "Uncaught runtime exception";
      uncaughtExceptions.push(String(desc));
    });

    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send(
      "Target.setAutoAttach",
      { autoAttach: true, waitForDebuggerOnStart: false, flatten: true },
      sessionId,
    );
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: 1280, height: 880, deviceScaleFactor: 2, mobile: false },
      sessionId,
    );
    await cdp.send(
      "Emulation.setEmulatedMedia",
      { features: [{ name: "prefers-color-scheme", value: "light" }] },
      sessionId,
    );

    await cdp.send(
      "Page.navigate",
      { url: `http://127.0.0.1:${harnessPort}/host.html` },
      sessionId,
    );

    const evalHost = async (expression) => {
      const res = await cdp.send(
        "Runtime.evaluate",
        { expression, returnByValue: true, awaitPromise: true },
        sessionId,
      );
      if (res.exceptionDetails) {
        throw new Error(
          `Host eval failed: ${res.exceptionDetails.exception?.description ?? res.exceptionDetails.text}`,
        );
      }
      return res.result?.value;
    };

    const evalIframe = async (expression) => {
      if (iframeSessionId) {
        const res = await cdp.send(
          "Runtime.evaluate",
          { expression, returnByValue: true, awaitPromise: true },
          iframeSessionId,
        );
        if (res.exceptionDetails) {
          throw new Error(
            `Iframe eval failed: ${res.exceptionDetails.exception?.description ?? res.exceptionDetails.text}`,
          );
        }
        return res.result?.value;
      }
      const tree = await cdp.send("Page.getFrameTree", {}, sessionId);
      const childFrame = tree.frameTree?.childFrames?.[0]?.frame;
      if (!childFrame?.id) {
        throw new Error("Sandboxed iframe frameId not found in Page.getFrameTree");
      }
      const entry = defaultContextByFrameId.get(childFrame.id);
      if (!entry) {
        throw new Error(`Default executionContextId not yet registered for frame ${childFrame.id}`);
      }
      const res = await cdp.send(
        "Runtime.evaluate",
        { contextId: entry.contextId, expression, returnByValue: true, awaitPromise: true },
        entry.sessionId,
      );
      if (res.exceptionDetails) {
        throw new Error(
          `Iframe eval failed: ${res.exceptionDetails.exception?.description ?? res.exceptionDetails.text}`,
        );
      }
      return res.result?.value;
    };

    const capturePng = async (filename) => {
      if (!screenshotDir) return;
      const shot = await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId);
      const outPath = path.join(screenshotDir, filename);
      await writeFile(outPath, Buffer.from(shot.data, "base64"));
      screenshotsSaved.push(filename);
    };

    // Wait up to 4s for MCP Apps handshake + Welcome screen mount (or fail fast on uncaught exception)
    let startupInfo = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (uncaughtExceptions.length > 0) {
        return {
          ok: false,
          failedStage: "browser_startup_exception",
          htmlSha256,
          htmlBytes: Buffer.byteLength(htmlText, "utf8"),
          vmGate,
          browserExecuted: true,
          uncaughtExceptions,
          checks: {
            startupAndWelcome: false,
          },
          failureReason: `Uncaught runtime exception during iframe startup: ${uncaughtExceptions.join(" | ")}`,
        };
      }
      try {
        const initialized = await evalHost("Boolean(window.__hostState?.initialized)");
        if (initialized) {
          startupInfo = await evalIframe(`(() => {
            const root = document.getElementById("root");
            const chips = [...document.querySelectorAll("button.example-chip")];
            return {
              lang: document.documentElement.getAttribute("lang"),
              iframeOrigin: window.origin,
              rootChildCount: root ? root.childElementCount : 0,
              hasWorkspace: Boolean(document.querySelector("main.workspace")),
              hasWelcome: Boolean(document.querySelector(".welcome-screen")),
              chipCount: chips.length,
              chipsEnabled: chips.length > 0 && chips.every((b) => !b.disabled && b.type === "button"),
              firstChipText: chips[0]?.textContent?.trim() || ""
            };
          })()`);
          if (startupInfo?.hasWorkspace && startupInfo?.hasWelcome && startupInfo.chipCount === 4) {
            break;
          }
        }
      } catch {
        // Wait for iframe load
      }
      await sleep(100);
    }

    const startupAndWelcome = Boolean(
      startupInfo &&
        uncaughtExceptions.length === 0 &&
        startupInfo.lang === "ja" &&
        startupInfo.iframeOrigin === "null" &&
        startupInfo.rootChildCount > 0 &&
        startupInfo.hasWorkspace &&
        startupInfo.hasWelcome &&
        startupInfo.chipCount === 4 &&
        startupInfo.chipsEnabled,
    );
    if (!startupAndWelcome) {
      return {
        ok: false,
        failedStage: "startup_welcome",
        htmlSha256,
        htmlBytes: Buffer.byteLength(htmlText, "utf8"),
        vmGate,
        browserExecuted: true,
        uncaughtExceptions,
        startupInfo,
        checks: { startupAndWelcome: false },
        failureReason:
          "Welcome screen or interactive example chips failed to mount in sandboxed iframe",
      };
    }
    await capturePng("01-startup-welcome.png");

    // Check B: Keyboard focus & Enter/click activation on first example chip -> triggers search_bids_app
    const focusAndActivateResult = await evalIframe(`(() => {
      const chip = document.querySelector("button.example-chip");
      if (!chip) return { focused: false };
      chip.focus();
      const isFocused = document.activeElement === chip;
      const keyEvt = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true });
      chip.dispatchEvent(keyEvt);
      chip.click();
      return { focused: isFocused, chipLabel: chip.textContent?.trim() || "" };
    })()`);

    // Wait for search_bids_app tool call & populated cards render
    let populatedInfo = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      populatedInfo = await evalIframe(`(() => {
        const cards = [...document.querySelectorAll(".bid-card")];
        const stoppedLabels = ["締切ICS", "検討メモ作成", "質問ドラフト", "メモ保存"];
        const bodyText = document.body.textContent || "";
        const foundStopped = stoppedLabels.filter((l) => bodyText.includes(l));
        return {
          searchInputVal: document.querySelector(".ws-search-input")?.value || "",
          cardCount: cards.length,
          cardTitles: cards.map((c) => c.querySelector(".card-project")?.textContent?.trim() || ""),
          workbenchTitle: document.querySelector(".workbench h2")?.textContent?.trim() || "",
          hasSafetyWarning: Boolean(document.querySelector(".safety-warning")),
          foundStopped
        };
      })()`);
      if (populatedInfo?.cardCount === 3) break;
      await sleep(100);
    }

    const firstToolCall = await evalHost("window.__hostState.toolCalls[0] || null");
    const keyboardExampleChipSearch = Boolean(
      focusAndActivateResult?.focused &&
        firstToolCall?.name === "search_bids_app" &&
        firstToolCall?.arguments?.query === "システム" &&
        firstToolCall?.arguments?.prefecture === "鹿児島県" &&
        populatedInfo?.searchInputVal === "システム",
    );
    const populatedCardsRendered = Boolean(
      populatedInfo?.cardCount === 3 &&
        populatedInfo.cardTitles[0] === fixtureBids[0].projectName &&
        populatedInfo.workbenchTitle === fixtureBids[0].projectName &&
        populatedInfo.hasSafetyWarning &&
        populatedInfo.foundStopped.length === 0,
    );
    await capturePng("02-populated-results.png");

    // Check D: 0-hit empty state rendering
    await evalHost('window.__pushToolResult([], { query: "該当なしテスト", limit: 20 })');
    let emptyStateInfo = null;
    for (let attempt = 0; attempt < 25; attempt++) {
      emptyStateInfo = await evalIframe(`(() => ({
        cardCount: document.querySelectorAll(".bid-card").length,
        laneEmptyText: document.querySelector(".lane-empty")?.textContent?.trim() || "",
        workbenchEmptyText: document.querySelector(".workbench.empty")?.textContent?.trim() || ""
      }))()`);
      if (emptyStateInfo?.cardCount === 0 && emptyStateInfo.laneEmptyText.includes("0件")) break;
      await sleep(80);
    }
    const zeroHitEmptyStateRendered = Boolean(
      emptyStateInfo?.cardCount === 0 &&
        emptyStateInfo.laneEmptyText.includes("該当する入札公告はありません（0件）") &&
        emptyStateInfo.workbenchEmptyText.includes(
          "条件に一致する入札公告は見つかりませんでした（0件）",
        ),
    );
    await capturePng("03-zero-hit-empty-state.png");

    // Restore populated 3-bid state
    await evalHost("window.__pushToolResult(FIXTURE_BIDS, { query: 'システム', limit: 20 })");
    for (let attempt = 0; attempt < 25; attempt++) {
      const count = await evalIframe("document.querySelectorAll('.bid-card').length");
      if (count === 3) break;
      await sleep(80);
    }

    // Check E: Light & Dark theme switching via host-context-changed
    const lightThemeStyle = await evalIframe(`(() => ({
      dataTheme: document.documentElement.getAttribute("data-theme"),
      bg: getComputedStyle(document.body).backgroundColor
    }))()`);

    await evalHost('window.__pushHostTheme("dark")');
    let darkThemeStyle = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      darkThemeStyle = await evalIframe(`(() => ({
        dataTheme: document.documentElement.getAttribute("data-theme"),
        bg: getComputedStyle(document.body).backgroundColor
      }))()`);
      if (darkThemeStyle?.dataTheme === "dark" && darkThemeStyle.bg !== lightThemeStyle.bg) break;
      await sleep(80);
    }
    const lightDarkThemeSwitched = Boolean(
      darkThemeStyle?.dataTheme === "dark" &&
        lightThemeStyle?.bg &&
        darkThemeStyle?.bg &&
        darkThemeStyle.bg !== lightThemeStyle.bg,
    );
    await capturePng("04-dark-theme.png");

    // Return to light theme
    await evalHost('window.__pushHostTheme("light")');
    await sleep(100);

    // Check F: Narrow mobile viewport (390x844) responsive layout
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
      sessionId,
    );
    await sleep(150);
    const mobileMetrics = await evalIframe(`(() => {
      const wsBody = document.querySelector(".ws-body");
      const cols = wsBody ? getComputedStyle(wsBody).gridTemplateColumns.trim().split(/\\s+/) : [];
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        columnTrackCount: cols.length,
        laneMaxHeight: getComputedStyle(document.querySelector(".priority-lane")).maxHeight
      };
    })()`);
    const narrowMobileViewportResponsive = Boolean(
      mobileMetrics &&
        mobileMetrics.scrollWidth <= mobileMetrics.clientWidth + 1 &&
        mobileMetrics.columnTrackCount === 1 &&
        mobileMetrics.laneMaxHeight === "280px",
    );
    await capturePng("05-mobile-390x844.png");

    // Restore desktop viewport
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: 1280, height: 880, deviceScaleFactor: 2, mobile: false },
      sessionId,
    );
    await sleep(120);

    // Optional Fault 2 injection: sabotage checkbox click selection propagation
    if (injectBrokenSelectionFault) {
      await evalIframe(`(() => {
        document.addEventListener("click", (e) => {
          if (e.target && e.target.matches && e.target.matches(".card-checkbox")) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        }, true);
      })()`);
    }

    // Check G1: Select Bid #3 (index 2) then Bid #1 (index 0) and click `選択比較 (rank)`
    await evalIframe(`(() => {
      const boxes = [...document.querySelectorAll(".card-checkbox")];
      if (boxes[2]) boxes[2].click();
      if (boxes[0]) boxes[0].click();
    })()`);
    await sleep(100);

    const selectionCountText = await evalIframe(
      "document.querySelector('.selection-count')?.textContent?.trim() || ''",
    );

    await evalIframe(`(() => {
      const btn = [...document.querySelectorAll(".btn-batch")].find((b) => b.textContent?.includes("選択比較"));
      if (btn && !btn.disabled) btn.click();
    })()`);

    let rankToolCall = null;
    let rankedBadgeInfo = null;
    for (let attempt = 0; attempt < 25; attempt++) {
      rankToolCall = await evalHost(
        "window.__hostState.toolCalls.filter((c) => c.name === 'rank_bids').pop() || null",
      );
      rankedBadgeInfo = await evalIframe(`(() => {
        const cards = [...document.querySelectorAll(".bid-card")];
        return {
          card2Score: cards[2]?.querySelector(".card-score")?.textContent?.trim() || "",
          card0Score: cards[0]?.querySelector(".card-score")?.textContent?.trim() || ""
        };
      })()`);
      if (rankToolCall && rankedBadgeInfo?.card2Score === "88点") break;
      await sleep(80);
    }

    const expectedSelectedRefs = [fixtureBids[2].bidRef, fixtureBids[0].bidRef];
    const selectionRankOrderPreserved = Boolean(
      selectionCountText === "2 件選択中" &&
        rankToolCall &&
        Array.isArray(rankToolCall.arguments?.bid_refs) &&
        rankToolCall.arguments.bid_refs.length === 2 &&
        rankToolCall.arguments.bid_refs[0] === expectedSelectedRefs[0] &&
        rankToolCall.arguments.bid_refs[1] === expectedSelectedRefs[1] &&
        rankedBadgeInfo?.card2Score === "88点" &&
        rankedBadgeInfo?.card0Score === "62点",
    );
    if (!selectionRankOrderPreserved && injectBrokenSelectionFault) {
      return {
        ok: false,
        failedStage: "selection_comparison_fault_detected",
        htmlSha256,
        htmlBytes: Buffer.byteLength(htmlText, "utf8"),
        vmGate,
        browserExecuted: true,
        uncaughtExceptions,
        selectionCountText,
        expectedSelectedRefs,
        actualRankCall: rankToolCall,
        checks: {
          startupAndWelcome,
          keyboardExampleChipSearch,
          populatedCardsRendered,
          zeroHitEmptyStateRendered,
          lightDarkThemeSwitched,
          narrowMobileViewportResponsive,
          selectionRankOrderPreserved: false,
        },
        failureReason: `Selection comparison failed: selectionCount='${selectionCountText}', rankToolCall=${JSON.stringify(rankToolCall)}`,
      };
    }
    await capturePng("06-selection-ranked.png");

    // Check G2: Tier-1 CSV export via host `ui/download-file`
    await evalIframe(`(() => {
      const btn = [...document.querySelectorAll(".btn-batch")].find((b) => b.textContent?.trim() === "選択CSV");
      if (btn && !btn.disabled) btn.click();
    })()`);

    let tier1Download = null;
    for (let attempt = 0; attempt < 25; attempt++) {
      tier1Download = await evalHost("window.__hostState.downloads[0]?.[0]?.resource || null");
      if (tier1Download) break;
      await sleep(80);
    }

    const tier1Text = typeof tier1Download?.text === "string" ? tier1Download.text : "";
    const tier1CleanLines = tier1Text
      .replace(/^\ufeff/, "")
      .trim()
      .split(/\r?\n/);
    const tier1DownloadCsv16Col = Boolean(
      tier1Download?.mimeType === "text/csv;charset=utf-8" &&
        tier1Text.startsWith("\ufeff") &&
        tier1CleanLines.length === 3 &&
        tier1CleanLines[0] === EXPECTED_16_COLUMNS.join(",") &&
        tier1CleanLines[1]?.includes(fixtureBids[2].key) &&
        tier1CleanLines[2]?.includes(fixtureBids[0].key),
    );

    // Check G3: Tier-3 ManualExportPanel fallback when BOTH downloadFile and clipboard.writeText fail
    await evalHost("window.__hostState.denyDownload = true; true;");
    await evalIframe(`(() => {
      const denyClipboard = () =>
        Promise.reject(new DOMException("Clipboard write blocked in sandbox", "NotAllowedError"));
      try {
        if (navigator.clipboard) {
          Object.defineProperty(navigator.clipboard, "writeText", {
            value: denyClipboard,
            configurable: true
          });
        } else {
          Object.defineProperty(navigator, "clipboard", {
            value: { writeText: denyClipboard },
            configurable: true
          });
        }
      } catch {
        Object.defineProperty(navigator, "clipboard", {
          value: { writeText: denyClipboard },
          configurable: true
        });
      }
    })()`);

    await evalIframe(`(() => {
      const btn = [...document.querySelectorAll(".btn-batch")].find((b) => b.textContent?.trim() === "選択CSV");
      if (btn && !btn.disabled) btn.click();
    })()`);

    let manualCsvInfo = null;
    for (let attempt = 0; attempt < 25; attempt++) {
      manualCsvInfo = await evalIframe(`(() => {
        const panel = document.querySelector(".manual-export-panel");
        const ta = document.querySelector(".manual-export-textarea");
        if (!panel || !ta) return null;
        const selectBtn = [...panel.querySelectorAll("button")].find((b) => b.textContent?.includes("全選択"));
        if (selectBtn) selectBtn.click();
        return {
          headerText: panel.querySelector(".manual-export-header strong")?.textContent?.trim() || "",
          value: ta.value,
          selectionStart: ta.selectionStart,
          selectionEnd: ta.selectionEnd,
          diagStage: window.__lastExportDiagnostic?.stage || null
        };
      })()`);
      if (manualCsvInfo?.value) break;
      await sleep(80);
    }

    const manualCsvLines = (manualCsvInfo?.value ?? "").trim().split(/\r?\n/);
    const tier3ManualExportCsvFallback = Boolean(
      manualCsvInfo?.headerText.includes("CSV 手動取得欄 (2件)") &&
        manualCsvInfo.diagStage === "manual_fallback" &&
        manualCsvLines.length === 3 &&
        manualCsvLines[0] === EXPECTED_16_COLUMNS.join(",") &&
        manualCsvInfo.selectionStart === 0 &&
        manualCsvInfo.selectionEnd === manualCsvInfo.value.length,
    );
    await capturePng("07-manual-export-csv-fallback.png");

    // Check G4: Tier-3 ManualExportPanel JSON fallback
    await evalIframe(`(() => {
      const btn = [...document.querySelectorAll(".btn-batch")].find((b) => b.textContent?.trim() === "選択JSON");
      if (btn && !btn.disabled) btn.click();
    })()`);

    let manualJsonInfo = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      manualJsonInfo = await evalIframe(`(() => {
        const panel = document.querySelector(".manual-export-panel");
        const ta = document.querySelector(".manual-export-textarea");
        if (!panel || !ta) return null;
        const headerText = panel.querySelector(".manual-export-header strong")?.textContent?.trim() || "";
        if (!headerText.includes("JSON")) return null;
        return {
          headerText,
          value: ta.value,
          diagStage: window.__lastExportDiagnostic?.stage || null
        };
      })()`);
      if (manualJsonInfo?.value) break;
      await sleep(80);
    }

    let parsedManualJson = null;
    try {
      parsedManualJson = JSON.parse(manualJsonInfo?.value ?? "null");
    } catch {
      parsedManualJson = null;
    }
    const tier3ManualExportJsonFallback = Boolean(
      manualJsonInfo?.headerText.includes("JSON 手動取得欄 (2件)") &&
        manualJsonInfo.diagStage === "manual_fallback" &&
        Array.isArray(parsedManualJson) &&
        parsedManualJson.length === 2 &&
        parsedManualJson[0]?.key === fixtureBids[2].key &&
        parsedManualJson[1]?.key === fixtureBids[0].key &&
        Object.keys(parsedManualJson[0] ?? {}).length === 16,
    );
    await capturePng("08-manual-export-json-fallback.png");

    // Settle React state before Check G5 so export works deterministically even when screenshot capture is off
    await sleep(120);

    // Check G5: Corrupted 10-column CSV response must be rejected with tool_call_error (never rendered in ManualExportPanel)
    await evalHost("window.__hostState.corruptCsv = true; true;");
    await evalIframe(`(() => {
      const btn = [...document.querySelectorAll(".btn-batch")].find((b) => b.textContent?.trim() === "選択CSV");
      if (btn && !btn.disabled) btn.click();
    })()`);

    let corruptCsvGuardInfo = null;
    for (let attempt = 0; attempt < 35; attempt++) {
      corruptCsvGuardInfo = await evalIframe(`(() => ({
        panelPresent: Boolean(document.querySelector(".manual-export-panel")),
        noticeText: [...document.querySelectorAll(".notice")].map((n) => n.textContent?.trim() || "").join(" | "),
        diagStage: window.__lastExportDiagnostic?.stage || null
      }))()`);
      if (
        corruptCsvGuardInfo?.diagStage === "tool_call_error" &&
        corruptCsvGuardInfo.panelPresent === false &&
        corruptCsvGuardInfo.noticeText.includes("16列")
      ) {
        break;
      }
      await sleep(80);
    }
    const corruptedCsvRejectedCleanly = Boolean(
      corruptCsvGuardInfo &&
        corruptCsvGuardInfo.panelPresent === false &&
        corruptCsvGuardInfo.diagStage === "tool_call_error" &&
        corruptCsvGuardInfo.noticeText.includes("16列"),
    );

    const checks = {
      startupAndWelcome,
      keyboardExampleChipSearch,
      populatedCardsRendered,
      zeroHitEmptyStateRendered,
      lightDarkThemeSwitched,
      narrowMobileViewportResponsive,
      selectionRankOrderPreserved,
      tier1DownloadCsv16Col,
      tier3ManualExportCsvFallback,
      tier3ManualExportJsonFallback,
      corruptedCsvRejectedCleanly,
      noStoppedProButtons: populatedInfo?.foundStopped?.length === 0,
      zeroUncaughtExceptions: uncaughtExceptions.length === 0,
    };

    const allChecksPass = Object.values(checks).every(Boolean);

    return {
      ok: allChecksPass,
      failedStage: allChecksPass ? null : "dom_interaction_assertion",
      htmlSha256,
      htmlBytes: Buffer.byteLength(htmlText, "utf8"),
      vmGate,
      browserExecuted: true,
      browserBinary: path.basename(browserPath),
      sandboxAttribute: "allow-scripts",
      iframeOrigin: startupInfo?.iframeOrigin ?? null,
      uncaughtExceptions,
      screenshotsSaved,
      measurements: {
        startupInfo,
        populatedCardCount: populatedInfo?.cardCount ?? 0,
        emptyCardCount: emptyStateInfo?.cardCount ?? -1,
        lightBg: lightThemeStyle?.bg ?? null,
        darkBg: darkThemeStyle?.bg ?? null,
        mobileViewport: mobileMetrics,
        selectedOrderSentToRank: rankToolCall?.arguments?.bid_refs?.length ?? 0,
        tier1CsvRowCount: tier1CleanLines.length - 1,
        manualCsvRowCount: manualCsvLines.length - 1,
        manualJsonItemCount: Array.isArray(parsedManualJson) ? parsedManualJson.length : 0,
        corruptCsvGuardStage: corruptCsvGuardInfo?.diagStage ?? null,
      },
      checks,
      failureReason: allChecksPass
        ? null
        : `Failed UI browser checks: ${Object.entries(checks)
            .filter(([, v]) => !v)
            .map(([k]) => k)
            .join(", ")}`,
    };
  } finally {
    if (cdp) cdp.close();
    if (chromeProc) {
      try {
        chromeProc.kill();
      } catch {
        // Ignore
      }
    }
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        server.closeAllConnections();
        resolve();
      }, 1000);
      server.close(() => {
        clearTimeout(timer);
        resolve();
      });
      server.closeAllConnections();
    });
    await sleep(150);
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const screenshotArg = process.env.UI_ACCEPTANCE_SCREENSHOT_DIR || undefined;
  verifyUiBrowserAcceptance({ screenshotDir: screenshotArg })
    .then((report) => {
      process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
      process.exit(report.ok ? 0 : 1);
    })
    .catch((err) => {
      process.stderr.write(
        `Fatal UI acceptance error: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(1);
    });
}
