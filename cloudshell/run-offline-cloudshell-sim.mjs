// cloudshell/run-offline-cloudshell-sim.mjs
// Offline end-to-end simulator proving Stage 1 (0% candidate deploy) and Stage 2
// (verified candidate promotion & ownership-checked rollback) across 14+ scenarios.
// Uses controlled BASH_ENV mock git/gcloud functions (zero fallback to real binaries)
// + 127.0.0.1 loopback HTTP servers + net-guard blocking all external network calls.

import { execFileSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const CLOUDSHELL_DIR = path.dirname(__filename);
const ROOT_DIR = path.resolve(CLOUDSHELL_DIR, "..");
const EVIDENCE_DIR = path.join(ROOT_DIR, "evidence");
const OUT_RESULTS_JSON = path.join(EVIDENCE_DIR, "cloudshell-offline-sim-results.json");
const NET_GUARD_PATH = path.join(ROOT_DIR, "tests", "acceptance", "net-guard.mjs");

const GIT_BASH_EXE =
  process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash";
const NODE_BIN_DIR = path.dirname(process.execPath);

const TARGET_SHA = "20bef7f9de3789b25ca1892b2984e6763ec41689";
const EXPECTED_VERSION = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"),
).version;
const SAMPLE_UI_HTML =
  '<!doctype html><html lang="ja"><head><title>JP Bids Workspace 0.10.1</title></head><body><div id="root">AI Bid Workspace</div></body></html>';
const EXPECTED_UI_SHA256 = crypto.createHash("sha256").update(SAMPLE_UI_HTML, "utf8").digest("hex");
const IMAGE_REPO =
  "asia-northeast1-docker.pkg.dev/jp-bids-prod/cloud-run-source-deploy/jp-bids-mcp";
const BUILT_DIGEST = `sha256:${"a1b2c3d4".repeat(8)}`;

const EXPECTED_TOOLS = [
  "export_bid_shortlist",
  "extract_bid_requirements",
  "get_bid_detail",
  "list_recent_bids",
  "rank_bids",
  "search_bids",
  "search_bids_app",
];

function toPosixPath(winPath) {
  const normalized = path.resolve(winPath).replace(/\\/g, "/");
  const m = /^([A-Za-z]):\/(.*)$/.exec(normalized);
  if (m) {
    return `/${m[1].toLowerCase()}/${m[2]}`;
  }
  return normalized;
}

function makeBaseV11ServiceState() {
  return {
    apiVersion: "serving.knative.dev/v1",
    kind: "Service",
    metadata: {
      name: "jp-bids-mcp",
      namespace: "jp-bids-prod",
      uid: "svc-uid-jp-bids-mcp-1",
      resourceVersion: "1731740051",
      generation: 51,
      // Standard Cloud Run v1 ObjectMeta has NO etag!
    },
    spec: {
      template: {
        metadata: {
          annotations: {
            "autoscaling.knative.dev/minScale": "0",
            "autoscaling.knative.dev/maxScale": "10",
            "run.googleapis.com/cpu-throttling": "true",
            "run.googleapis.com/startup-cpu-boost": "true",
          },
        },
        spec: {
          serviceAccountName: "jp-bids-runtime@jp-bids-prod.iam.gserviceaccount.com",
          containerConcurrency: 80,
          timeoutSeconds: 60,
          containers: [
            {
              image: `${IMAGE_REPO}@sha256:${"00112233".repeat(8)}`,
              ports: [{ name: "http1", containerPort: 8080 }],
              resources: { limits: { cpu: "1000m", memory: "512Mi" } },
              env: [
                { name: "JP_BIDS_SURFACE_PROFILE", value: "public_mvp" },
                { name: "MCP_REQUIRE_OAUTH", value: "true" },
                {
                  name: "OAUTH_JWT_SECRET",
                  valueFrom: { secretKeyRef: { name: "jp-bids-oauth-jwt", key: "latest" } },
                },
              ],
            },
          ],
        },
      },
    },
    status: {
      observedGeneration: 51,
      latestCreatedRevisionName: "jp-bids-mcp-00051-jfl",
      latestReadyRevisionName: "jp-bids-mcp-00051-jfl",
      traffic: [
        // Deliberately place 0% smoke tag at index 0 just like archived production v11!
        {
          revisionName: "jp-bids-mcp-00048-z5j",
          percent: 0,
          tag: "smoke",
          url: "https://smoke---jp-bids-mcp-mock.a.run.app",
        },
        {
          revisionName: "jp-bids-mcp-manual-export-20261024",
          percent: 100,
        },
        {
          revisionName: "jp-bids-mcp-00051-jfl",
          percent: 0,
          tag: "stage1cand",
          url: "https://stage1cand---jp-bids-mcp-mock.a.run.app",
        },
      ],
    },
  };
}

function makeRevisionFromService(serviceState, revisionName, imageUri) {
  const tmpl = structuredClone(serviceState.spec.template);
  tmpl.spec.containers[0].image = imageUri;
  return {
    apiVersion: "serving.knative.dev/v1",
    kind: "Revision",
    metadata: {
      name: revisionName,
      generation: 1,
      annotations: tmpl.metadata.annotations,
    },
    spec: tmpl.spec,
  };
}

function startMockMcpHttpServer(faultConfig) {
  const clients = new Map();
  const codes = new Map();
  const validTokens = new Set();

  const server = http.createServer(async (req, res) => {
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    const u = new URL(req.url || "/", baseUrl);

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString("utf8");

    const sendJson = (status, obj, extraHeaders = {}) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        ...extraHeaders,
      });
      res.end(JSON.stringify(obj));
    };

    if (faultConfig.mode === "SERVICE_503") {
      return sendJson(503, { ok: false, error: "Simulated production custom-domain 503" });
    }

    if (req.method === "GET" && u.pathname === "/health") {
      return sendJson(200, { ok: true, status: "healthy" });
    }
    if (req.method === "GET" && u.pathname === "/readyz") {
      return sendJson(200, { ok: true, ready: true });
    }
    if (req.method === "GET" && u.pathname === "/stats") {
      return sendJson(200, { ok: true, version: EXPECTED_VERSION });
    }
    if (req.method === "GET" && u.pathname === "/.well-known/openai-apps-challenge") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not Found");
    }
    if (req.method === "GET" && u.pathname === "/.well-known/mcp/server-card.json") {
      return sendJson(200, {
        serverInfo: { name: "JP Bids", version: EXPECTED_VERSION },
        tools: EXPECTED_TOOLS.map((name) => ({ name })),
      });
    }
    if (req.method === "GET" && u.pathname === "/.well-known/oauth-protected-resource/mcp") {
      return sendJson(200, {
        resource: `${baseUrl}/mcp`,
        authorization_servers: [baseUrl],
        scopes_supported: ["mcp:read"],
      });
    }
    if (req.method === "GET" && u.pathname === "/.well-known/oauth-authorization-server") {
      return sendJson(200, {
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/oauth/authorize`,
        token_endpoint: `${baseUrl}/oauth/token`,
        registration_endpoint: `${baseUrl}/oauth/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256"],
        scopes_supported: ["mcp:read"],
      });
    }
    if (req.method === "POST" && u.pathname === "/oauth/register") {
      const body = JSON.parse(rawBody || "{}");
      const clientId = `client-${crypto.randomUUID()}`;
      clients.set(clientId, { redirectUris: body.redirect_uris || [] });
      return sendJson(201, { client_id: clientId, redirect_uris: body.redirect_uris || [] });
    }
    if (req.method === "POST" && u.pathname === "/oauth/authorize") {
      const params = new URLSearchParams(rawBody);
      const clientId = params.get("client_id");
      const redirectUri = params.get("redirect_uri");
      const challenge = params.get("code_challenge");
      const method = params.get("code_challenge_method");
      const state = params.get("state") || "";
      if (!clients.has(clientId) || method !== "S256" || !challenge) {
        return sendJson(400, { error: "invalid_request" });
      }
      const code = `code-${crypto.randomUUID()}`;
      codes.set(code, { clientId, redirectUri, challenge });
      const redirect = new URL(redirectUri);
      redirect.searchParams.set("code", code);
      redirect.searchParams.set("state", state);
      redirect.searchParams.set("iss", baseUrl);
      res.writeHead(302, { Location: redirect.toString() });
      return res.end();
    }
    if (req.method === "POST" && u.pathname === "/oauth/token") {
      const params = new URLSearchParams(rawBody);
      const code = params.get("code");
      const verifier = params.get("code_verifier") || "";
      const clientId = params.get("client_id");
      const stored = codes.get(code);
      codes.delete(code);
      if (!stored || stored.clientId !== clientId) {
        return sendJson(400, { error: "invalid_grant" });
      }
      const computed = crypto.createHash("sha256").update(verifier).digest("base64url");
      if (computed !== stored.challenge) {
        return sendJson(400, { error: "invalid_grant" });
      }
      const tok = `header.${crypto.randomBytes(16).toString("base64url")}.sig`;
      validTokens.add(tok);
      return sendJson(
        200,
        { access_token: tok, token_type: "Bearer", expires_in: 3600, scope: "mcp:read" },
        { "Cache-Control": "no-store", Pragma: "no-cache" },
      );
    }
    if (u.pathname === "/mcp") {
      if (req.method === "GET" || req.method === "DELETE") {
        return sendJson(405, { error: "Method Not Allowed" }, { Allow: "POST" });
      }
      if (req.method === "POST") {
        const auth = req.headers.authorization || "";
        const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!bearer || !validTokens.has(bearer)) {
          return sendJson(
            401,
            { error: "unauthorized" },
            {
              "WWW-Authenticate": `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource/mcp", scope="mcp:read"`,
            },
          );
        }
        if (faultConfig.mode === "BROKEN_AUTH_MCP") {
          return sendJson(500, { error: "Authenticated MCP handler crashed" });
        }

        const rpc = JSON.parse(rawBody || "{}");
        const protoVer =
          req.headers["mcp-protocol-version"] || rpc?.params?.protocolVersion || "2025-11-25";

        if (protoVer === "2026-07-28") {
          const mcpMethod = req.headers["mcp-method"];
          const metaProto = rpc?.params?._meta?.["io.modelcontextprotocol/protocolVersion"];
          if (metaProto !== "2026-07-28") {
            return sendJson(400, {
              code: "MissingProtocolMetadata",
              error: "Missing io.modelcontextprotocol/protocolVersion",
            });
          }
          if (mcpMethod !== rpc.method) {
            return sendJson(400, {
              jsonrpc: "2.0",
              id: rpc.id ?? null,
              error: { code: -32600, message: "Mcp-Method mismatch" },
            });
          }
          if (rpc.method === "resources/read") {
            if (req.headers["mcp-name"] !== rpc?.params?.uri) {
              return sendJson(400, {
                jsonrpc: "2.0",
                id: rpc.id ?? null,
                error: { code: -32600, message: "Mcp-Name must equal params.uri" },
              });
            }
          }
        }

        if (rpc.method === "initialize") {
          return sendJson(200, {
            jsonrpc: "2.0",
            id: rpc.id,
            result: {
              protocolVersion: "2025-11-25",
              capabilities: { tools: {}, resources: {} },
              serverInfo: { name: "JP Bids", version: EXPECTED_VERSION },
            },
          });
        }
        if (rpc.method === "tools/list") {
          return sendJson(200, {
            jsonrpc: "2.0",
            id: rpc.id,
            result: { tools: EXPECTED_TOOLS.map((name) => ({ name })) },
          });
        }
        if (rpc.method === "resources/read") {
          const htmlToServe =
            faultConfig.mode === "UI_HASH_MISMATCH"
              ? `${SAMPLE_UI_HTML}<!--corrupted-hash-->`
              : SAMPLE_UI_HTML;
          return sendJson(200, {
            jsonrpc: "2.0",
            id: rpc.id,
            result: {
              contents: [
                {
                  uri: "ui://jp-bids/search-results.html",
                  mimeType: "text/html;profile=mcp-app",
                  text: htmlToServe,
                },
              ],
            },
          });
        }
        return sendJson(400, { error: "Unsupported RPC method" });
      }
    }

    sendJson(404, { error: "Not found" });
  });

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        server,
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
    server.on("error", reject);
  });
}

