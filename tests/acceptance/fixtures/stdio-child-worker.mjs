// tests/acceptance/fixtures/stdio-child-worker.mjs
// Real stdio transport child worker process for Gate 1 Acceptance Testing (T03-D)
//
// SCOPE: Standalone Node.js child process that connects JP Bids MCP Server
// via StdioServerTransport. Communicates with parent process strictly via stdin/stdout.
// CONSTRAINTS: stdout is strictly reserved for JSON-RPC messages. All debug logs to stderr.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { KkjClient } from "../../../dist/api/kkj-client.js";
import { createJpBidsServer } from "../../../dist/mcp.js";

// Ensure process exits cleanly on parent disconnect or termination signal
process.on("disconnect", () => {
  process.exit(0);
});

process.stdin.on("close", () => {
  process.exit(0);
});

async function main() {
  try {
    // In-memory mock KKJ client with static search response
    const mockKkj = new KkjClient({
      rateLimitPerSecond: 1000,
      timeoutMs: 5000,
      fetchImpl: async () => {
        return new Response(
          '<?xml version="1.0" encoding="utf-8"?><SearchItems><Item><Key>TEST-001</Key><ProjectName>テスト案件</ProjectName></Item></SearchItems>',
          { status: 200, headers: { "Content-Type": "application/xml; charset=utf-8" } },
        );
      },
    });

    const server = createJpBidsServer({
      kkjClient: mockKkj,
      profile: "public_mvp",
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write("[stdio-worker] Connected StdioServerTransport successfully\n");
  } catch (err) {
    process.stderr.write(`[stdio-worker] Fatal initialization error: ${err.message}\n`);
    process.exit(1);
  }
}

main();
