# Release and Registry

## 日本語

リリース前チェック:

```bash
npm run release:gate
```

MCP Registry公開:

```bash
mcp-publisher login github
npm run registry:validate
mcp-publisher publish
```

`package.json` の `mcpName` と `server.json` の `name` は一致させます。

## English

Pre-release checks:

```bash
npm run release:gate
```

Publish to the MCP Registry:

```bash
mcp-publisher login github
npm run registry:validate
mcp-publisher publish
```

Keep `package.json` `mcpName` and `server.json` `name` identical.

Remote Streamable HTTP entries must not be added to `server.json` until the Cloud Run URL is live and publicly reachable.

The first npm release should be published as `koko-call-mcp` with stdio metadata only. Add `remotes` in a follow-up release after Cloud Run health checks pass.

## Bahasa Indonesia

Pemeriksaan sebelum rilis:

```bash
npm run release:gate
```

Publikasi ke MCP Registry:

```bash
mcp-publisher login github
npm run registry:validate
mcp-publisher publish
```

Pastikan `mcpName` di `package.json` sama dengan `name` di `server.json`.