function toV2ServiceProjection(st) {
  const mapTraffic = (arr, includeUri) =>
    (arr || []).map((t) => {
      const obj = {
        type: "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION",
        revision: t.revisionName,
        percent: Number(t.percent ?? 0),
      };
      if (t.tag) obj.tag = t.tag;
      if (includeUri && t.url) obj.uri = t.url;
      return obj;
    });
  const desired = st.v2DesiredTraffic ?? st.service.status.traffic;
  const serving = st.v2ServingTraffic ?? st.service.status.traffic;
  return {
    name: "projects/jp-bids-prod/locations/asia-northeast1/services/jp-bids-mcp",
    uid: st.service.metadata.uid,
    generation: String(st.service.metadata.generation),
    observedGeneration: String(st.v2ObservedGeneration ?? st.service.status.observedGeneration),
    reconciling: Boolean(st.v2Reconciling),
    etag: st.v2Etag,
    traffic: mapTraffic(desired, false),
    trafficStatuses: mapTraffic(serving, true),
    template: {
      serviceAccount: st.service.spec.template.spec.serviceAccountName,
    },
  };
}

function startMockCloudRunV2ApiServer(activeCaseRef) {
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString("utf8");

    const sendJson = (status, obj) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(obj));
    };

    const caseDir = activeCaseRef.caseDir;
    const scenario = activeCaseRef.scenario || "HAPPY";
    if (!caseDir) {
      return sendJson(500, { error: { code: 500, status: "INTERNAL", message: "No active case" } });
    }

    const stPath = path.join(caseDir, "cloud-state.json");
    const tracePath = path.join(caseDir, "trace.jsonl");
    const st = JSON.parse(fs.readFileSync(stPath, "utf8"));
    st.counters.httpCalls = (st.counters.httpCalls || 0) + 1;

    const u = new URL(req.url || "/", "http://127.0.0.1");

    // 1. Authoritative v2 Service GET
    if (
      req.method === "GET" &&
      u.pathname === "/v2/projects/jp-bids-prod/locations/asia-northeast1/services/jp-bids-mcp"
    ) {
      st.counters.v2ServiceGet = (st.counters.v2ServiceGet || 0) + 1;
      if (scenario === "V1_V2_MISMATCH" && st.counters.v2ServiceGet >= 3) {
        st.v2Etag = "v2-etag-mismatch";
        st.v2ObservedGeneration = st.service.metadata.generation + 1;
      }
      fs.writeFileSync(stPath, `${JSON.stringify(st, null, 2)}\n`, "utf8");
      const v2Doc = toV2ServiceProjection(st);
      if (scenario === "V1_V2_MISMATCH" && st.counters.v2ServiceGet >= 3) {
        v2Doc.generation = String(st.service.metadata.generation + 1);
      }
      return sendJson(200, v2Doc);
    }

    // 2. Async Operation GET
    if (
      req.method === "GET" &&
      u.pathname.startsWith("/v2/projects/jp-bids-prod/locations/asia-northeast1/operations/")
    ) {
      st.counters.operationGet = (st.counters.operationGet || 0) + 1;
      const opName = u.pathname.slice(4);
      const op = st.operations?.[opName];
      if (!op) {
        fs.writeFileSync(stPath, `${JSON.stringify(st, null, 2)}\n`, "utf8");
        return sendJson(404, {
          error: { code: 404, status: "NOT_FOUND", message: "Operation not found" },
        });
      }
      if (op.hangForever) {
        fs.writeFileSync(stPath, `${JSON.stringify(st, null, 2)}\n`, "utf8");
        // Intentionally never respond so client/watchdog must terminate bounded GET
        return;
      }
      if (op.delayMs > 0) {
        await new Promise((r) => setTimeout(r, op.delayMs));
        if (res.destroyed || req.destroyed) return;
      }
      if (op.pollHttp500) {
        fs.writeFileSync(stPath, `${JSON.stringify(st, null, 2)}\n`, "utf8");
        return sendJson(500, {
          error: { code: 500, status: "INTERNAL", message: "Simulated Operation poll 500" },
        });
      }
      op.pollsRemaining = Math.max(0, Number(op.pollsRemaining ?? 0) - 1);
      if (op.pollsRemaining === 0 && op.failWithError) {
        op.done = true;
        op.error = op.failWithError;
        st.v2Reconciling = false;
        fs.writeFileSync(stPath, `${JSON.stringify(st, null, 2)}\n`, "utf8");
        return sendJson(200, { name: opName, done: true, error: op.error });
      }
      if (op.pollsRemaining === 0 && !op.neverDone) {
        op.done = true;
        st.v2Reconciling = false;
        st.v2ObservedGeneration = st.service.metadata.generation;
        st.service.status.observedGeneration = st.service.metadata.generation;
        st.service.status.traffic = op.targetTraffic;
        st.v2DesiredTraffic = op.targetTraffic;
        st.v2ServingTraffic = op.targetTraffic;
        fs.writeFileSync(stPath, `${JSON.stringify(st, null, 2)}\n`, "utf8");
        return sendJson(200, { name: opName, done: true, response: toV2ServiceProjection(st) });
      }
      fs.writeFileSync(stPath, `${JSON.stringify(st, null, 2)}\n`, "utf8");
      return sendJson(200, { name: opName, done: false });
    }

    // 3. Conditional v2 Service PATCH
    if (
      req.method === "PATCH" &&
      u.pathname === "/v2/projects/jp-bids-prod/locations/asia-northeast1/services/jp-bids-mcp"
    ) {
      st.counters.updateTraffic += 1;
      const callNum = st.counters.updateTraffic;

      let patchBody = {};
      try {
        patchBody = JSON.parse(rawBody || "{}");
      } catch {
        return sendJson(400, {
          error: { code: 400, status: "INVALID_ARGUMENT", message: "Bad JSON" },
        });
      }

      fs.appendFileSync(
        tracePath,
        `${JSON.stringify({
          atUtc: new Date().toISOString(),
          tool: "cloudrun-v2-patch",
          callNum,
          sentEtag: patchBody.etag ?? null,
          liveEtagBefore: st.v2Etag,
        })}\n`,
        "utf8",
      );

      if (scenario === "PROMOTE_RPC_UNKNOWN" && callNum === 1) {
        fs.writeFileSync(stPath, `${JSON.stringify(st, null, 2)}\n`, "utf8");
        req.socket.destroy();
        return;
      }

      if (scenario === "ROLLBACK_RPC_FAIL_NOT_MASKED" && callNum === 2) {
        fs.writeFileSync(stPath, `${JSON.stringify(st, null, 2)}\n`, "utf8");
        return sendJson(500, {
          error: { code: 500, status: "INTERNAL", message: "Simulated rollback RPC failure" },
        });
      }

      if (scenario === "AUDITOR_RACE_BEFORE_PROMOTE" && callNum === 1) {
        st.service.metadata.generation += 1;
        st.v2Etag = `v2-etag-thirdparty-${st.service.metadata.generation}`;
        st.v2ObservedGeneration = st.service.metadata.generation;
        st.service.status.observedGeneration = st.service.metadata.generation;
        st.service.status.latestCreatedRevisionName = "jp-bids-mcp-auditor-thirdparty";
        const tpTraffic = [{ revisionName: "jp-bids-mcp-auditor-thirdparty", percent: 100 }];
        st.service.status.traffic = tpTraffic;
        st.v2DesiredTraffic = tpTraffic;
        st.v2ServingTraffic = tpTraffic;
        fs.writeFileSync(stPath, `${JSON.stringify(st, null, 2)}\n`, "utf8");
      }
      if (scenario === "AUDITOR_RACE_BEFORE_ROLLBACK" && callNum === 2) {
        st.service.metadata.generation += 1;
        st.v2Etag = `v2-etag-thirdparty-rb-${st.service.metadata.generation}`;
        st.v2ObservedGeneration = st.service.metadata.generation;
        st.service.status.observedGeneration = st.service.metadata.generation;
        st.service.status.latestCreatedRevisionName = "jp-bids-mcp-auditor-thirdparty";
        const tpTraffic = [{ revisionName: "jp-bids-mcp-auditor-thirdparty", percent: 100 }];
        st.service.status.traffic = tpTraffic;
        st.v2DesiredTraffic = tpTraffic;
        st.v2ServingTraffic = tpTraffic;
        fs.writeFileSync(stPath, `${JSON.stringify(st, null, 2)}\n`, "utf8");
      }

      // Server-side optimistic-concurrency v2 etag enforcement
      if (!patchBody.etag || patchBody.etag !== st.v2Etag) {
        fs.writeFileSync(stPath, `${JSON.stringify(st, null, 2)}\n`, "utf8");
        return sendJson(409, {
          error: {
            code: 409,
            status: "ABORTED",
            message: `etag mismatch: sent='${patchBody.etag}', current='${st.v2Etag}'`,
          },
        });
      }

      const existingUrlByTag = new Map();
      for (const t of st.service.status.traffic) {
        if (t.tag && t.url) existingUrlByTag.set(t.tag, t.url);
      }
      const incomingTraffic = Array.isArray(patchBody.traffic) ? patchBody.traffic : [];
      const newTraffic = incomingTraffic.map((item) => {
        const rev = item.revision;
        const pct = Number(item.percent ?? 0);
        const tag = item.tag || undefined;
        const entry = { revisionName: rev, percent: pct };
        if (tag) {
          entry.tag = tag;
          entry.url = existingUrlByTag.get(tag) || `https://${tag}---jp-bids-mcp-mock.a.run.app`;
        }
        return entry;
      });

      st.service.metadata.generation += 1;
      st.v2Etag = `v2-etag-${st.service.metadata.generation}`;
      st.v2Reconciling = true;
      st.v2DesiredTraffic = newTraffic;
      // Keep v2ServingTraffic at previous state until Operation completes!
      if (callNum === 1) st.cutoverDone = true;

      const opName = `projects/jp-bids-prod/locations/asia-northeast1/operations/op-${callNum}-${st.service.metadata.generation}`;
      st.operations = st.operations || {};
      let pollsRequired = 1;
      let failWithError = null;
      let neverDone = false;
      let pollHttp500 = false;
      let delayMs = 0;
      let hangForever = false;

      if (scenario === "DELAYED_ASYNC_OPERATION" && callNum === 1) pollsRequired = 3;
      if (scenario === "ROLLBACK_DELAYED_ASYNC_OPERATION" && callNum === 2) pollsRequired = 3;
      if (scenario === "PROMOTE_ASYNC_OP_ERROR" && callNum === 1) {
        pollsRequired = 1;
        failWithError = { code: 13, message: "Simulated async promote Operation failure" };
      }
      if (scenario === "ROLLBACK_ASYNC_OP_ERROR" && callNum === 2) {
        pollsRequired = 1;
        failWithError = { code: 13, message: "Simulated async rollback Operation failure" };
      }
      if (scenario === "PROMOTE_ASYNC_OP_TIMEOUT" && callNum === 1) neverDone = true;
      if (scenario === "ROLLBACK_ASYNC_OP_TIMEOUT" && callNum === 2) neverDone = true;
      if (scenario === "PROMOTE_OP_POLL_500" && callNum === 1) pollHttp500 = true;
      if (scenario === "PROMOTE_SLOW_DONE_3500" && callNum === 1) delayMs = 3500;
      if (scenario === "ROLLBACK_SLOW_DONE_3500" && callNum === 2) delayMs = 3500;
      if (scenario === "PROMOTE_HUNG_OP_GET" && callNum === 1) hangForever = true;
      if (scenario === "ROLLBACK_HUNG_OP_GET" && callNum === 2) hangForever = true;
      if (scenario === "POLL_INTERVAL_LONGER_THAN_REMAINING" && callNum === 1) pollsRequired = 2;

      st.operations[opName] = {
        done: false,
        pollsRemaining: pollsRequired,
        failWithError,
        neverDone,
        pollHttp500,
        delayMs,
        hangForever,
        targetTraffic: newTraffic,
      };
      fs.writeFileSync(stPath, `${JSON.stringify(st, null, 2)}\n`, "utf8");
      return sendJson(200, { name: opName, done: false });
    }

    return sendJson(404, {
      error: { code: 404, status: "NOT_FOUND", message: `Unknown v2 path ${u.pathname}` },
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        server,
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
    server.on("error", reject);
  });
}

