# JP Bids MCP

Search Japanese public procurement notices through MCP.

```text
Remote MCP: https://mcp.bid-jp.com/mcp
npm:        jp-bids-mcp
Registry:   io.github.sugukurukabe/jp-bids
```

## Quick Start

Use the remote endpoint from any Streamable HTTP compatible MCP client:

```text
https://mcp.bid-jp.com/mcp
```

With MCP Inspector:

```bash
npx --yes @modelcontextprotocol/inspector
```

Set `Transport Type` to `Streamable HTTP` and use the remote URL above. Do not use the default STDIO sample command such as `mcp-server-everything`.

Sample `search_bids` arguments:

```json
{
  "query": "システム",
  "prefecture": "鹿児島県",
  "category": "役務",
  "limit": 3
}
```

Local stdio:

```bash
npx --yes jp-bids-mcp
```

Check without starting an MCP session:

```bash
npx --yes jp-bids-mcp --version
```

## What It Provides

- Read-only search for Japanese public procurement notices.
- Typed MCP tools with structured attribution.
- Resources and Resource Templates for targeted context.
- Remote Streamable HTTP and local stdio transports.

Data source: 中小企業庁 官公需情報ポータルサイト 検索API.

## Tools

- `search_bids`
- `list_recent_bids`
- `get_bid_detail`
- `summarize_bids_by_org`

## Resources

- `attribution://kkj`
- `docs://api-reference`
- `codes://prefectures`
- `bid://{bid_key}`
- `prefecture://{lg_code}`
- `org://{organization_name}`

## Verification

```bash
npm run remote:health
npm run remote:mcp
```

More examples: `examples/remote-smoke-prompts.md`.

## Documentation

- `docs/architecture.md`
- `docs/inspector.md`
- `docs/deployment-cloud-run.md`
- `docs/remote-release-checklist.md`
- `docs/submissions/mcp-directories.md`
- `docs/articles/zenn-jp-bids-mcp.md`
- `docs/articles/note-public-data-mcp.md`
- `docs/adr/`
- `public/.well-known/agents.json`

## Notes

This server does not store upstream documents or attachment files. Results are reference information and should be verified against official procurement documents before bidding decisions.
