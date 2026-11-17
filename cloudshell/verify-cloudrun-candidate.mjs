// cloudshell/verify-cloudrun-candidate.mjs
// End-to-end zero-KKJ-traffic HTTP/OAuth/MCP/UI verifier for Cloud Run Stage 1 & Stage 2.
// Verifies:
//   1. /health (200), /readyz (200), /stats (200 + expected version), GET /mcp (405), DELETE /mcp (405)
//   2. /.well-known/openai-apps-challenge (404 when unset, or exact token when configured)
//   3. /.well-known/mcp/server-card.json (200, expected version, exact 7 public_mvp tools)
//   4. OAuth well-known metadata (S256, mcp:read, issuer)
//   5. Negative controls: unauth POST /mcp -> 401 + WWW-Authenticate; forged Bearer -> 401;
//      PKCE wrong code_verifier -> 400
//   6. Real OAuth DCR -> Authorize (302 + RFC 9207 iss) -> PKCE S256 Token (200 + Cache-Control: no-store)
//   7. Authenticated MCP 2025-11-25 initialize (serverInfo name & version) + tools/list (exact 7 tools)
//   8. Authenticated MCP 2026-07-28 tools/list (Mcp-Method + _meta -> exact 7 tools)
//   9. Authenticated MCP 2026-07-28 resources/read (ui://jp-bids/search-results.html with Mcp-Name === params.uri
//      -> exact SHA-256 match against expectedUiHtmlSha256)
// All tokens/codes are strictly redacted in output JSON & stderr logs.

import crypto from "node:crypto";
import fs from "node:fs";

const EXPECTED_TOOLS = [
  "export_bid_shortlist",
  "extract_bid_requirements",
  "get_bid_detail",
  "list_recent_bids",
  "rank_bids",
  "search_bids",
  "search_bids_app",
];

const ALLOWED_SERVER_NAMES = new Set(["JP Bids", "jp-bids-mcp", "io.github.sugukurukabe/jp-bids"]);

