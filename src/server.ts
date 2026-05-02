#!/usr/bin/env node
import { startHttpServer } from "./transports/http.js";
import { startStdioServer } from "./transports/stdio.js";

const version = "0.3.3";
const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  process.stdout.write(
    [
      "JP Bids MCP - Japan government procurement search MCP server",
      "",
      "Usage:",
      "  jp-bids-mcp           Start stdio MCP server",
      "  jp-bids-mcp --http    Start Streamable HTTP MCP server",
      "  jp-bids-mcp --version Print version",
      "",
      "Environment:",
      "  PORT                         HTTP port, default 8080",
      "  HTTP_HOST                    HTTP bind host; defaults to 127.0.0.1 locally and 0.0.0.0 on Cloud Run",
      "  ALLOWED_ORIGINS              Comma-separated allowed Origin values for HTTP transport",
      "  JP_BIDS_RATE_LIMIT_PER_SECOND Upstream KKJ request limit, default 1",
      "  KOKO_CALL_RATE_LIMIT_PER_SECOND Backward-compatible alias for JP_BIDS_RATE_LIMIT_PER_SECOND",
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
