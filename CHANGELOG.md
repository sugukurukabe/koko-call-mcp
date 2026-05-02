# Changelog

## 日本語

### 0.3.1

- `org://{organization_name}` Resource Template を追加。
- Resource metadata/annotations と `agents.json` を追加。
- Tasks、Sampling、OAuth、Cloud Run remoteの導入条件をADR化。

### 0.3.0

- 公開パッケージ名を `jp-bids-mcp` に変更。
- MCPサーバー名、CLI、Registry metadataを JP Bids MCP に統一。
- 旧環境変数 `KOKO_CALL_RATE_LIMIT_PER_SECOND` は互換aliasとして維持。

### 0.2.0

- 検索条件に開札日・納入期限日を追加。
- `bid_key` 詳細取得を直近検索キャッシュ優先に改善。
- fixtureと契約テストを拡充し、実API検証・Registry検証をrelease gateに追加。

### 0.1.0

- 初期実装。Tools、Prompts、Resources、Resource Templates、Completion、Logging、stdio、Streamable HTTPを追加。

## English

### 0.3.1

- Added the `org://{organization_name}` Resource Template.
- Added Resource metadata/annotations and `agents.json`.
- Documented introduction criteria for Tasks, Sampling, OAuth, and Cloud Run remote metadata in an ADR.

### 0.3.0

- Renamed the public package to `jp-bids-mcp`.
- Unified the MCP server name, CLI, and Registry metadata under JP Bids MCP.
- Kept `KOKO_CALL_RATE_LIMIT_PER_SECOND` as a backward-compatible alias.

### 0.2.0

- Added opening date and delivery/end date search filters.
- Improved `bid_key` detail lookup by using the recent search cache first.
- Expanded fixtures and contract tests, and added live API and Registry validation gates.

### 0.1.0

- Initial implementation with Tools, Prompts, Resources, Resource Templates, Completion, Logging, stdio, and Streamable HTTP.

## Bahasa Indonesia

### 0.3.1

- Menambahkan Resource Template `org://{organization_name}`.
- Menambahkan metadata/annotations Resource dan `agents.json`.
- Mendokumentasikan kriteria pengenalan Tasks, Sampling, OAuth, dan metadata remote Cloud Run dalam ADR.

### 0.3.0

- Mengubah nama package publik menjadi `jp-bids-mcp`.
- Menyatukan nama server MCP, CLI, dan metadata Registry sebagai JP Bids MCP.
- Mempertahankan `KOKO_CALL_RATE_LIMIT_PER_SECOND` sebagai alias kompatibilitas.

### 0.2.0

- Menambahkan filter tanggal pembukaan dan tanggal akhir pengiriman.
- Meningkatkan pencarian detail `bid_key` dengan cache pencarian terbaru.
- Menambah fixture dan contract test, serta gate validasi API live dan Registry.

### 0.1.0

- Implementasi awal dengan Tools, Prompts, Resources, Resource Templates, Completion, Logging, stdio, dan Streamable HTTP.
