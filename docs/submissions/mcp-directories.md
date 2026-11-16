# MCP Directory Submission Notes (v0.10.0)

> Anthropic Connectors Directory チェックリスト: [`anthropic-connector-checklist.md`](./anthropic-connector-checklist.md)  
> OpenAI ChatGPT Apps チェックリスト: [`chatgpt-apps-submission-checklist.md`](./chatgpt-apps-submission-checklist.md)（操作手順: [`chatgpt-app-submission-instructions.md`](./chatgpt-app-submission-instructions.md)）  
> 即日公開ランブック: [`../GO_LIVE_TODAY_RUNBOOK.md`](../GO_LIVE_TODAY_RUNBOOK.md)

---

## 日本語

JP Bids MCP (`v0.10.0`・完全無料・公開7ツール＋AI Bid Workspace UI) の各ディレクトリ・レジストリ掲載状況です。

### 基本情報 (`v0.10.0`)

- Display Name: `JP Bids`（パッケージ名: `jp-bids-mcp`）
- Version: `0.10.0` (`JP_BIDS_PROFILE=public_mvp`, 無料7ツール・読み取り専用)
- MCP Registry Name: `io.github.sugukurukabe/jp-bids`
- Remote Endpoint: `https://mcp.bid-jp.com/mcp`（Streamable HTTP + 1クリック OAuth 2.0 DCR / PKCE S256）
- GitHub: `https://github.com/sugukurukabe/koko-call-mcp`
- Data Source: 中小企業庁 官公需情報ポータルサイト 検索API（`https://www.kkj.go.jp/s/help/notes/`）

### Submission Targets と状態

| ディレクトリ / 配布チャネル | 状態 (`v0.10.0`) | 備考・次のアクション |
|---|---|---|
| **Anthropic Connectors Directory** | `v0.10.0` 無料7ツール原稿整備済み（提出・更新準備完了） | `anthropic-connector-checklist.md` に沿って管理画面で反映 |
| **OpenAI ChatGPT Apps Directory** | `v0.10.0` 無料7ツール＋`AI Bid Workspace` 申請パッケージ検証済み（65/65 PASS・未提出） | `chatgpt-app-submission-instructions.md` の6ステップ（法人確認・ドメイン検証・提出）を実施 |
| **MCP Official Registry** (`io.github.sugukurukabe/jp-bids`) | `v0.9.0` 公開実績あり / `v0.10.0` `server.json` 検証済み | `v0.10.0` デプロイ後に `mcp-publisher publish` を実行 |
| **Smithery** | 掲載済み (`listed`) | `.smithery/shttp/manifest.json` を `v0.10.0` 公開7ツールに同期済み |
| **GitHub Releases (Skills & Plugin ZIP)** | `dist/searching-japanese-bids.zip` & OpenAI提出用ZIP 生成可能 | `v0.10.0` リリースページに添付して1クリック配布 |
| **GitHub topics** | 完了 | - |
| awesome-mcp-servers / Glama / PulseMCP / mcpservers.org | 任意申請候補 | `LAUNCHGUIDE.md` の説明文を流用可能 |

### Short Description

```text
Free, read-only MCP server (7 tools + AI Bid Workspace UI) for searching, ranking, inspecting official URLs, and exporting 16-column CSV/JSON shortlists of Japanese government procurement notices (KKJ).
```

---

## English

Directory and registry status for **JP Bids MCP (`v0.10.0`)** — 7 free, read-only procurement tools + single-file MCP Apps UI (`AI Bid Workspace`).

### Basic Information (`v0.10.0`)

- Display Name: `JP Bids` (npm package: `jp-bids-mcp`)
- Version: `0.10.0` (`JP_BIDS_PROFILE=public_mvp`, 7 free tools, zero billing)
- Registry Name: `io.github.sugukurukabe/jp-bids`
- Remote Endpoint: `https://mcp.bid-jp.com/mcp` (Streamable HTTP + 1-click OAuth 2.0 DCR / PKCE S256)
- GitHub: `https://github.com/sugukurukabe/koko-call-mcp`
- Data Source: Small and Medium Enterprise Agency KKJ procurement search API

### Submission Targets

| Directory / Channel | Status (`v0.10.0`) | Notes |
|---|---|---|
| **Anthropic Connectors Directory** | Ready for `v0.10.0` 7-tool free listing submit/update | See `anthropic-connector-checklist.md` |
| **OpenAI ChatGPT Apps Directory** | Validated 6-file package (`65/65` checks PASS) for all 7 free tools; pending org & domain verification | Follow 6 steps in `chatgpt-app-submission-instructions.md` |
| **MCP Official Registry** | `v0.9.0` published; `v0.10.0` `server.json` validated | Run `mcp-publisher publish` after `v0.10.0` Cloud Run deploy |
| **Smithery** | Listed | `.smithery/shttp/manifest.json` synced to `v0.10.0` 7 public tools |
| **GitHub Releases (Claude Skill & Plugin ZIP)** | Ready (`dist/searching-japanese-bids.zip`) | Attach to `v0.10.0` GitHub Release |
| **GitHub topics** | Completed | - |

---

## Bahasa Indonesia

Status direktori dan registri untuk **JP Bids MCP (`v0.10.0`)** — 7 alat publik gratis & read-only + antarmuka MCP Apps (`AI Bid Workspace`).

### Target Submission

| Direktori / Kanal | Status (`v0.10.0`) | Catatan |
|---|---|---|
| **Anthropic Connectors Directory** | Siap diajukan/diperbarui untuk `v0.10.0` (7 alat gratis) | Lihat `anthropic-connector-checklist.md` |
| **OpenAI ChatGPT Apps Directory** | Paket 6 file tervalidasi (`65/65` LULUS) untuk 7 alat gratis; menunggu verifikasi organisasi & domain | Ikuti 6 langkah di `chatgpt-app-submission-instructions.md` |
| **MCP Official Registry** | `v0.9.0` telah terbit; `server.json` `v0.10.0` tervalidasi | Jalankan `mcp-publisher publish` setelah deploy `v0.10.0` |
| **Smithery** | Terdaftar (`listed`) | `.smithery/shttp/manifest.json` disinkronkan ke 7 alat publik `v0.10.0` |
| **GitHub topics** | Selesai | - |
