#!/usr/bin/env node
import { startHttpServer } from "./transports/http.js";
import { startStdioServer } from "./transports/stdio.js";

const version = "0.2.0";
const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  process.stdout.write(
    [
      "KokoCallMCP - Japan government procurement search MCP server",
      "",
      "Usage:",
      "  koko-call-mcp           Start stdio MCP server",
      "  koko-call-mcp --http    Start Streamable HTTP MCP server",
      "  koko-call-mcp --version Print version",
      "",
      "Environment:",
      "  PORT                         HTTP port, default 8080",
      "  HTTP_HOST                    HTTP bind host; defaults to 127.0.0.1 locally and 0.0.0.0 on Cloud Run",
      "  ALLOWED_ORIGINS              Comma-separated allowed Origin values for HTTP transport",
      "  KOKO_CALL_RATE_LIMIT_PER_SECOND Upstream KKJ request limit, default 1",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

if (args.has("--version") || args.has("-v")) {
  process.stdout.write(`${version}\n`);
  process.exit(0);
}

const mode = process.argv.includes("--http") ? "http" : "stdio";

if (mode === "http") {
  await startHttpServer();
} else {
  await startStdioServer();
}