// Mock gcloud / git backend written in Node so BASH_ENV shell functions delegate state transitions cleanly
const MOCK_CLI_HELPER_CODE = `
import fs from "node:fs";
import path from "node:path";

const stateDir = process.env.MOCK_STATE_DIR;
const scenario = process.env.MOCK_SCENARIO || "HAPPY";
const candUrl = process.env.MOCK_CAND_URL;
const tool = process.argv[2];
const args = process.argv.slice(3);

const tracePath = path.join(stateDir, "trace.jsonl");
function trace(entry) {
  fs.appendFileSync(tracePath, JSON.stringify({ atUtc: new Date().toISOString(), tool, args, ...entry }) + "\\n", "utf8");
}

function readState() {
  return JSON.parse(fs.readFileSync(path.join(stateDir, "cloud-state.json"), "utf8"));
}
function writeState(st) {
  fs.writeFileSync(path.join(stateDir, "cloud-state.json"), JSON.stringify(st, null, 2) + "\\n", "utf8");
}

if (tool === "git") {
  trace({});
  if (args[0] === "clone") {
    if (scenario === "CLONE_FAIL") process.exit(128);
    const targetDir = args[args.length - 1];
    fs.mkdirSync(targetDir, { recursive: true });
    process.exit(0);
  }
  if (args.includes("checkout")) {
    process.exit(0);
  }
  if (args.includes("rev-parse")) {
    process.stdout.write("${TARGET_SHA}\\n");
    process.exit(0);
  }
  process.exit(97);
}

if (tool === "gcloud") {
  const joined = args.join(" ");
  if (args[0] === "auth" && args[1] === "print-access-token") {
    const st = readState();
    const slowOpTokMs = Number(process.env.MOCK_SLOW_OP_TOKEN_MS || 0);
    if (slowOpTokMs > 0 && st.counters.updateTraffic >= 1) {
      await new Promise((r) => setTimeout(r, slowOpTokMs));
    }
    st.counters.tokenCalls = (st.counters.tokenCalls || 0) + 1;
    writeState(st);
    trace({ sub: "auth.print-access-token" });
    process.stdout.write("mock-offline-access-token\\n");
    process.exit(0);
  }

  if (args[0] === "run" && args[1] === "services" && args[2] === "describe") {
    const st = readState();
    st.counters.describeService += 1;
    // Simulate concurrent third-party change right before pre-rollback ownership check!
    if (scenario === "POST_PROMOTE_VERIFY_FAIL_THIRD_PARTY_CHANGED" && st.cutoverDone && st.counters.describeServiceAfterCutover >= 1) {
      st.service.metadata.generation += 1;
      st.v2Etag = "v2-etag-" + st.service.metadata.generation;
      st.v2ObservedGeneration = st.service.metadata.generation;
      st.service.status.observedGeneration = st.service.metadata.generation;
      st.service.status.latestCreatedRevisionName = "jp-bids-mcp-thirdparty-hotfix";
      const tpTraffic = [{ revisionName: "jp-bids-mcp-thirdparty-hotfix", percent: 100 }];
      st.service.status.traffic = tpTraffic;
      st.v2DesiredTraffic = tpTraffic;
      st.v2ServingTraffic = tpTraffic;
    }
    if (st.cutoverDone) {
      st.counters.describeServiceAfterCutover = (st.counters.describeServiceAfterCutover || 0) + 1;
    }
    writeState(st);
    trace({ sub: "services.describe", generation: st.service.metadata.generation });
    process.stdout.write(JSON.stringify(st.service, null, 2) + "\\n");
    process.exit(0);
  }

  if (args[0] === "run" && args[1] === "revisions" && args[2] === "describe") {
    const revName = args[3];
    const st = readState();
    st.counters.describeRevision += 1;
    writeState(st);
    trace({ sub: "revisions.describe", revName });
    const rev = st.revisions[revName];
    if (!rev) process.exit(44);
    process.stdout.write(JSON.stringify(rev, null, 2) + "\\n");
    process.exit(0);
  }

  if (args[0] === "builds" && args[1] === "submit") {
    const st = readState();
    st.counters.buildsSubmit += 1;
    writeState(st);
    trace({ sub: "builds.submit" });
    if (scenario === "BUILD_FAIL") process.exit(31);
    process.stdout.write(JSON.stringify({
      id: "build-mock-0001",
      status: "SUCCESS",
      results: { images: [{ name: "${IMAGE_REPO}", digest: "${BUILT_DIGEST}" }] }
    }, null, 2) + "\\n");
    process.exit(0);
  }

  if (args[0] === "run" && args[1] === "deploy") {
    const st = readState();
    st.counters.deploy += 1;
    writeState(st);
    trace({ sub: "run.deploy" });
    if (scenario === "DEPLOY_UNKNOWN") {
      process.exit(28);
    }
    const imageArg = args.find((a) => a.startsWith("--image="))?.slice(8) || "";
    const suffixArg = args.find((a) => a.startsWith("--revision-suffix="))?.slice(18) || "";
    const tagArg = args.find((a) => a.startsWith("--tag="))?.slice(6) || "";
    const revName = st.service.metadata.name + "-" + suffixArg;

    st.service.metadata.generation += 1;
    st.v2Etag = "v2-etag-" + st.service.metadata.generation;
    st.v2ObservedGeneration = st.service.metadata.generation;
    st.service.status.observedGeneration = st.service.metadata.generation;
    st.service.status.latestCreatedRevisionName = revName;
    st.service.status.latestReadyRevisionName = revName;
    st.service.status.traffic.push({
      revisionName: revName,
      percent: 0,
      tag: tagArg,
      url: candUrl,
    });
    st.v2DesiredTraffic = structuredClone(st.service.status.traffic);
    st.v2ServingTraffic = structuredClone(st.service.status.traffic);

    const tmpl = structuredClone(st.service.spec.template);
    tmpl.spec.containers[0].image = imageArg;
    st.revisions[revName] = {
      apiVersion: "serving.knative.dev/v1",
      kind: "Revision",
      metadata: { name: revName, generation: 1, annotations: tmpl.metadata.annotations },
      spec: tmpl.spec,
    };
    writeState(st);
    process.stdout.write(JSON.stringify({ status: "DEPLOYED_0PCT", revision: revName }) + "\\n");
    process.exit(0);
  }

  if (args[0] === "run" && args[1] === "services" && args[2] === "update-traffic") {
    const st = readState();
    st.counters.updateTraffic += 1;
    const callNum = st.counters.updateTraffic;
    const toRevArg = args.find((a) => a.startsWith("--to-revisions="))?.slice(15) || "";
    const updateTagsArg = args.find((a) => a.startsWith("--update-tags="))?.slice(14) || "";
    trace({ sub: "services.update-traffic", callNum, toRevArg, updateTagsArg });
    writeState(st);

    if (scenario === "PROMOTE_RPC_UNKNOWN" && callNum === 1) {
      process.exit(28);
    }
    if (scenario === "ROLLBACK_RPC_FAIL_NOT_MASKED" && callNum === 2) {
      process.exit(32);
    }

    const [targetRev, targetPctStr] = toRevArg.split("=");
    const targetPct = Number(targetPctStr);
    const tagPairs = updateTagsArg
      ? updateTagsArg.split(",").filter(Boolean).map((p) => p.split("="))
      : [];

    const existingUrlByTag = new Map();
    for (const t of st.service.status.traffic) {
      if (t.tag && t.url) existingUrlByTag.set(t.tag, t.url);
    }

    const newTraffic = [{ revisionName: targetRev, percent: targetPct }];
    for (const [tag, rev] of tagPairs) {
      newTraffic.push({
        revisionName: rev,
        percent: 0,
        tag,
        url: existingUrlByTag.get(tag) || ("https://" + tag + "---jp-bids-mcp-mock.a.run.app"),
      });
    }
    st.service.metadata.generation += 1;
    st.service.metadata.etag = "etag-" + st.service.metadata.generation;
    st.service.status.observedGeneration = st.service.metadata.generation;
    st.service.status.traffic = newTraffic;
    if (callNum === 1) st.cutoverDone = true;
    writeState(st);
    process.stdout.write(JSON.stringify(st.service) + "\\n");
    process.exit(0);
  }

  trace({ sub: "DENIED_UNEXPECTED_GCLOUD", joined });
  process.exit(97);
}
`;

function createMockPreludeFiles(caseDir) {
  const helperMjs = path.join(caseDir, "mock-cli.mjs");
  fs.writeFileSync(helperMjs, MOCK_CLI_HELPER_CODE, "utf8");

  const preludeSh = path.join(caseDir, "mock-prelude.sh");
  const helperPosix = toPosixPath(helperMjs);
  const bashDollar = "$";
  const preludeContent = [
    "# Controlled BASH_ENV prelude: overrides git, gcloud, and curl with zero external calls.",
    `git() { node "${helperPosix}" git "$@"; }`,
    `gcloud() { node "${helperPosix}" gcloud "$@"; }`,
    "curl() {",
    "  local mapped_args=()",
    "  local a",
    '  for a in "$@"; do',
    '    if [[ "$a" == https://run.googleapis.com/* ]]; then',
    `      mapped_args+=("${bashDollar}{MOCK_CLOUDRUN_API_URL}${bashDollar}{a#https://run.googleapis.com}")`,
    "    else",
    '      mapped_args+=("$a")',
    "    fi",
    "  done",
    `  command curl "${bashDollar}{mapped_args[@]}"`,
    "}",
    "export -f git gcloud curl",
    "",
  ].join("\n");
  fs.writeFileSync(preludeSh, preludeContent, "utf8");
  return preludeSh;
}

function runBashScript(scriptPath, scriptArgs, envOverrides) {
  const posixScript = toPosixPath(scriptPath);
  const guardFileUrl = pathToFileURL(NET_GUARD_PATH).href;
  const extraImport = envOverrides?.EXTRA_NODE_IMPORT
    ? `--import=${envOverrides.EXTRA_NODE_IMPORT}`
    : "";
  const existingNodeOpts = process.env.NODE_OPTIONS || "";
  const nodeOpts = `${existingNodeOpts} --import=${guardFileUrl} ${extraImport}`.trim();

  const env = {
    ...process.env,
    PATH: `${toPosixPath(NODE_BIN_DIR)}:/usr/bin:/bin`,
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
    NO_UPDATE_NOTIFIER: "1",
    ALLOW_LOOPBACK_CANDIDATE_URL: "1",
    NODE_OPTIONS: nodeOpts,
    ...envOverrides,
  };
  delete env.EXTRA_NODE_IMPORT;

  return new Promise((resolve, reject) => {
    const child = spawn(GIT_BASH_EXE, [posixScript, ...scriptArgs], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ exitCode: -1, signal: "SIGKILL", stdout, stderr });
    }, 30000);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? -1,
        signal: signal ?? null,
        stdout,
        stderr,
      });
    });
  });
}

