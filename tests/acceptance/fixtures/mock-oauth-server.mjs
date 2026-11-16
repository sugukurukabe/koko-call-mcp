// tests/acceptance/fixtures/mock-oauth-server.mjs
// Local Mock Authorization Server for Gate 1 Acceptance Testing (T03-B)
//
// SCOPE: In-memory OAuth 2.0 Authorization Server simulation for PKCE S256,
// authorization code issuance, token exchange, and 429 rate limiting.
// SECURITY: Localhost loopback only. Zero outbound network egress.

import crypto from "node:crypto";
import http from "node:http";
import { URL } from "node:url";

/**
 * Creates and starts an in-memory mock OAuth 2.0 Authorization Server.
 * Listens on an ephemeral localhost port (port 0).
 */
export async function startMockOAuthServer() {
  const codes = new Map(); // code -> { codeChallenge, clientId, expiresAt }
  let tokenRequestCount = 0;
  const RATE_LIMIT_THRESHOLD = 5;

  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

    // 1. Metadata endpoint
    if (req.method === "GET" && reqUrl.pathname === "/.well-known/oauth-authorization-server") {
      const origin = `http://127.0.0.1:${server.address().port}`;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          issuer: origin,
          authorization_endpoint: `${origin}/oauth/authorize`,
          token_endpoint: `${origin}/oauth/token`,
          response_types_supported: ["code"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["none"],
        }),
      );
      return;
    }

    // 2. Authorization code issuance endpoint
    if (req.method === "GET" && reqUrl.pathname === "/oauth/authorize") {
      const responseType = reqUrl.searchParams.get("response_type");
      const codeChallenge = reqUrl.searchParams.get("code_challenge");
      const codeChallengeMethod = reqUrl.searchParams.get("code_challenge_method");

      if (responseType !== "code" || !codeChallenge || codeChallengeMethod !== "S256") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "invalid_request",
            error_description: "Requires response_type=code and code_challenge_method=S256",
          }),
        );
        return;
      }

      const authCode = `mock_code_${crypto.randomBytes(16).toString("hex")}`;
      codes.set(authCode, {
        codeChallenge,
        expiresAt: Date.now() + 60000,
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: authCode, state: reqUrl.searchParams.get("state") || null }));
      return;
    }

    // 3. Token exchange endpoint
    if (req.method === "POST" && reqUrl.pathname === "/oauth/token") {
      tokenRequestCount++;

      // Rate limit test trigger
      if (tokenRequestCount > RATE_LIMIT_THRESHOLD) {
        res.writeHead(429, {
          "Content-Type": "application/json",
          "Retry-After": "1",
        });
        res.end(
          JSON.stringify({ error: "rate_limited", error_description: "Too many token requests" }),
        );
        return;
      }

      let body = "";
      for await (const chunk of req) {
        body += chunk;
      }

      let params;
      const contentType = req.headers["content-type"] || "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        params = new URLSearchParams(body);
      } else {
        try {
          const json = JSON.parse(body);
          params = new URLSearchParams(json);
        } catch {
          params = new URLSearchParams(body);
        }
      }

      const grantType = params.get("grant_type");
      const code = params.get("code");
      const codeVerifier = params.get("code_verifier");

      if (grantType !== "authorization_code" || !code || !codeVerifier) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "invalid_request",
            error_description: "Missing grant_type, code, or code_verifier",
          }),
        );
        return;
      }

      const record = codes.get(code);
      if (!record || Date.now() > record.expiresAt) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "invalid_grant",
            error_description: "Invalid or expired authorization code",
          }),
        );
        return;
      }

      // PKCE S256 verification: BASE64URL-ENCODE(SHA256(code_verifier)) == code_challenge
      const calculatedChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

      if (calculatedChallenge !== record.codeChallenge) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ error: "invalid_grant", error_description: "PKCE verification failed" }),
        );
        return;
      }

      // Code consumed (one-time use)
      codes.delete(code);

      const accessToken = `mock_access_token_${crypto.randomBytes(24).toString("hex")}`;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          access_token: accessToken,
          token_type: "Bearer",
          expires_in: 3600,
          scope: "bids:read",
        }),
      );
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    server,
    port,
    baseUrl,
    close: async () => {
      if (typeof server.closeAllConnections === "function") {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    },
    resetRateLimit: () => {
      tokenRequestCount = 0;
    },
    triggerRateLimit: () => {
      tokenRequestCount = RATE_LIMIT_THRESHOLD + 1;
    },
  };
}