function sha256Hex(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        out[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        out[a.slice(2)] = argv[++i];
      }
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(args["base-url"] ?? "").replace(/\/+$/, "");
  const expectedVersion = String(args["expected-version"] ?? "0.10.1");
  const expectedUiSha256 = String(args["expected-ui-sha256"] ?? "").toLowerCase();
  const expectedChallengeToken = args["expected-challenge-token"] ?? "";
  const outFile = args["out-json"];

  const checks = [];
  function recordCheck(id, passed, detail, evidence = {}) {
    checks.push({ id, passed: Boolean(passed), detail, evidence });
    if (!passed) {
      throw new Error(`${id} FAILED: ${detail}`);
    }
  }

  let observedUiHtmlSha256 = null;

  try {
    if (!baseUrl.startsWith("http://127.0.0.1:") && !baseUrl.startsWith("https://")) {
      throw new Error(`Invalid --base-url '${baseUrl}'`);
    }
    if (!/^[0-9a-f]{64}$/.test(expectedUiSha256)) {
      throw new Error(`Invalid --expected-ui-sha256 '${expectedUiSha256}'`);
    }

    // 1. Health, Readyz, Stats, GET/DELETE /mcp
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthJson = healthRes.status === 200 ? await healthRes.json() : null;
    recordCheck(
      "C01_HEALTH",
      healthRes.status === 200 && healthJson?.ok === true,
      "/health 200 ok",
      {
        status: healthRes.status,
      },
    );

    const readyzRes = await fetch(`${baseUrl}/readyz`);
    const readyzJson = readyzRes.status === 200 ? await readyzRes.json() : null;
    recordCheck(
      "C02_READYZ",
      readyzRes.status === 200 && readyzJson?.ok === true,
      "/readyz 200 ok",
      {
        status: readyzRes.status,
      },
    );

    const statsRes = await fetch(`${baseUrl}/stats`);
    const statsJson = statsRes.status === 200 ? await statsRes.json() : null;
    recordCheck(
      "C03_STATS_VERSION",
      statsRes.status === 200 && statsJson?.version === expectedVersion,
      `/stats version expected ${expectedVersion}, got ${statsJson?.version}`,
      { status: statsRes.status, version: statsJson?.version ?? null },
    );

    const getMcpRes = await fetch(`${baseUrl}/mcp`, { method: "GET" });
    const delMcpRes = await fetch(`${baseUrl}/mcp`, { method: "DELETE" });
    recordCheck(
      "C04_MCP_METHODS_405",
      getMcpRes.status === 405 && delMcpRes.status === 405,
      `GET/DELETE /mcp expected 405/405, got ${getMcpRes.status}/${delMcpRes.status}`,
      { getStatus: getMcpRes.status, deleteStatus: delMcpRes.status },
    );

    // 2. OpenAI domain challenge endpoint
    const chalRes = await fetch(`${baseUrl}/.well-known/openai-apps-challenge`);
    const chalBody = await chalRes.text();
    if (expectedChallengeToken) {
      recordCheck(
        "C05_OPENAI_CHALLENGE",
        chalRes.status === 200 && chalBody === expectedChallengeToken,
        "Configured OpenAI challenge token match",
        { status: chalRes.status },
      );
    } else {
      recordCheck(
        "C05_OPENAI_CHALLENGE",
        chalRes.status === 404,
        `Unset OpenAI challenge expected 404, got ${chalRes.status}`,
        { status: chalRes.status },
      );
    }

    // 3. Server card 7-tool & version check
    const cardRes = await fetch(`${baseUrl}/.well-known/mcp/server-card.json`);
    const cardJson = cardRes.status === 200 ? await cardRes.json() : null;
    const cardTools = Array.isArray(cardJson?.tools)
      ? cardJson.tools.map((t) => t.name).sort()
      : [];
    recordCheck(
      "C06_SERVER_CARD",
      cardRes.status === 200 &&
        cardJson?.serverInfo?.version === expectedVersion &&
        JSON.stringify(cardTools) === JSON.stringify(EXPECTED_TOOLS),
      `Server card v${cardJson?.serverInfo?.version} with ${cardTools.length} tools`,
      { version: cardJson?.serverInfo?.version ?? null, toolCount: cardTools.length },
    );

    // 4. OAuth well-known metadata
    const prMetaRes = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
    const prMeta = prMetaRes.status === 200 ? await prMetaRes.json() : null;
    const asMetaRes = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
    const asMeta = asMetaRes.status === 200 ? await asMetaRes.json() : null;
    recordCheck(
      "C07_OAUTH_METADATA",
      prMetaRes.status === 200 &&
        asMetaRes.status === 200 &&
        Array.isArray(prMeta?.scopes_supported) &&
        prMeta.scopes_supported.includes("mcp:read") &&
        Array.isArray(asMeta?.code_challenge_methods_supported) &&
        asMeta.code_challenge_methods_supported.includes("S256") &&
        typeof asMeta?.issuer === "string" &&
        asMeta.issuer.length > 0,
      "OAuth protected-resource and authorization-server metadata valid",
      { issuer: asMeta?.issuer ?? null },
    );

    const canonicalIssuer = String(asMeta.issuer).replace(/\/+$/, "");
    const canonicalResource = String(prMeta.resource || `${canonicalIssuer}/mcp`);

    // 5. Negative controls: unauth 401, forged token 401, wrong PKCE verifier 400
    const unauthRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    const wwwAuth = unauthRes.headers.get("www-authenticate") || "";
    recordCheck(
      "C08_NEG_UNAUTH_401",
      unauthRes.status === 401 && wwwAuth.includes("resource_metadata="),
      `Unauthenticated POST /mcp returned ${unauthRes.status}`,
      {
        status: unauthRes.status,
        hasResourceMetadataHeader: wwwAuth.includes("resource_metadata="),
      },
    );

    const forgedRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer forged.invalid.token",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    recordCheck(
      "C09_NEG_FORGED_BEARER_401",
      forgedRes.status === 401,
      `Forged Bearer POST /mcp expected 401, got ${forgedRes.status}`,
      { status: forgedRes.status },
    );

    const redirectUri = "http://127.0.0.1:58999/callback";
    const dcrRes = await fetch(`${baseUrl}/oauth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "CloudRun Candidate Verifier",
        redirect_uris: [redirectUri],
      }),
    });
    const dcrJson = dcrRes.status === 201 ? await dcrRes.json() : null;
    recordCheck(
      "C10_OAUTH_DCR",
      dcrRes.status === 201 && typeof dcrJson?.client_id === "string",
      `DCR POST /oauth/register returned ${dcrRes.status}`,
      { status: dcrRes.status },
    );

    async function issueAuthCode(verifier) {
      const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
      const authPost = await fetch(`${baseUrl}/oauth/authorize`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: dcrJson.client_id,
          redirect_uri: redirectUri,
          state: "cand-verify-state",
          scope: "mcp:read",
          code_challenge: challenge,
          code_challenge_method: "S256",
          resource: canonicalResource,
          action: "allow",
        }).toString(),
      });
      const loc = authPost.headers.get("location") || "";
      const parsed = loc ? new URL(loc) : null;
      return {
        status: authPost.status,
        code: parsed?.searchParams.get("code") ?? null,
        iss: parsed?.searchParams.get("iss") ?? null,
      };
    }

    const negCodeIssued = await issueAuthCode(crypto.randomBytes(32).toString("base64url"));
    const wrongPkceRes = await fetch(`${baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: negCodeIssued.code ?? "",
        code_verifier: crypto.randomBytes(32).toString("base64url"),
        client_id: dcrJson.client_id,
        redirect_uri: redirectUri,
      }).toString(),
    });
    recordCheck(
      "C11_NEG_PKCE_MISMATCH_400",
      negCodeIssued.status === 302 && wrongPkceRes.status === 400,
      `Wrong PKCE code_verifier expected 400, got ${wrongPkceRes.status}`,
      { authorizeStatus: negCodeIssued.status, tokenStatus: wrongPkceRes.status },
    );

    // 6. Valid PKCE S256 token issuance
    const validVerifier = crypto.randomBytes(32).toString("base64url");
    const posCodeIssued = await issueAuthCode(validVerifier);
    const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: posCodeIssued.code ?? "",
        code_verifier: validVerifier,
        client_id: dcrJson.client_id,
        redirect_uri: redirectUri,
      }).toString(),
    });
    const cacheControl = (tokenRes.headers.get("cache-control") || "").toLowerCase();
    const tokenJson = tokenRes.status === 200 ? await tokenRes.json() : null;
    const accessToken = tokenJson?.access_token;
    recordCheck(
      "C12_OAUTH_PKCE_TOKEN_200",
      posCodeIssued.status === 302 &&
        posCodeIssued.iss === canonicalIssuer &&
        tokenRes.status === 200 &&
        cacheControl.includes("no-store") &&
        typeof accessToken === "string" &&
        accessToken.split(".").length === 3,
      `PKCE token exchange status=${tokenRes.status}, Cache-Control='${cacheControl}'`,
      { status: tokenRes.status, cacheControl, tokenRedacted: true },
    );

    // 7. Authenticated MCP 2025-11-25 initialize & tools/list
    const init2025Res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 101,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "cloudrun-verifier", version: "1.0.0" },
        },
      }),
    });
    const init2025Json = init2025Res.status === 200 ? await init2025Res.json() : null;
    const srvInfo = init2025Json?.result?.serverInfo;
    recordCheck(
      "C13_MCP_2025_INITIALIZE",
      init2025Res.status === 200 &&
        ALLOWED_SERVER_NAMES.has(srvInfo?.name) &&
        srvInfo?.version === expectedVersion,
      `2025-11-25 initialize serverInfo=${srvInfo?.name}@${srvInfo?.version}`,
      {
        status: init2025Res.status,
        serverName: srvInfo?.name ?? null,
        serverVersion: srvInfo?.version ?? null,
      },
    );

    const tools2025Res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-11-25",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 102, method: "tools/list", params: {} }),
    });
    const tools2025Json = tools2025Res.status === 200 ? await tools2025Res.json() : null;
    const tools2025Names = Array.isArray(tools2025Json?.result?.tools)
      ? tools2025Json.result.tools.map((t) => t.name).sort()
      : [];
    recordCheck(
      "C14_MCP_2025_TOOLS_7",
      tools2025Res.status === 200 &&
        JSON.stringify(tools2025Names) === JSON.stringify(EXPECTED_TOOLS),
      `2025-11-25 tools/list returned ${tools2025Names.length} tools`,
      { status: tools2025Res.status, tools: tools2025Names },
    );

    // 8. Authenticated MCP 2026-07-28 stateless tools/list
    const tools2026Res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2026-07-28",
        "Mcp-Method": "tools/list",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 201,
        method: "tools/list",
        params: {
          _meta: {
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            "io.modelcontextprotocol/clientInfo": { name: "cloudrun-verifier", version: "1.0.0" },
            "io.modelcontextprotocol/clientCapabilities": {},
          },
        },
      }),
    });
    const tools2026Json = tools2026Res.status === 200 ? await tools2026Res.json() : null;
    const tools2026Names = Array.isArray(tools2026Json?.result?.tools)
      ? tools2026Json.result.tools.map((t) => t.name).sort()
      : [];
    recordCheck(
      "C15_MCP_2026_TOOLS_7",
      tools2026Res.status === 200 &&
        JSON.stringify(tools2026Names) === JSON.stringify(EXPECTED_TOOLS),
      `2026-07-28 tools/list status=${tools2026Res.status}, count=${tools2026Names.length}`,
      { status: tools2026Res.status, tools: tools2026Names },
    );

    // 9. Authenticated MCP 2026-07-28 resources/read (Mcp-Name === params.uri) + UI HTML SHA-256 match
    const uiUri = "ui://jp-bids/search-results.html";
    const uiReadRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2026-07-28",
        "Mcp-Method": "resources/read",
        "Mcp-Name": uiUri,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 202,
        method: "resources/read",
        params: {
          uri: uiUri,
          _meta: {
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            "io.modelcontextprotocol/clientInfo": { name: "cloudrun-verifier", version: "1.0.0" },
            "io.modelcontextprotocol/clientCapabilities": {},
          },
        },
      }),
    });
    const uiReadJson = uiReadRes.status === 200 ? await uiReadRes.json() : null;
    const uiContent = uiReadJson?.result?.contents?.[0];
    const uiText = typeof uiContent?.text === "string" ? uiContent.text : "";
    observedUiHtmlSha256 = uiText ? sha256Hex(uiText) : null;

    recordCheck(
      "C16_MCP_2026_UI_RESOURCE_HASH",
      uiReadRes.status === 200 &&
        uiContent?.mimeType === "text/html;profile=mcp-app" &&
        observedUiHtmlSha256 === expectedUiSha256,
      `2026-07-28 resources/read UI SHA-256 expected ${expectedUiSha256}, got ${observedUiHtmlSha256}`,
      {
        status: uiReadRes.status,
        mimeType: uiContent?.mimeType ?? null,
        observedUiHtmlSha256,
        expectedUiSha256,
      },
    );

    const summary = {
      ok: true,
      verifiedAtUtc: new Date().toISOString(),
      baseUrl,
      expectedVersion,
      expectedUiSha256,
      observedUiHtmlSha256,
      totalChecks: checks.length,
      passedChecks: checks.length,
      liveKkjCalls: 0,
      checks,
    };
    if (outFile) {
      fs.writeFileSync(outFile, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    }
    process.stderr.write(
      `[verify-cloudrun-candidate] PASS (${checks.length}/${checks.length}) on ${baseUrl}\n`,
    );
    process.exit(0);
  } catch (err) {
    const failSummary = {
      ok: false,
      verifiedAtUtc: new Date().toISOString(),
      baseUrl,
      expectedVersion,
      expectedUiSha256,
      observedUiHtmlSha256,
      error: err.message,
      checks,
    };
    if (outFile) {
      fs.writeFileSync(outFile, `${JSON.stringify(failSummary, null, 2)}\n`, "utf8");
    }
    process.stderr.write(`[verify-cloudrun-candidate] FAIL on ${baseUrl}: ${err.message}\n`);
    process.exit(21);
  }
}

main();