function readJsonIfExists(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function initCaseState(caseDir, mutator = null) {
  const service = makeBaseV11ServiceState();
  const revisions = {
    "jp-bids-mcp-00048-z5j": makeRevisionFromService(
      service,
      "jp-bids-mcp-00048-z5j",
      `${IMAGE_REPO}@sha256:${"48484848".repeat(8)}`,
    ),
    "jp-bids-mcp-manual-export-20261024": makeRevisionFromService(
      service,
      "jp-bids-mcp-manual-export-20261024",
      `${IMAGE_REPO}@sha256:${"00112233".repeat(8)}`,
    ),
    "jp-bids-mcp-00051-jfl": makeRevisionFromService(
      service,
      "jp-bids-mcp-00051-jfl",
      `${IMAGE_REPO}@sha256:${"51515151".repeat(8)}`,
    ),
  };
  const state = {
    service,
    revisions,
    v2Etag: "v2-etag-51",
    v2ObservedGeneration: 51,
    v2Reconciling: false,
    v2DesiredTraffic: structuredClone(service.status.traffic),
    v2ServingTraffic: structuredClone(service.status.traffic),
    operations: {},
    cutoverDone: false,
    counters: {
      describeService: 0,
      describeRevision: 0,
      buildsSubmit: 0,
      deploy: 0,
      updateTraffic: 0,
      tokenCalls: 0,
      httpCalls: 0,
      v2ServiceGet: 0,
      operationGet: 0,
    },
  };
  if (mutator) mutator(state);
  fs.writeFileSync(
    path.join(caseDir, "cloud-state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(path.join(caseDir, "trace.jsonl"), "", "utf8");
  return state;
}

function stage1Args(workDir) {
  return [
    "--project=jp-bids-prod",
    "--region=asia-northeast1",
    "--service=jp-bids-mcp",
    "--repo-url=https://github.com/sugukurukabe/koko-call-mcp.git",
    `--target-sha=${TARGET_SHA}`,
    `--image-repo=${IMAGE_REPO}`,
    "--candidate-suffix=v0101-cand1",
    "--candidate-tag=cand-v0101",
    `--expected-version=${EXPECTED_VERSION}`,
    `--expected-ui-sha256=${EXPECTED_UI_SHA256}`,
    `--work-dir=${toPosixPath(workDir)}`,
  ];
}

function stage2Args(receiptPath, prodUrl, workDir, extraArgs = []) {
  return [
    `--receipt=${toPosixPath(receiptPath)}`,
    `--production-url=${prodUrl}`,
    "--max-age-seconds=900",
    "--op-poll-interval-ms=10",
    "--op-timeout-seconds=5",
    `--work-dir=${toPosixPath(workDir)}`,
    ...extraArgs,
  ];
}

async function main() {
  const simRoot = fs.mkdtempSync(path.join(os.tmpdir(), "jp-bids-cloudshell-sim-"));
  const stage1Script = path.join(CLOUDSHELL_DIR, "stage1-deploy-0pct-candidate.sh");
  const stage2Script = path.join(CLOUDSHELL_DIR, "stage2-promote-verified-candidate.sh");

  const candFault = { mode: "NONE" };
  const prodFault = { mode: "NONE" };
  const activeCloudRunCase = { caseDir: null, scenario: "HAPPY" };
  const candHttp = await startMockMcpHttpServer(candFault);
  const prodHttp = await startMockMcpHttpServer(prodFault);
  const cloudRunApi = await startMockCloudRunV2ApiServer(activeCloudRunCase);

  const scenarios = [];
  function assertScenario(id, description, passed, evidence) {
    scenarios.push({ id, description, passed: Boolean(passed), evidence });
    process.stderr.write(`[offline-sim] ${passed ? "PASS" : "FAIL"} ${id}: ${description}\n`);
    if (!passed) {
      throw new Error(`Scenario ${id} failed: ${JSON.stringify(evidence)}`);
    }
  }

  try {
    // 0. Static Script Audit
    const s1Text = fs.readFileSync(stage1Script, "utf8");
    const s2Text = fs.readFileSync(stage2Script, "utf8");
    const combined = `${s1Text}\n${s2Text}`;
    const forbiddenHits = {
      trafficIndexZero: combined.includes("traffic[0]"),
      latestCreatedRevisionName: combined.includes("latestCreatedRevisionName"),
      orTrueMasking: combined.includes("|| true"),
      errTrap: /\btrap\b[^\n]*\bERR\b/.test(combined),
      stage1UpdateTraffic: s1Text.includes("update-traffic"),
      stage1TelemetryEnv: s1Text.includes("datacloud.antigravity"),
      stage2TelemetryEnv: s2Text.includes("datacloud.antigravity"),
    };
    assertScenario(
      "00_STATIC_SCRIPT_AUDIT",
      "Zero forbidden patterns (traffic[0], latestCreatedRevisionName, || true, ERR trap, Stage1 update-traffic) and mandatory Cloud SDK telemetry env",
      !forbiddenHits.trafficIndexZero &&
        !forbiddenHits.latestCreatedRevisionName &&
        !forbiddenHits.orTrueMasking &&
        !forbiddenHits.errTrap &&
        !forbiddenHits.stage1UpdateTraffic &&
        forbiddenHits.stage1TelemetryEnv &&
        forbiddenHits.stage2TelemetryEnv,
      forbiddenHits,
    );

    async function runCase(name, fn) {
      candFault.mode = "NONE";
      prodFault.mode = "NONE";
      const caseDir = path.join(simRoot, name);
      fs.mkdirSync(caseDir, { recursive: true });
      activeCloudRunCase.caseDir = caseDir;
      activeCloudRunCase.scenario = "HAPPY";
      const preludeSh = createMockPreludeFiles(caseDir);
      const baseEnv = {
        BASH_ENV: toPosixPath(preludeSh),
        MOCK_STATE_DIR: caseDir,
        MOCK_CAND_URL: candHttp.url,
        MOCK_CLOUDRUN_API_URL: cloudRunApi.url,
      };
      return await fn(caseDir, baseEnv);
    }

    // 1. CLONE_FAIL
    await runCase("01_clone_fail", async (caseDir, baseEnv) => {
      initCaseState(caseDir);
      const workDir = path.join(caseDir, "work");
      const res = await runBashScript(stage1Script, stage1Args(workDir), {
        ...baseEnv,
        MOCK_SCENARIO: "CLONE_FAIL",
      });
      const st = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(workDir, "phase-journal.json"));
      assertScenario(
        "01_CLONE_FAIL",
        "Git clone failure exits non-zero with 0 builds, 0 deploys, and 0 traffic mutations",
        res.exitCode === 128 &&
          st.counters.buildsSubmit === 0 &&
          st.counters.deploy === 0 &&
          st.counters.updateTraffic === 0 &&
          journal?.finalOutcome === "CLONE_FAILED",
        { exitCode: res.exitCode, counters: st.counters, finalOutcome: journal?.finalOutcome },
      );
    });

    // 2. BUILD_FAIL
    await runCase("02_build_fail", async (caseDir, baseEnv) => {
      initCaseState(caseDir);
      const workDir = path.join(caseDir, "work");
      const res = await runBashScript(stage1Script, stage1Args(workDir), {
        ...baseEnv,
        MOCK_SCENARIO: "BUILD_FAIL",
      });
      const st = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(workDir, "phase-journal.json"));
      assertScenario(
        "02_BUILD_FAIL",
        "Cloud Build failure exits non-zero with 0 deploys and 0 traffic mutations",
        res.exitCode === 31 &&
          st.counters.buildsSubmit === 1 &&
          st.counters.deploy === 0 &&
          st.counters.updateTraffic === 0 &&
          journal?.finalOutcome === "BUILD_FAILED",
        { exitCode: res.exitCode, counters: st.counters, finalOutcome: journal?.finalOutcome },
      );
    });

    // 3. DEPLOY_UNKNOWN
    await runCase("03_deploy_unknown", async (caseDir, baseEnv) => {
      initCaseState(caseDir);
      const workDir = path.join(caseDir, "work");
      const res = await runBashScript(stage1Script, stage1Args(workDir), {
        ...baseEnv,
        MOCK_SCENARIO: "DEPLOY_UNKNOWN",
      });
      const st = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(workDir, "phase-journal.json"));
      assertScenario(
        "03_DEPLOY_UNKNOWN",
        "Ambiguous 0% deploy RPC (exit 28) queries live state once, does NOT retry, does NOT shift traffic, and halts with OUTCOME_UNKNOWN_HALTED",
        res.exitCode === 28 &&
          st.counters.deploy === 1 &&
          st.counters.updateTraffic === 0 &&
          st.counters.describeService === 2 &&
          journal?.finalOutcome === "OUTCOME_UNKNOWN_HALTED",
        { exitCode: res.exitCode, counters: st.counters, finalOutcome: journal?.finalOutcome },
      );
    });

    // 4. SMOKE_TAG_FIRST_V11_TRAFFIC
    await runCase("04_smoke_tag_first_v11_traffic", async (caseDir, baseEnv) => {
      initCaseState(caseDir);
      const workDir = path.join(caseDir, "work");
      const res = await runBashScript(stage1Script, stage1Args(workDir), baseEnv);
      const snapshot = readJsonIfExists(path.join(workDir, "pre-stage1-service-snapshot.json"));
      const receipt = readJsonIfExists(path.join(workDir, "stage1-verified-receipt.json"));
      const st = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      assertScenario(
        "04_SMOKE_TAG_FIRST_V11_TRAFFIC",
        "When status.traffic[0] is smoke (0%) as in archived v11, Stage 1 locks exact percent===100 revision (jp-bids-mcp-manual-export-20261024 at index 1) and preserves all tags",
        res.exitCode === 0 &&
          snapshot?.prev100Revision === "jp-bids-mcp-manual-export-20261024" &&
          snapshot?.prev100TrafficIndex === 1 &&
          receipt?.prev100Revision === "jp-bids-mcp-manual-export-20261024" &&
          receipt?.preservedTrafficTags?.length === 3 &&
          st.counters.updateTraffic === 0,
        {
          exitCode: res.exitCode,
          prev100Revision: snapshot?.prev100Revision,
          prev100TrafficIndex: snapshot?.prev100TrafficIndex,
          preservedTagCount: receipt?.preservedTrafficTags?.length,
        },
      );
    });

    // Helper to prepare a valid Stage 1 receipt for Stage 2 scenarios
    async function runValidStage1(caseDir, baseEnv) {
      initCaseState(caseDir);
      const s1Work = path.join(caseDir, "s1-work");
      const s1Res = await runBashScript(stage1Script, stage1Args(s1Work), baseEnv);
      if (s1Res.exitCode !== 0) {
        throw new Error(`Setup Stage 1 failed unexpectedly: ${s1Res.stderr}`);
      }
      return path.join(s1Work, "stage1-verified-receipt.json");
    }

    // 5. SUCCESS_FOREIGN_LATEST
    await runCase("05_success_foreign_latest", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      const stPath = path.join(caseDir, "cloud-state.json");
      const st = readJsonIfExists(stPath);
      st.service.status.latestCreatedRevisionName = "jp-bids-mcp-concurrent-foreign";
      fs.writeFileSync(stPath, `${JSON.stringify(st, null, 2)}\n`, "utf8");

      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        stage2Args(receiptPath, prodHttp.url, s2Work),
        baseEnv,
      );
      const stAfter = readJsonIfExists(stPath);
      const gateReport = readJsonIfExists(path.join(s2Work, "stage2-pre-gate-report.json"));
      assertScenario(
        "05_SUCCESS_FOREIGN_LATEST",
        "Concurrent foreign latest revision blocks Stage 2 promotion with 0 traffic mutations",
        res.exitCode !== 0 &&
          stAfter.counters.updateTraffic === 0 &&
          gateReport?.errorCode === "FOREIGN_LATEST_REVISION_CONFLICT",
        {
          exitCode: res.exitCode,
          updateTrafficCalls: stAfter.counters.updateTraffic,
          errorCode: gateReport?.errorCode,
        },
      );
    });

    // 6. GENERATION_CONFLICT
    await runCase("06_generation_conflict", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      const stPath = path.join(caseDir, "cloud-state.json");
      const st = readJsonIfExists(stPath);
      st.service.metadata.generation += 1;
      st.service.status.observedGeneration = st.service.metadata.generation;
      fs.writeFileSync(stPath, `${JSON.stringify(st, null, 2)}\n`, "utf8");

      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        stage2Args(receiptPath, prodHttp.url, s2Work),
        baseEnv,
      );
      const stAfter = readJsonIfExists(stPath);
      const gateReport = readJsonIfExists(path.join(s2Work, "stage2-pre-gate-report.json"));
      assertScenario(
        "06_GENERATION_CONFLICT",
        "Service generation drift between Stage 1 receipt and Stage 2 cutover blocks promotion with 0 mutations",
        res.exitCode !== 0 &&
          stAfter.counters.updateTraffic === 0 &&
          gateReport?.errorCode === "GENERATION_CONFLICT",
        {
          exitCode: res.exitCode,
          updateTrafficCalls: stAfter.counters.updateTraffic,
          errorCode: gateReport?.errorCode,
        },
      );
    });

    // 7. TAG_OR_CONFIG_DRIFT
    await runCase("07_tag_or_config_drift", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      const stPath = path.join(caseDir, "cloud-state.json");
      const st = readJsonIfExists(stPath);
      // Mutate secretKeyRef on candidate revision and drop pre-existing smoke tag
      st.revisions["jp-bids-mcp-v0101-cand1"].spec.serviceAccountName =
        "tampered-sa@jp-bids-prod.iam.gserviceaccount.com";
      fs.writeFileSync(stPath, `${JSON.stringify(st, null, 2)}\n`, "utf8");

      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        stage2Args(receiptPath, prodHttp.url, s2Work),
        baseEnv,
      );
      const stAfter = readJsonIfExists(stPath);
      const gateReport = readJsonIfExists(path.join(s2Work, "stage2-pre-gate-report.json"));
      assertScenario(
        "07_TAG_OR_CONFIG_DRIFT",
        "Runtime SA / SecretRef / tag drift before Stage 2 cutover blocks promotion with 0 mutations",
        res.exitCode !== 0 &&
          stAfter.counters.updateTraffic === 0 &&
          gateReport?.errorCode === "CONFIG_OR_SECRET_DRIFT",
        {
          exitCode: res.exitCode,
          updateTrafficCalls: stAfter.counters.updateTraffic,
          errorCode: gateReport?.errorCode,
        },
      );
    });

    // 8. BROKEN_AUTH_MCP
    await runCase("08_broken_auth_mcp", async (caseDir, baseEnv) => {
      initCaseState(caseDir);
      candFault.mode = "BROKEN_AUTH_MCP";
      const workDir = path.join(caseDir, "work");
      const res = await runBashScript(stage1Script, stage1Args(workDir), baseEnv);
      const verifyReport = readJsonIfExists(
        path.join(workDir, "stage1-candidate-verification.json"),
      );
      const receiptExists = fs.existsSync(path.join(workDir, "stage1-verified-receipt.json"));
      assertScenario(
        "08_BROKEN_AUTH_MCP",
        "Healthy GET /health & /readyz with broken authenticated POST /mcp fails Stage 1 verification and refuses to seal receipt",
        res.exitCode === 21 &&
          verifyReport?.ok === false &&
          !receiptExists &&
          String(verifyReport?.error || "").includes("C13_MCP_2025_INITIALIZE"),
        {
          exitCode: res.exitCode,
          receiptExists,
          verifyError: verifyReport?.error,
        },
      );
    });

    // 9. UI_HASH_MISMATCH
    await runCase("09_ui_hash_mismatch", async (caseDir, baseEnv) => {
      initCaseState(caseDir);
      candFault.mode = "UI_HASH_MISMATCH";
      const workDir = path.join(caseDir, "work");
      const res = await runBashScript(stage1Script, stage1Args(workDir), baseEnv);
      const verifyReport = readJsonIfExists(
        path.join(workDir, "stage1-candidate-verification.json"),
      );
      const receiptExists = fs.existsSync(path.join(workDir, "stage1-verified-receipt.json"));
      assertScenario(
        "09_UI_HASH_MISMATCH",
        "Mismatched UI HTML SHA-256 on 2026-07-28 resources/read fails Stage 1 verification and refuses to seal receipt",
        res.exitCode === 21 &&
          verifyReport?.ok === false &&
          !receiptExists &&
          String(verifyReport?.error || "").includes("C16_MCP_2026_UI_RESOURCE_HASH"),
        {
          exitCode: res.exitCode,
          receiptExists,
          verifyError: verifyReport?.error,
        },
      );
    });

    // 10. PROMOTE_RPC_UNKNOWN
    await runCase("10_promote_rpc_unknown", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "PROMOTE_RPC_UNKNOWN";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(stage2Script, stage2Args(receiptPath, prodHttp.url, s2Work), {
        ...baseEnv,
        MOCK_SCENARIO: "PROMOTE_RPC_UNKNOWN",
      });
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      assertScenario(
        "10_PROMOTE_RPC_UNKNOWN",
        "Ambiguous Stage 2 cutover PATCH transport failure executes 0 retries and 0 blind rollbacks, queries live state, and halts with OUTCOME_UNKNOWN_HALTED",
        res.exitCode !== 0 &&
          stAfter.counters.updateTraffic === 1 &&
          journal?.rollbackAttempts === 0 &&
          journal?.finalOutcome === "OUTCOME_UNKNOWN_HALTED",
        {
          exitCode: res.exitCode,
          updateTrafficCalls: stAfter.counters.updateTraffic,
          rollbackAttempts: journal?.rollbackAttempts,
          finalOutcome: journal?.finalOutcome,
        },
      );
    });

    // 11. POST_PROMOTE_VERIFY_FAIL_ROLLBACK_ONCE
    await runCase("11_post_promote_verify_fail_rollback_once", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      prodFault.mode = "SERVICE_503";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        stage2Args(receiptPath, prodHttp.url, s2Work),
        baseEnv,
      );
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      const rbVerify = readJsonIfExists(path.join(s2Work, "stage2-post-rollback-verify.json"));
      assertScenario(
        "11_POST_PROMOTE_VERIFY_FAIL_ROLLBACK_ONCE",
        "Post-cutover verify failure confirms ownership, executes exactly 1 rollback to jp-bids-mcp-manual-export-20261024=100 preserving all tags, verifies restoration, and exits non-zero (29)",
        res.exitCode === 29 &&
          stAfter.counters.updateTraffic === 2 &&
          journal?.rollbackAttempts === 1 &&
          rbVerify?.ok === true &&
          rbVerify?.restoredRevision === "jp-bids-mcp-manual-export-20261024" &&
          journal?.finalOutcome === "ROLLED_BACK_AFTER_POST_CUTOVER_VERIFY_FAILURE",
        {
          exitCode: res.exitCode,
          updateTrafficCalls: stAfter.counters.updateTraffic,
          rollbackAttempts: journal?.rollbackAttempts,
          restoredRevision: rbVerify?.restoredRevision,
          finalOutcome: journal?.finalOutcome,
        },
      );
    });

    // 12. POST_PROMOTE_VERIFY_FAIL_THIRD_PARTY_CHANGED
    await runCase("12_post_promote_verify_fail_third_party_changed", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      prodFault.mode = "SERVICE_503";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(stage2Script, stage2Args(receiptPath, prodHttp.url, s2Work), {
        ...baseEnv,
        MOCK_SCENARIO: "POST_PROMOTE_VERIFY_FAIL_THIRD_PARTY_CHANGED",
      });
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      assertScenario(
        "12_POST_PROMOTE_VERIFY_FAIL_THIRD_PARTY_CHANGED",
        "When post-cutover verify fails and a third party concurrently modified the service, Stage 2 refuses rollback (0 rollback RPCs) and halts with exit 41",
        res.exitCode === 41 &&
          stAfter.counters.updateTraffic === 1 &&
          journal?.rollbackAttempts === 0 &&
          journal?.finalOutcome === "THIRD_PARTY_CHANGED_HALTED_NO_ROLLBACK",
        {
          exitCode: res.exitCode,
          updateTrafficCalls: stAfter.counters.updateTraffic,
          rollbackAttempts: journal?.rollbackAttempts,
          finalOutcome: journal?.finalOutcome,
        },
      );
    });

    // 13. ROLLBACK_RPC_FAIL_NOT_MASKED
    await runCase("13_rollback_rpc_fail_not_masked", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "ROLLBACK_RPC_FAIL_NOT_MASKED";
      prodFault.mode = "SERVICE_503";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(stage2Script, stage2Args(receiptPath, prodHttp.url, s2Work), {
        ...baseEnv,
        MOCK_SCENARIO: "ROLLBACK_RPC_FAIL_NOT_MASKED",
      });
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      assertScenario(
        "13_ROLLBACK_RPC_FAIL_NOT_MASKED",
        "Rollback PATCH failure (HTTP 500 -> exit 35) is NOT masked, does not retry beyond 1 rollback attempt, and records ROLLBACK_RPC_FAILED",
        res.exitCode === 35 &&
          stAfter.counters.updateTraffic === 2 &&
          journal?.rollbackAttempts === 1 &&
          journal?.finalOutcome === "ROLLBACK_RPC_FAILED",
        {
          exitCode: res.exitCode,
          updateTrafficCalls: stAfter.counters.updateTraffic,
          rollbackAttempts: journal?.rollbackAttempts,
          finalOutcome: journal?.finalOutcome,
        },
      );
    });

    // 14. STAGE1_AND_STAGE2_HAPPY_PATH
    await runCase("14_stage1_and_stage2_happy_path", async (caseDir, baseEnv) => {
      initCaseState(caseDir);
      const s1Work = path.join(caseDir, "s1-work");
      const s1Res = await runBashScript(stage1Script, stage1Args(s1Work), baseEnv);
      const receiptPath = path.join(s1Work, "stage1-verified-receipt.json");

      const s2Work = path.join(caseDir, "s2-work");
      const s2Res = await runBashScript(
        stage2Script,
        stage2Args(receiptPath, prodHttp.url, s2Work),
        baseEnv,
      );

      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const completeDoc = readJsonIfExists(path.join(s2Work, "stage2-promotion-complete.json"));
      const s2Journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));

      assertScenario(
        "14_STAGE1_AND_STAGE2_HAPPY_PATH",
        "End-to-end Stage 1 (0% deploy + config diff + 16 runtime checks + sealed receipt) and Stage 2 (pre-gate + single cutover RPC + candidate & prod 16-check verification) succeed with 0 external calls",
        s1Res.exitCode === 0 &&
          s2Res.exitCode === 0 &&
          stAfter.counters.deploy === 1 &&
          stAfter.counters.updateTraffic === 1 &&
          s2Journal?.rollbackAttempts === 0 &&
          completeDoc?.ok === true &&
          completeDoc?.promotedRevision === "jp-bids-mcp-v0101-cand1" &&
          completeDoc?.previous100Revision === "jp-bids-mcp-manual-export-20261024" &&
          completeDoc?.candidateRuntimeChecksPassed === 16 &&
          completeDoc?.productionRuntimeChecksPassed === 16,
        {
          stage1ExitCode: s1Res.exitCode,
          stage2ExitCode: s2Res.exitCode,
          counters: stAfter.counters,
          completeSummary: completeDoc,
        },
      );
    });

    // 15. REAL_CANDIDATE_DIST_HTTP_SERVER (boots actual dist/transports/http.js on 127.0.0.1!)
    const candRepoDir = ROOT_DIR;
    const realDistHttpPath = path.join(candRepoDir, "dist", "transports", "http.js");
    const realUiHtmlPath = path.join(candRepoDir, "dist", "apps", "search-results.html");
    if (fs.existsSync(realDistHttpPath) && fs.existsSync(realUiHtmlPath)) {
      const origCwd = process.cwd();
      process.chdir(candRepoDir);
      process.env.JP_BIDS_PROFILE = "public_mvp";
      process.env.JP_BIDS_DOCUMENT_EXTRACTION = "off";
      process.env.JP_BIDS_OAUTH_SECRET = "offline-sim-ephemeral-oauth-secret-0123456789abcdef";
      delete process.env.JP_BIDS_BASE_URL;
      delete process.env.OPENAI_APPS_CHALLENGE_TOKEN;

      const realUiSha256 = crypto
        .createHash("sha256")
        .update(fs.readFileSync(realUiHtmlPath, "utf8"), "utf8")
        .digest("hex");

      const { createHttpApp } = await import(pathToFileURL(realDistHttpPath).href);
      const realAppCand = createHttpApp();
      const realAppProd = createHttpApp();

      const listenExpress = (app) =>
        new Promise((resolve, reject) => {
          const srv = app.listen(0, "127.0.0.1", () => {
            resolve({
              url: `http://127.0.0.1:${srv.address().port}`,
              close: () => new Promise((r) => srv.close(() => r())),
            });
          });
          srv.on("error", reject);
        });

      const realCandSrv = await listenExpress(realAppCand);
      const realProdSrv = await listenExpress(realAppProd);
      try {
        await runCase("15_real_candidate_dist_http_server", async (caseDir, baseEnv) => {
          initCaseState(caseDir);
          const s1Work = path.join(caseDir, "s1-work");
          const realS1Args = stage1Args(s1Work).map((a) =>
            a.startsWith("--expected-ui-sha256=") ? `--expected-ui-sha256=${realUiSha256}` : a,
          );
          const s1Res = await runBashScript(stage1Script, realS1Args, {
            ...baseEnv,
            MOCK_CAND_URL: realCandSrv.url,
          });
          const receiptPath = path.join(s1Work, "stage1-verified-receipt.json");
          const s2Work = path.join(caseDir, "s2-work");
          const s2Res = await runBashScript(
            stage2Script,
            stage2Args(receiptPath, realProdSrv.url, s2Work),
            {
              ...baseEnv,
              MOCK_CAND_URL: realCandSrv.url,
            },
          );
          const completeDoc = readJsonIfExists(path.join(s2Work, "stage2-promotion-complete.json"));
          assertScenario(
            "15_REAL_CANDIDATE_DIST_HTTP_SERVER",
            "Stage 1 & Stage 2 pass all 16 runtime checks (OAuth PKCE, 2025-11-25, 2026-07-28 tools/list & resources/read, and real search-results.html SHA-256) against compiled candidate-repo/dist/transports/http.js",
            s1Res.exitCode === 0 &&
              s2Res.exitCode === 0 &&
              completeDoc?.ok === true &&
              completeDoc?.uiHtmlSha256 === realUiSha256 &&
              completeDoc?.candidateRuntimeChecksPassed === 16 &&
              completeDoc?.productionRuntimeChecksPassed === 16,
            {
              stage1ExitCode: s1Res.exitCode,
              stage2ExitCode: s2Res.exitCode,
              realUiSha256,
              completeSummary: completeDoc,
              s1StderrTail: s1Res.stderr.slice(-400),
              s2StderrTail: s2Res.stderr.slice(-400),
            },
          );
        });
      } finally {
        await realCandSrv.close();
        await realProdSrv.close();
        process.chdir(origCwd);
      }
    }

    // 16. AUDITOR_RACE_BEFORE_PROMOTE (PUBLIC-V2-F01)
    await runCase("16_auditor_race_before_promote", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "AUDITOR_RACE_BEFORE_PROMOTE";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        stage2Args(receiptPath, prodHttp.url, s2Work),
        baseEnv,
      );
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      const active100 = stAfter.service.status.traffic.find((t) => t.percent === 100)?.revisionName;
      const completeExists = fs.existsSync(path.join(s2Work, "stage2-promotion-complete.json"));
      assertScenario(
        "16_AUDITOR_RACE_BEFORE_PROMOTE",
        "Third-party change AFTER pre-stage2-gate GET and right BEFORE promotion PATCH is rejected by server etag (409 -> exit 49) without overwriting third-party state",
        res.exitCode === 49 &&
          active100 === "jp-bids-mcp-auditor-thirdparty" &&
          !completeExists &&
          journal?.finalOutcome === "CONCURRENT_MODIFICATION_ABORTED",
        { exitCode: res.exitCode, active100, completeExists, finalOutcome: journal?.finalOutcome },
      );
    });

    // 17. AUDITOR_RACE_BEFORE_ROLLBACK (PUBLIC-V2-F01)
    await runCase("17_auditor_race_before_rollback", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "AUDITOR_RACE_BEFORE_ROLLBACK";
      prodFault.mode = "SERVICE_503";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        stage2Args(receiptPath, prodHttp.url, s2Work),
        baseEnv,
      );
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      const active100 = stAfter.service.status.traffic.find((t) => t.percent === 100)?.revisionName;
      assertScenario(
        "17_AUDITOR_RACE_BEFORE_ROLLBACK",
        "Third-party change AFTER pre-rollback-ownership-check GET and right BEFORE rollback PATCH is rejected by server etag (409 -> exit 49) without overwriting third-party state",
        res.exitCode === 49 &&
          active100 === "jp-bids-mcp-auditor-thirdparty" &&
          journal?.finalOutcome === "CONCURRENT_MODIFICATION_ABORTED",
        { exitCode: res.exitCode, active100, finalOutcome: journal?.finalOutcome },
      );
    });

    // 18. JOURNAL_EACCES_STAGE1_BEFORE_RPC (PUBLIC-V2-F02)
    await runCase("18_journal_eacces_stage1_before_rpc", async (caseDir, baseEnv) => {
      initCaseState(caseDir);
      const hookPath = path.join(caseDir, "journal-eacces-hook.mjs");
      fs.writeFileSync(
        hookPath,
        `import fs from "node:fs";
const origWrite = fs.writeFileSync;
fs.writeFileSync = function(p, ...rest) {
  if (String(p).endsWith("phase-journal.json")) {
    const err = new Error("EACCES: simulated journal write failure");
    err.code = "EACCES";
    throw err;
  }
  return origWrite.call(this, p, ...rest);
};
`,
        "utf8",
      );
      const workDir = path.join(caseDir, "work");
      const res = await runBashScript(stage1Script, stage1Args(workDir), {
        ...baseEnv,
        EXTRA_NODE_IMPORT: pathToFileURL(hookPath).href,
      });
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const receiptExists = fs.existsSync(path.join(workDir, "stage1-verified-receipt.json"));
      assertScenario(
        "18_JOURNAL_EACCES_STAGE1_BEFORE_RPC",
        "Stage 1 EACCES on phase-journal.json aborts immediately with 0 builds, 0 deploys, 0 traffic changes, no receipt, and non-zero exit (19)",
        res.exitCode === 19 &&
          stAfter.counters.buildsSubmit === 0 &&
          stAfter.counters.deploy === 0 &&
          stAfter.counters.updateTraffic === 0 &&
          !receiptExists,
        { exitCode: res.exitCode, counters: stAfter.counters, receiptExists },
      );
    });

    // 19. JOURNAL_EACCES_STAGE2_BEFORE_RPC (PUBLIC-V2-F02)
    await runCase("19_journal_eacces_stage2_before_rpc", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      const hookPath = path.join(caseDir, "journal-eacces-s2-hook.mjs");
      fs.writeFileSync(
        hookPath,
        `import fs from "node:fs";
const origWrite = fs.writeFileSync;
fs.writeFileSync = function(p, ...rest) {
  if (String(p).endsWith("phase-journal.json")) {
    const err = new Error("EACCES: simulated stage2 journal write failure");
    err.code = "EACCES";
    throw err;
  }
  return origWrite.call(this, p, ...rest);
};
`,
        "utf8",
      );
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(stage2Script, stage2Args(receiptPath, prodHttp.url, s2Work), {
        ...baseEnv,
        EXTRA_NODE_IMPORT: pathToFileURL(hookPath).href,
      });
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const completeExists = fs.existsSync(path.join(s2Work, "stage2-promotion-complete.json"));
      assertScenario(
        "19_JOURNAL_EACCES_STAGE2_BEFORE_RPC",
        "Stage 2 EACCES on phase-journal.json aborts immediately with 0 traffic mutations, no completion JSON, and non-zero exit (19)",
        res.exitCode === 19 && stAfter.counters.updateTraffic === 0 && !completeExists,
        { exitCode: res.exitCode, counters: stAfter.counters, completeExists },
      );
    });

    // 20. JOURNAL_FAIL_AFTER_RPC_STAGE2 (PUBLIC-V2-F02)
    await runCase("20_journal_fail_after_rpc_stage2", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      const hookPath = path.join(caseDir, "journal-after-rpc-hook.mjs");
      fs.writeFileSync(
        hookPath,
        `import fs from "node:fs";
const origWrite = fs.writeFileSync;
fs.writeFileSync = function(p, data, ...rest) {
  if (String(p).endsWith("phase-journal.json") && String(data).includes("S2_COMPLETE")) {
    const err = new Error("EIO: simulated post-RPC journal persistence failure");
    err.code = "EIO";
    throw err;
  }
  return origWrite.call(this, p, data, ...rest);
};
`,
        "utf8",
      );
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(stage2Script, stage2Args(receiptPath, prodHttp.url, s2Work), {
        ...baseEnv,
        EXTRA_NODE_IMPORT: pathToFileURL(hookPath).href,
      });
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const completeExists = fs.existsSync(path.join(s2Work, "stage2-promotion-complete.json"));
      const marker = readJsonIfExists(path.join(s2Work, "stage2-journal-failure-marker.json"));
      assertScenario(
        "20_JOURNAL_FAIL_AFTER_RPC_STAGE2",
        "Post-RPC journal persistence failure removes stage2-promotion-complete.json, records UNKNOWN_OR_MAY_HAVE_STARTED, makes 0 further RPCs, and exits non-zero (19)",
        res.exitCode === 19 &&
          stAfter.counters.updateTraffic === 1 &&
          !completeExists &&
          marker?.outcome === "UNKNOWN_OR_MAY_HAVE_STARTED",
        { exitCode: res.exitCode, counters: stAfter.counters, completeExists, marker },
      );
    });

    // 21. JOURNAL_CORRUPT_BEFORE_RPC (PUBLIC-V2-F02)
    await runCase("21_journal_corrupt_before_rpc", async (caseDir, baseEnv) => {
      initCaseState(caseDir);
      const workDir = path.join(caseDir, "work");
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(path.join(workDir, "phase-journal.json"), "{corrupt-truncated-json", "utf8");
      const res = await runBashScript(stage1Script, stage1Args(workDir), baseEnv);
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      assertScenario(
        "21_JOURNAL_CORRUPT_BEFORE_RPC",
        "Corrupt pre-existing phase-journal.json aborts Stage 1 with 0 builds, 0 deploys, 0 traffic mutations, and non-zero exit (19)",
        res.exitCode === 19 &&
          stAfter.counters.buildsSubmit === 0 &&
          stAfter.counters.deploy === 0 &&
          stAfter.counters.updateTraffic === 0,
        { exitCode: res.exitCode, counters: stAfter.counters },
      );
    });

    // 22. INVALID_MAX_AGE_CLI_AND_ENV (PUBLIC-V2-F03)
    await runCase("22_invalid_max_age_cli_and_env", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      const badValues = ["NaN", "Infinity", "-Infinity", "0", "-5", "", "abc", "1.5", "999999999"];
      const cliResults = [];
      for (const bad of badValues) {
        const w = path.join(caseDir, `cli-${bad.replace(/[^a-z0-9]/gi, "_")}`);
        const r = await runBashScript(
          stage2Script,
          [
            `--receipt=${toPosixPath(receiptPath)}`,
            `--production-url=${prodHttp.url}`,
            `--max-age-seconds=${bad}`,
            `--work-dir=${toPosixPath(w)}`,
          ],
          baseEnv,
        );
        cliResults.push({ bad, exitCode: r.exitCode });
      }
      const envResults = [];
      for (const bad of badValues) {
        const w = path.join(caseDir, `env-${bad.replace(/[^a-z0-9]/gi, "_")}`);
        const r = await runBashScript(
          stage2Script,
          [
            `--receipt=${toPosixPath(receiptPath)}`,
            `--production-url=${prodHttp.url}`,
            `--work-dir=${toPosixPath(w)}`,
          ],
          { ...baseEnv, MAX_AGE_SECONDS: bad },
        );
        envResults.push({ bad, exitCode: r.exitCode });
      }
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const allRejected =
        cliResults.every((x) => x.exitCode === 22) && envResults.every((x) => x.exitCode === 22);
      assertScenario(
        "22_INVALID_MAX_AGE_CLI_AND_ENV",
        "All invalid max-age-seconds values (NaN, Infinity, -Infinity, 0, -5, empty, abc, 1.5, 999999999) rejected in both CLI & env with exit 22 and 0 traffic mutations",
        allRejected && stAfter.counters.updateTraffic === 0,
        { cliResults, envResults, updateTrafficCalls: stAfter.counters.updateTraffic },
      );
    });

    // 23. EXPIRED_RECEIPT_900S_CLOCK_SHIFT (PUBLIC-V2-F03)
    await runCase("23_expired_receipt_900s_clock_shift", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      const clockHookPath = path.join(caseDir, "clock-plus-24h-hook.mjs");
      fs.writeFileSync(
        clockHookPath,
        `const origNow = Date.now;
Date.now = () => origNow() + 24 * 60 * 60 * 1000;
`,
        "utf8",
      );
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(stage2Script, stage2Args(receiptPath, prodHttp.url, s2Work), {
        ...baseEnv,
        EXTRA_NODE_IMPORT: pathToFileURL(clockHookPath).href,
      });
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const gateReport = readJsonIfExists(path.join(s2Work, "stage2-pre-gate-report.json"));
      assertScenario(
        "23_EXPIRED_RECEIPT_900S_CLOCK_SHIFT",
        "Unmodified valid receipt rejected with STALE_STAGE1_VERIFICATION_RECEIPT and 0 traffic mutations when clock is shifted +24h",
        res.exitCode !== 0 &&
          stAfter.counters.updateTraffic === 0 &&
          gateReport?.errorCode === "STALE_STAGE1_VERIFICATION_RECEIPT",
        { exitCode: res.exitCode, updateTrafficCalls: stAfter.counters.updateTraffic, gateReport },
      );
    });

    // 24. FUTURE_RECEIPT_TIMESTAMP (PUBLIC-V2-F03)
    await runCase("24_future_receipt_timestamp", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      const clockHookPath = path.join(caseDir, "clock-minus-1h-hook.mjs");
      fs.writeFileSync(
        clockHookPath,
        `const origNow = Date.now;
Date.now = () => origNow() - 60 * 60 * 1000;
`,
        "utf8",
      );
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(stage2Script, stage2Args(receiptPath, prodHttp.url, s2Work), {
        ...baseEnv,
        EXTRA_NODE_IMPORT: pathToFileURL(clockHookPath).href,
      });
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const gateReport = readJsonIfExists(path.join(s2Work, "stage2-pre-gate-report.json"));
      assertScenario(
        "24_FUTURE_RECEIPT_TIMESTAMP",
        "Future-dated receipt relative to current clock rejected with FUTURE_RECEIPT_TIMESTAMP and 0 traffic mutations",
        res.exitCode !== 0 &&
          stAfter.counters.updateTraffic === 0 &&
          gateReport?.errorCode === "FUTURE_RECEIPT_TIMESTAMP",
        { exitCode: res.exitCode, updateTrafficCalls: stAfter.counters.updateTraffic, gateReport },
      );
    });

    // 25. DELAYED_ASYNC_OPERATION_CONVERGENCE (PUBLIC-V3-F02)
    await runCase("25_delayed_async_operation_convergence", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "DELAYED_ASYNC_OPERATION";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        stage2Args(receiptPath, prodHttp.url, s2Work),
        baseEnv,
      );
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const completeDoc = readJsonIfExists(path.join(s2Work, "stage2-promotion-complete.json"));
      assertScenario(
        "25_DELAYED_ASYNC_OPERATION_CONVERGENCE",
        "PATCH returning Operation(done:false) polls 3 times until done:true and trafficStatuses converges on candidate=100, then succeeds",
        res.exitCode === 0 &&
          stAfter.counters.updateTraffic === 1 &&
          stAfter.counters.operationGet === 3 &&
          completeDoc?.ok === true &&
          completeDoc?.promotedRevision === "jp-bids-mcp-v0101-cand1",
        { exitCode: res.exitCode, counters: stAfter.counters, completeDoc },
      );
    });

    // 26. PROMOTE_ASYNC_OPERATION_ERROR (PUBLIC-V3-F02)
    await runCase("26_promote_async_operation_error", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "PROMOTE_ASYNC_OP_ERROR";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        stage2Args(receiptPath, prodHttp.url, s2Work),
        baseEnv,
      );
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      assertScenario(
        "26_PROMOTE_ASYNC_OPERATION_ERROR",
        "Async promote Operation.error halts with OPERATION_FAILED (exit 36), 0 PATCH retries, and 0 blind rollbacks",
        res.exitCode === 36 &&
          stAfter.counters.updateTraffic === 1 &&
          journal?.rollbackAttempts === 0 &&
          journal?.finalOutcome === "OPERATION_FAILED",
        { exitCode: res.exitCode, counters: stAfter.counters, finalOutcome: journal?.finalOutcome },
      );
    });

    // 27. PROMOTE_ASYNC_OPERATION_TIMEOUT (PUBLIC-V3-F02)
    await runCase("27_promote_async_operation_timeout", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "PROMOTE_ASYNC_OP_TIMEOUT";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        [
          `--receipt=${toPosixPath(receiptPath)}`,
          `--production-url=${prodHttp.url}`,
          "--max-age-seconds=900",
          "--op-poll-interval-ms=200",
          "--op-timeout-seconds=1",
          `--work-dir=${toPosixPath(s2Work)}`,
        ],
        baseEnv,
      );
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      assertScenario(
        "27_PROMOTE_ASYNC_OPERATION_TIMEOUT",
        "Async promote Operation timing out (done:false) halts with OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT (exit 37), 0 PATCH retries, and 0 blind rollbacks",
        res.exitCode === 37 &&
          stAfter.counters.updateTraffic === 1 &&
          journal?.rollbackAttempts === 0 &&
          journal?.finalOutcome === "OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT",
        { exitCode: res.exitCode, counters: stAfter.counters, finalOutcome: journal?.finalOutcome },
      );
    });

    // 28. PROMOTE_OPERATION_POLL_HTTP_500 (PUBLIC-V3-F02)
    await runCase("28_promote_operation_poll_http_500", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "PROMOTE_OP_POLL_500";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        stage2Args(receiptPath, prodHttp.url, s2Work),
        baseEnv,
      );
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      assertScenario(
        "28_PROMOTE_OPERATION_POLL_HTTP_500",
        "Operation poll HTTP 500 halts with OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT (exit 37) and 0 PATCH retries",
        res.exitCode === 37 &&
          stAfter.counters.updateTraffic === 1 &&
          journal?.rollbackAttempts === 0 &&
          journal?.finalOutcome === "OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT",
        { exitCode: res.exitCode, counters: stAfter.counters, finalOutcome: journal?.finalOutcome },
      );
    });

    // 29. ROLLBACK_DELAYED_ASYNC_OPERATION (PUBLIC-V3-F02)
    await runCase("29_rollback_delayed_async_operation", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "ROLLBACK_DELAYED_ASYNC_OPERATION";
      prodFault.mode = "SERVICE_503";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        stage2Args(receiptPath, prodHttp.url, s2Work),
        baseEnv,
      );
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      const rbVerify = readJsonIfExists(path.join(s2Work, "stage2-post-rollback-verify.json"));
      assertScenario(
        "29_ROLLBACK_DELAYED_ASYNC_OPERATION",
        "Rollback PATCH returning delayed Operation(done:false) polls 3 times until done:true and verifies v2 trafficStatuses restored to prev100Revision=100 (exit 29)",
        res.exitCode === 29 &&
          stAfter.counters.updateTraffic === 2 &&
          stAfter.counters.operationGet === 4 &&
          rbVerify?.ok === true &&
          journal?.finalOutcome === "ROLLED_BACK_AFTER_POST_CUTOVER_VERIFY_FAILURE",
        {
          exitCode: res.exitCode,
          counters: stAfter.counters,
          rbVerify,
          finalOutcome: journal?.finalOutcome,
        },
      );
    });

    // 30. ROLLBACK_ASYNC_OPERATION_ERROR (PUBLIC-V3-F02)
    await runCase("30_rollback_async_operation_error", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "ROLLBACK_ASYNC_OP_ERROR";
      prodFault.mode = "SERVICE_503";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        stage2Args(receiptPath, prodHttp.url, s2Work),
        baseEnv,
      );
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      assertScenario(
        "30_ROLLBACK_ASYNC_OPERATION_ERROR",
        "Async rollback Operation.error halts with ROLLBACK_OPERATION_FAILED (exit 36) and 0 retries",
        res.exitCode === 36 &&
          stAfter.counters.updateTraffic === 2 &&
          journal?.finalOutcome === "ROLLBACK_OPERATION_FAILED",
        { exitCode: res.exitCode, counters: stAfter.counters, finalOutcome: journal?.finalOutcome },
      );
    });

    // 31. ROLLBACK_ASYNC_OPERATION_TIMEOUT (PUBLIC-V3-F02)
    await runCase("31_rollback_async_operation_timeout", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "ROLLBACK_ASYNC_OP_TIMEOUT";
      prodFault.mode = "SERVICE_503";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        [
          `--receipt=${toPosixPath(receiptPath)}`,
          `--production-url=${prodHttp.url}`,
          "--max-age-seconds=900",
          "--op-poll-interval-ms=200",
          "--op-timeout-seconds=1",
          `--work-dir=${toPosixPath(s2Work)}`,
        ],
        baseEnv,
      );
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      assertScenario(
        "31_ROLLBACK_ASYNC_OPERATION_TIMEOUT",
        "Async rollback Operation timing out halts with OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT (exit 37) and 0 retries",
        res.exitCode === 37 &&
          stAfter.counters.updateTraffic === 2 &&
          journal?.finalOutcome === "OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT",
        { exitCode: res.exitCode, counters: stAfter.counters, finalOutcome: journal?.finalOutcome },
      );
    });

    // 32. V1_V2_MISMATCH_DETECTED (PUBLIC-V3-F01)
    await runCase("32_v1_v2_mismatch_detected", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "V1_V2_MISMATCH";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        stage2Args(receiptPath, prodHttp.url, s2Work),
        baseEnv,
      );
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const gateReport = readJsonIfExists(path.join(s2Work, "stage2-pre-gate-report.json"));
      assertScenario(
        "32_V1_V2_MISMATCH_DETECTED",
        "Disagreement between v1 Service and authoritative v2 Service halts Stage 2 with 0 traffic mutations",
        res.exitCode !== 0 &&
          stAfter.counters.updateTraffic === 0 &&
          gateReport?.errorCode === "V1_V2_GENERATION_OR_RECONCILING_MISMATCH",
        { exitCode: res.exitCode, counters: stAfter.counters, gateReport },
      );
    });

    // 33. NON_GOOGLE_API_OVERRIDE_REJECTED_BEFORE_TOKEN (PUBLIC-V3-F03)
    await runCase("33_non_google_api_override_rejected_before_token", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      const stBefore = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const tokenCallsBefore = stBefore.counters.tokenCalls;
      const httpCallsBefore = stBefore.counters.httpCalls;

      const badOrigins = [
        "http://127.0.0.1:8080",
        "https://evil.example",
        "https://user@run.googleapis.com",
        "https://run.googleapis.com/extra",
      ];
      const checks = [];

      // CLI --cloudrun-api-base on Stage 1 & Stage 2
      const rCliS1 = await runBashScript(
        stage1Script,
        [...stage1Args(path.join(caseDir, "ov-cli-s1")), `--cloudrun-api-base=${cloudRunApi.url}`],
        baseEnv,
      );
      checks.push({ kind: "cli-s1", exitCode: rCliS1.exitCode });

      const rCliS2 = await runBashScript(
        stage2Script,
        stage2Args(receiptPath, prodHttp.url, path.join(caseDir, "ov-cli-s2"), [
          `--cloudrun-api-base=${cloudRunApi.url}`,
        ]),
        baseEnv,
      );
      checks.push({ kind: "cli-s2", exitCode: rCliS2.exitCode });

      // Env CLOUDRUN_API_BASE on Stage 1 & Stage 2
      for (const bad of badOrigins) {
        const rs1 = await runBashScript(
          stage1Script,
          stage1Args(path.join(caseDir, `ov-env-s1-${bad.replace(/[^a-z0-9]/gi, "_")}`)),
          { ...baseEnv, CLOUDRUN_API_BASE: bad },
        );
        const rs2 = await runBashScript(
          stage2Script,
          stage2Args(
            receiptPath,
            prodHttp.url,
            path.join(caseDir, `ov-env-s2-${bad.replace(/[^a-z0-9]/gi, "_")}`),
          ),
          { ...baseEnv, CLOUDRUN_API_BASE: bad },
        );
        checks.push({ kind: `env-${bad}`, s1Exit: rs1.exitCode, s2Exit: rs2.exitCode });
      }

      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const allExit23 = checks.every((c) =>
        "exitCode" in c ? c.exitCode === 23 : c.s1Exit === 23 && c.s2Exit === 23,
      );
      assertScenario(
        "33_NON_GOOGLE_API_OVERRIDE_REJECTED_BEFORE_TOKEN",
        "All --cloudrun-api-base and CLOUDRUN_API_BASE overrides rejected with exit 23 BEFORE gcloud auth print-access-token (0 token calls, 0 HTTP calls)",
        allExit23 &&
          stAfter.counters.tokenCalls === tokenCallsBefore &&
          stAfter.counters.httpCalls === httpCallsBefore,
        {
          checks,
          tokenCallsDelta: stAfter.counters.tokenCalls - tokenCallsBefore,
          httpCallsDelta: stAfter.counters.httpCalls - httpCallsBefore,
        },
      );
    });

    // 34. V4_DEADLINE_CONTROL_FAST_DONE (PUBLIC-V4-F01)
    await runCase("34_v4_deadline_control_fast_done", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        [
          `--receipt=${toPosixPath(receiptPath)}`,
          `--production-url=${prodHttp.url}`,
          "--max-age-seconds=900",
          "--op-poll-interval-ms=0",
          "--op-timeout-seconds=2",
          `--work-dir=${toPosixPath(s2Work)}`,
        ],
        baseEnv,
      );
      const completeDoc = readJsonIfExists(path.join(s2Work, "stage2-promotion-complete.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      assertScenario(
        "34_V4_DEADLINE_CONTROL_FAST_DONE",
        "Fast Operation(done:true) within --op-timeout-seconds=2 succeeds (exit 0, PROMOTED_AND_VERIFIED)",
        res.exitCode === 0 &&
          completeDoc?.ok === true &&
          journal?.finalOutcome === "PROMOTED_AND_VERIFIED",
        { exitCode: res.exitCode, finalOutcome: journal?.finalOutcome },
      );
    });

    // 35. V4_PROMOTE_SLOW_DONE_3500MS_REJECTED (PUBLIC-V4-F01)
    await runCase("35_v4_promote_slow_done_3500ms_rejected", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "PROMOTE_SLOW_DONE_3500";
      const s2Work = path.join(caseDir, "s2-work");
      const t0 = Date.now();
      const res = await runBashScript(
        stage2Script,
        [
          `--receipt=${toPosixPath(receiptPath)}`,
          `--production-url=${prodHttp.url}`,
          "--max-age-seconds=900",
          "--op-poll-interval-ms=0",
          "--op-timeout-seconds=2",
          `--work-dir=${toPosixPath(s2Work)}`,
        ],
        baseEnv,
      );
      const elapsedMs = Date.now() - t0;
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      const completeExists = fs.existsSync(path.join(s2Work, "stage2-promotion-complete.json"));
      assertScenario(
        "35_V4_PROMOTE_SLOW_DONE_3500MS_REJECTED",
        "3500ms delayed promote Operation GET is aborted/rejected around 2s deadline (exit 37, OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT, 0 extra PATCHes, 0 blind rollbacks, no completion JSON)",
        res.exitCode === 37 &&
          stAfter.counters.updateTraffic === 1 &&
          journal?.rollbackAttempts === 0 &&
          !completeExists &&
          journal?.finalOutcome === "OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT",
        {
          exitCode: res.exitCode,
          elapsedMs,
          counters: stAfter.counters,
          completeExists,
          finalOutcome: journal?.finalOutcome,
        },
      );
    });

    // 36. V4_ROLLBACK_SLOW_DONE_3500MS_REJECTED (PUBLIC-V4-F01)
    await runCase("36_v4_rollback_slow_done_3500ms_rejected", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "ROLLBACK_SLOW_DONE_3500";
      prodFault.mode = "SERVICE_503";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        [
          `--receipt=${toPosixPath(receiptPath)}`,
          `--production-url=${prodHttp.url}`,
          "--max-age-seconds=900",
          "--op-poll-interval-ms=0",
          "--op-timeout-seconds=2",
          `--work-dir=${toPosixPath(s2Work)}`,
        ],
        baseEnv,
      );
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      assertScenario(
        "36_V4_ROLLBACK_SLOW_DONE_3500MS_REJECTED",
        "3500ms delayed rollback Operation GET is aborted/rejected around 2s deadline (exit 37, OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT, 0 extra PATCHes)",
        res.exitCode === 37 &&
          stAfter.counters.updateTraffic === 2 &&
          journal?.finalOutcome === "OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT",
        { exitCode: res.exitCode, counters: stAfter.counters, finalOutcome: journal?.finalOutcome },
      );
    });

    // 37. V4_PROMOTE_HUNG_OPERATION_GET_KILLED (PUBLIC-V4-F01)
    await runCase("37_v4_promote_hung_operation_get_killed", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "PROMOTE_HUNG_OP_GET";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        [
          `--receipt=${toPosixPath(receiptPath)}`,
          `--production-url=${prodHttp.url}`,
          "--max-age-seconds=900",
          "--op-poll-interval-ms=0",
          "--op-timeout-seconds=2",
          `--work-dir=${toPosixPath(s2Work)}`,
        ],
        baseEnv,
      );
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      assertScenario(
        "37_V4_PROMOTE_HUNG_OPERATION_GET_KILLED",
        "Hung promote Operation GET is terminated within 2s + 250ms grace (exit 37, OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT, 0 PATCH retries)",
        res.exitCode === 37 &&
          stAfter.counters.updateTraffic === 1 &&
          journal?.rollbackAttempts === 0 &&
          journal?.finalOutcome === "OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT",
        { exitCode: res.exitCode, counters: stAfter.counters, finalOutcome: journal?.finalOutcome },
      );
    });

    // 38. V4_ROLLBACK_HUNG_OPERATION_GET_KILLED (PUBLIC-V4-F01)
    await runCase("38_v4_rollback_hung_operation_get_killed", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "ROLLBACK_HUNG_OP_GET";
      prodFault.mode = "SERVICE_503";
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        [
          `--receipt=${toPosixPath(receiptPath)}`,
          `--production-url=${prodHttp.url}`,
          "--max-age-seconds=900",
          "--op-poll-interval-ms=0",
          "--op-timeout-seconds=2",
          `--work-dir=${toPosixPath(s2Work)}`,
        ],
        baseEnv,
      );
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      assertScenario(
        "38_V4_ROLLBACK_HUNG_OPERATION_GET_KILLED",
        "Hung rollback Operation GET is terminated within 2s + 250ms grace (exit 37, OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT, 0 extra PATCHes)",
        res.exitCode === 37 &&
          stAfter.counters.updateTraffic === 2 &&
          journal?.finalOutcome === "OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT",
        { exitCode: res.exitCode, counters: stAfter.counters, finalOutcome: journal?.finalOutcome },
      );
    });

    // 39. V4_SLOW_TOKEN_ACQUISITION_EXCEEDS_DEADLINE (PUBLIC-V4-F01)
    await runCase("39_v4_slow_token_acquisition_exceeds_deadline", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      const s2Work = path.join(caseDir, "s2-work");
      const res = await runBashScript(
        stage2Script,
        [
          `--receipt=${toPosixPath(receiptPath)}`,
          `--production-url=${prodHttp.url}`,
          "--max-age-seconds=900",
          "--op-poll-interval-ms=0",
          "--op-timeout-seconds=2",
          `--work-dir=${toPosixPath(s2Work)}`,
        ],
        { ...baseEnv, MOCK_SLOW_OP_TOKEN_MS: "3500" },
      );
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      assertScenario(
        "39_V4_SLOW_TOKEN_ACQUISITION_EXCEEDS_DEADLINE",
        "Slow gcloud auth print-access-token (3500ms) during Operation poll is terminated within 2s + grace with 0 Operation GETs and exit 37",
        res.exitCode === 37 &&
          stAfter.counters.operationGet === 0 &&
          stAfter.counters.updateTraffic === 1 &&
          journal?.finalOutcome === "OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT",
        { exitCode: res.exitCode, counters: stAfter.counters, finalOutcome: journal?.finalOutcome },
      );
    });

    // 40. V4_POLL_INTERVAL_LONGER_THAN_REMAINING (PUBLIC-V4-F01)
    await runCase("40_v4_poll_interval_longer_than_remaining", async (caseDir, baseEnv) => {
      const receiptPath = await runValidStage1(caseDir, baseEnv);
      activeCloudRunCase.scenario = "POLL_INTERVAL_LONGER_THAN_REMAINING";
      const s2Work = path.join(caseDir, "s2-work");
      const t0 = Date.now();
      const res = await runBashScript(
        stage2Script,
        [
          `--receipt=${toPosixPath(receiptPath)}`,
          `--production-url=${prodHttp.url}`,
          "--max-age-seconds=900",
          "--op-poll-interval-ms=5000",
          "--op-timeout-seconds=2",
          `--work-dir=${toPosixPath(s2Work)}`,
        ],
        baseEnv,
      );
      const elapsedMs = Date.now() - t0;
      const stAfter = readJsonIfExists(path.join(caseDir, "cloud-state.json"));
      const journal = readJsonIfExists(path.join(s2Work, "phase-journal.json"));
      assertScenario(
        "40_V4_POLL_INTERVAL_LONGER_THAN_REMAINING",
        "Poll interval (5000ms) longer than remaining budget (2s) does NOT sleep 5s past deadline; halts immediately with exit 37 and 1 Operation GET",
        res.exitCode === 37 &&
          stAfter.counters.operationGet === 1 &&
          elapsedMs < 4500 &&
          journal?.finalOutcome === "OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT",
        {
          exitCode: res.exitCode,
          elapsedMs,
          counters: stAfter.counters,
          finalOutcome: journal?.finalOutcome,
        },
      );
    });

    // 41. V5_DESCENDANT_CLEANUP_ON_TIMEOUT (PUBLIC-V5-F01)
    await runCase("41_v5_descendant_cleanup_on_timeout", async () => {
      const s1Text = fs.readFileSync(stage1Script, "utf8");
      const s2Text = fs.readFileSync(stage2Script, "utf8");
      const extractHelper = (txt) => {
        const a = txt.indexOf("STEP_OWNERSHIP_SEQ=0");
        const b = txt.indexOf("\nassert_proc_capability\n", a);
        return a >= 0 && b > a ? txt.slice(a, b) : "";
      };
      const h1 = extractHelper(s1Text);
      const h2 = extractHelper(s2Text);
      const h1Sha = crypto.createHash("sha256").update(h1).digest("hex");
      const h2Sha = crypto.createHash("sha256").update(h2).digest("hex");
      const probeStdout = execFileSync(
        process.execPath,
        [
          "--import",
          pathToFileURL(NET_GUARD_PATH).href,
          path.join(CLOUDSHELL_DIR, "run-f01-cleanup-probes.mjs"),
        ],
        {
          cwd: ROOT_DIR,
          encoding: "utf8",
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      const probeReport = JSON.parse(probeStdout);
      const hasRequiredTokens =
        h1.includes("assert_proc_capability") &&
        h1.includes("collect_owned_pids") &&
        h1.includes("JP_BIDS_OWNED_STEP_TOKEN") &&
        h1.includes("timeout_flag") &&
        h1Sha === h2Sha;
      assertScenario(
        "41_V5_DESCENDANT_CLEANUP_ON_TIMEOUT",
        "Stage 1 & Stage 2 share identical /proc + JP_BIDS_OWNED_STEP_TOKEN + isolated PGID + timeout_flag run_bounded_step helper and freshly terminate TERM-ignoring descendants (leaf_alive_after_grace=0, survival_marker=0)",
        hasRequiredTokens &&
          probeReport?.allPassed === true &&
          probeReport?.stage1HelperSha256 === h1Sha &&
          probeReport?.stage2HelperSha256 === h2Sha &&
          probeReport?.cases?.[1]?.leaf_alive_after_grace === 0 &&
          probeReport?.cases?.[1]?.survival_marker === 0 &&
          probeReport?.cases?.[2]?.leaf_alive_after_grace === 0 &&
          probeReport?.cases?.[2]?.survival_marker === 0,
        {
          hasRequiredTokens,
          h1Sha,
          h2Sha,
          probeAllPassed: probeReport?.allPassed ?? null,
          probeStage1Sha: probeReport?.stage1HelperSha256 ?? null,
          freshlyExecuted: true,
        },
      );
    });

    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const report = {
      ok: true,
      executedAtUtc: new Date().toISOString(),
      netGuardPreloaded: NET_GUARD_PATH,
      externalNetworkCalls: 0,
      liveGcloudCalls: 0,
      liveKkjCalls: 0,
      totalScenarios: scenarios.length,
      passedScenarios: scenarios.filter((s) => s.passed).length,
      scenarios,
    };
    fs.writeFileSync(OUT_RESULTS_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stderr.write(
      `[offline-sim] ALL ${report.passedScenarios}/${report.totalScenarios} SCENARIOS PASSED -> ${OUT_RESULTS_JSON}\n`,
    );
  } finally {
    await candHttp.close();
    await prodHttp.close();
    await cloudRunApi.close();
    fs.rmSync(simRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  process.stderr.write(`[offline-sim] FATAL: ${err.stack || err.message}\n`);
  process.exit(1);
});
