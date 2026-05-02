# JP Bids MCP

```bash
npx --yes jp-bids-mcp --version
```

Remote MCP endpoint:

```text
https://mcp.bid-jp.com/mcp
```

## 日本語

JP Bids MCP は、日本全国の官公需入札情報を Claude、Cursor、VS Code などのMCPクライアントから検索するための読み取り専用MCPサーバーです。

出典: 中小企業庁 官公需情報ポータルサイト 検索API。

### 特徴

- MCP 2025-11-25 の Tools、Prompts、Resources、Resource Templates、Completion、Logging に対応。
- `search_bids`、`list_recent_bids`、`get_bid_detail`、`summarize_bids_by_org` の4ツール。
- すべての構造化出力に `attribution` を含め、出典明記を強制。
- stdio と Streamable HTTP の両方に対応。
- `org://{organization_name}` などの動的Resource Templateで、読み取り専用コンテキストを必要な範囲だけ取得できます。
- Sampling、Tasks、OAuthは未実装です。必要条件が出た時点でADRに基づき追加します。

### 検索の使い分け

- `query`: 全文検索。複数キーワードや幅広い探索に使います。
- `project_name`: 件名だけを絞り込む場合に使います。
- `organization_name`: 発注機関名で探す場合に使います。
- `prefecture`: 都道府県で絞り込む場合に使います。
- 日付条件: `issued_*` は公告日、`due_*` は入札開始日、`opening_*` は開札日、`period_end_*` は納入期限日です。

### 30秒で試す

remote MCPが使えるクライアントでは、以下に接続してください。

```text
https://mcp.bid-jp.com/mcp
```

MCP Inspector:

```bash
npx --yes @modelcontextprotocol/inspector
```

Inspectorでは `Transport Type` を `Streamable HTTP` にし、URLへ `https://mcp.bid-jp.com/mcp` を入れます。`mcp-server-everything` のようなSTDIOサンプルは使いません。

接続後のサンプル:

```json
{
  "query": "システム",
  "prefecture": "鹿児島県",
  "category": "役務",
  "limit": 3
}
```

追加サンプルは `examples/remote-smoke-prompts.md` にあります。

### ローカル起動

```bash
npm install
npm run build
npm start
```

Published package name:

```bash
npx jp-bids-mcp
```

Check the CLI without starting an MCP session:

```bash
npx jp-bids-mcp --help
```

HTTP:

```bash
npm run start:http
```

### テスト

```bash
npm run check
npm run bench
npm run api:health
npm run build:repro
npm run release:gate
npm run publish:dry-run
```

### 関連ドキュメント

- `docs/architecture.md`
- `docs/inspector.md`
- `docs/deployment-cloud-run.md`
- `docs/release.md`
- `docs/reproducible-builds.md`
- `docs/api-health-check.md`
- `docs/releases/v0.3.2.md`
- `docs/remote-release-checklist.md`
- `docs/demo-script.md`

## English

JP Bids MCP is a read-only MCP server for searching Japan government procurement bid information from MCP clients such as Claude, Cursor, and VS Code.

Source: Small and Medium Enterprise Agency KKJ procurement search API.

### Features

- Supports MCP 2025-11-25 Tools, Prompts, Resources, Resource Templates, Completion, and Logging.
- Four focused tools: `search_bids`, `list_recent_bids`, `get_bid_detail`, and `summarize_bids_by_org`.
- Every structured result includes required `attribution`.
- Supports both stdio and Streamable HTTP.
- Includes contract tests, property-based tests, benchmarks, mutation testing configuration, SBOM generation, CodeQL, and Dependency Review.
- Remote Streamable HTTP endpoint: `https://mcp.bid-jp.com/mcp`.
- Dynamic Resource Templates such as `org://{organization_name}` provide read-only context without overloading the model context window.
- Sampling, Tasks, and OAuth are intentionally not implemented yet; they will be added only after concrete requirements and ADR review.

### Search Guidance

- `query`: full-text search for broad discovery.
- `project_name`: project-title filtering.
- `organization_name`: buyer or issuing organization filtering.
- `prefecture`: prefecture filtering.
- Date filters: `issued_*` is notice date, `due_*` is tender submission date, `opening_*` is opening date, and `period_end_*` is delivery/end date.

### Quick Remote Test

Connect an MCP client to:

```text
https://mcp.bid-jp.com/mcp
```

For MCP Inspector:

```bash
npx --yes @modelcontextprotocol/inspector
```

Set `Transport Type` to `Streamable HTTP` and use `https://mcp.bid-jp.com/mcp` as the URL. Do not use the default STDIO sample command such as `mcp-server-everything`.

Example `search_bids` arguments:

```json
{
  "query": "system",
  "prefecture": "鹿児島県",
  "category": "役務",
  "limit": 3
}
```

## Bahasa Indonesia

JP Bids MCP adalah server MCP read-only untuk mencari informasi tender pengadaan pemerintah Jepang dari klien MCP seperti Claude, Cursor, dan VS Code.

Sumber: API pencarian pengadaan KKJ dari Small and Medium Enterprise Agency.

### Fitur

- Mendukung Tools, Prompts, Resources, Resource Templates, Completion, dan Logging dari MCP 2025-11-25.
- Empat tool terfokus: `search_bids`, `list_recent_bids`, `get_bid_detail`, dan `summarize_bids_by_org`.
- Setiap hasil terstruktur wajib menyertakan `attribution`.
- Mendukung stdio dan Streamable HTTP.
- Menyertakan contract test, property-based test, benchmark, konfigurasi mutation testing, SBOM, CodeQL, dan Dependency Review.
- Endpoint remote Streamable HTTP: `https://mcp.bid-jp.com/mcp`.
- Resource Template dinamis seperti `org://{organization_name}` menyediakan konteks read-only tanpa membebani context window model.
- Sampling, Tasks, dan OAuth sengaja belum diimplementasikan; fitur tersebut hanya ditambahkan setelah ada kebutuhan konkret dan review ADR.

### Panduan Pencarian

- `query`: pencarian full-text untuk eksplorasi luas.
- `project_name`: filter berdasarkan judul proyek.
- `organization_name`: filter berdasarkan instansi pembeli atau penerbit.
- `prefecture`: filter berdasarkan prefektur.
- Filter tanggal: `issued_*` untuk tanggal pengumuman, `due_*` untuk tanggal mulai tender, `opening_*` untuk tanggal pembukaan, dan `period_end_*` untuk tanggal akhir pengiriman.

### Uji Remote Cepat

Hubungkan klien MCP ke:

```text
https://mcp.bid-jp.com/mcp
```

Untuk MCP Inspector:

```bash
npx --yes @modelcontextprotocol/inspector
```

Pilih `Transport Type` sebagai `Streamable HTTP` dan gunakan URL `https://mcp.bid-jp.com/mcp`. Jangan gunakan command STDIO contoh seperti `mcp-server-everything`.
