# MCP Inspector

## 日本語

ローカルstdioの確認:

```bash
npm run build
npx @modelcontextprotocol/inspector node dist/server.js
```

HTTPの確認:

```bash
npm run dev:http
npx @modelcontextprotocol/inspector
```

remote MCPの自動確認:

```bash
npm run remote:mcp
```

remote MCPをInspectorで見る場合:

```bash
npx --yes @modelcontextprotocol/inspector
```

接続URL:

```text
https://mcp.bid-jp.com/mcp
```

注意: Inspectorの初期値に `mcp-server-everything` が入っている場合、それはSTDIOサンプルです。JP Bids MCPのremote確認では `Transport Type` を `Streamable HTTP` に切り替えてください。

サンプル入力:

```json
{
  "query": "システム",
  "prefecture": "鹿児島県",
  "category": "役務",
  "limit": 3
}
```

Inspectorでは Tools、Prompts、Resources、Resource Templates、Completion、Notifications を確認してください。

## English

Check local stdio:

```bash
npm run build
npx @modelcontextprotocol/inspector node dist/server.js
```

Check HTTP:

```bash
npm run dev:http
npx @modelcontextprotocol/inspector
```

Check the remote MCP endpoint automatically:

```bash
npm run remote:mcp
```

Inspect the remote MCP endpoint manually:

```bash
npx --yes @modelcontextprotocol/inspector
```

Connection URL:

```text
https://mcp.bid-jp.com/mcp
```

Note: If Inspector defaults to `mcp-server-everything`, that is a STDIO sample. For JP Bids MCP remote testing, switch `Transport Type` to `Streamable HTTP`.

Sample input:

```json
{
  "query": "system",
  "prefecture": "鹿児島県",
  "category": "役務",
  "limit": 3
}
```

Verify Tools, Prompts, Resources, Resource Templates, Completion, and Notifications.

## Bahasa Indonesia

Periksa stdio lokal:

```bash
npm run build
npx @modelcontextprotocol/inspector node dist/server.js
```

Periksa HTTP:

```bash
npm run dev:http
npx @modelcontextprotocol/inspector
```

Periksa endpoint MCP remote secara otomatis:

```bash
npm run remote:mcp
```

Periksa endpoint MCP remote secara manual:

```bash
npx --yes @modelcontextprotocol/inspector
```

URL koneksi:

```text
https://mcp.bid-jp.com/mcp
```

Catatan: Jika Inspector memakai default `mcp-server-everything`, itu adalah contoh STDIO. Untuk pengujian remote JP Bids MCP, ubah `Transport Type` menjadi `Streamable HTTP`.

Contoh input:

```json
{
  "query": "system",
  "prefecture": "鹿児島県",
  "category": "役務",
  "limit": 3
}
```

Verifikasi Tools, Prompts, Resources, Resource Templates, Completion, dan Notifications.
