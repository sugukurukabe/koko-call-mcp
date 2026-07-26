/**
 * MCP Apps UI の決定的スクリーンショット取得。
 * scripts/apps-harness/host.html（モックホスト）越しに本番バンドルを描画し、CDP で撮影する。
 * 本番コードには一切手を入れないので、撮れた画面は実際に配信されるUIそのものである。
 *
 * Deterministic screenshots of the MCP Apps UI. Renders the production bundle
 * behind scripts/apps-harness/host.html (a mock host) and captures over CDP.
 * The production code is never modified, so the captures are the shipped UI.
 *
 * Tangkapan layar deterministik UI MCP Apps. Merender bundel production di
 * belakang host tiruan dan menangkap melalui CDP tanpa mengubah kode production.
 *
 * 使い方 / Usage / Penggunaan:
 *   npm run build:ui
 *   npx tsx scripts/apps-harness/capture.ts
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

interface Shot {
  file: string;
  query: string;
  width: number;
  height: number;
  colorScheme: "light" | "dark";
}

const shots: Shot[] = [
  {
    file: "01-welcome.png",
    query: "?autoResult=0",
    width: 1280,
    height: 880,
    colorScheme: "light",
  },
  { file: "02-workspace.png", query: "", width: 1280, height: 880, colorScheme: "light" },
  {
    file: "03-evidence.png",
    query: "?openEvidence=1",
    width: 1280,
    height: 880,
    colorScheme: "light",
  },
  { file: "04-dark.png", query: "", width: 1280, height: 880, colorScheme: "dark" },
  { file: "05-mobile.png", query: "", width: 420, height: 860, colorScheme: "light" },
  {
    file: "06-fallback.png",
    query: "?denyMessage=1&clickAction=%E8%AA%AD%E3%82%80",
    width: 1280,
    height: 880,
    colorScheme: "light",
  },
];

const chromePath =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const harnessPort = Number(process.env.HARNESS_PORT ?? 8899);
const debugPort = Number(process.env.CHROME_DEBUG_PORT ?? 9333);
const outDir = fileURLToPath(new URL("../../images/mcp-apps-bid-workspace/", import.meta.url));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDevtools(): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      const info = (await response.json()) as { webSocketDebuggerUrl: string };
      return info.webSocketDebuggerUrl;
    } catch {
      await sleep(200);
    }
  }
  throw new Error("Chrome DevTools endpoint did not become available");
}

class CdpSession {
  private nextId = 1;
  private readonly pending = new Map<number, (result: unknown) => void>();

  private constructor(private readonly socket: WebSocket) {}

  static async connect(url: string): Promise<CdpSession> {
    const socket = new WebSocket(url);
    const session = new CdpSession(socket);
    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(String(event.data)) as { id?: number; result?: unknown };
      if (payload.id === undefined) return;
      const resolve = session.pending.get(payload.id);
      if (!resolve) return;
      session.pending.delete(payload.id);
      resolve(payload.result);
    });
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("CDP socket error")), { once: true });
    });
    return session;
  }

  send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
  ): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve) => {
      this.pending.set(id, (result) => resolve(result as T));
      this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  close(): void {
    this.socket.close();
  }
}

const server = createServer(async (req, res) => {
  const { readFile } = await import("node:fs/promises");
  const { extname, join } = await import("node:path");
  const harnessDir = fileURLToPath(new URL(".", import.meta.url));
  const appsDir = fileURLToPath(new URL("../../dist/apps/", import.meta.url));
  const pathname = new URL(req.url ?? "/", `http://127.0.0.1:${harnessPort}`).pathname;
  const relative = pathname.replace(/^\/+/, "") || "host.html";
  if (relative.includes("..")) {
    res.writeHead(400).end("bad request");
    return;
  }
  for (const dir of [harnessDir, appsDir]) {
    try {
      const body = await readFile(join(dir, relative));
      const types: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
      };
      res.writeHead(200, {
        "content-type": types[extname(relative)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(body);
      return;
    } catch {
      // 次の候補を試す / try the next candidate
    }
  }
  res.writeHead(404).end("not found");
});

await mkdir(outDir, { recursive: true });
await new Promise<void>((resolve) => server.listen(harnessPort, "127.0.0.1", resolve));

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--remote-debugging-port=${debugPort}`,
    "--user-data-dir=/tmp/jp-bids-apps-harness-profile",
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {
  const browserWsUrl = await waitForDevtools();
  const browser = await CdpSession.connect(browserWsUrl);
  const { targetId } = await browser.send<{ targetId: string }>("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await browser.send<{ sessionId: string }>("Target.attachToTarget", {
    targetId,
    flatten: true,
  });

  await browser.send("Page.enable", {}, sessionId);
  await browser.send("Runtime.enable", {}, sessionId);

  for (const shot of shots) {
    await browser.send(
      "Emulation.setDeviceMetricsOverride",
      { width: shot.width, height: shot.height, deviceScaleFactor: 2, mobile: false },
      sessionId,
    );
    await browser.send(
      "Emulation.setEmulatedMedia",
      { features: [{ name: "prefers-color-scheme", value: shot.colorScheme }] },
      sessionId,
    );
    await browser.send(
      "Page.navigate",
      { url: `http://127.0.0.1:${harnessPort}/host.html${shot.query}` },
      sessionId,
    );
    // ホストのハンドシェイクと tool result の反映を待つ
    // Wait for the host handshake and the tool result to land
    // Tunggu handshake host dan tool result diterapkan
    await sleep(1800);

    const { data } = await browser.send<{ data: string }>(
      "Page.captureScreenshot",
      { format: "png" },
      sessionId,
    );
    await writeFile(new URL(shot.file, `file://${outDir}`), Buffer.from(data, "base64"));
    console.error(`captured ${shot.file} (${shot.width}x${shot.height}, ${shot.colorScheme})`);
  }

  browser.close();
} finally {
  chrome.kill();
  server.close();
}
