# MCP Directory Submission Notes (`v0.10.2` Published / Directory Submissions Pending)

> Anthropic Connectors Directory チェックリスト: [`anthropic-connector-checklist.md`](./anthropic-connector-checklist.md)  
> OpenAI ChatGPT Apps チェックリスト: [`chatgpt-apps-submission-checklist.md`](./chatgpt-apps-submission-checklist.md)（操作手順: [`chatgpt-app-submission-instructions.md`](./chatgpt-app-submission-instructions.md)）  
> 段階的本番配備・公開ランブック: [`../GO_LIVE_TODAY_RUNBOOK.md`](../GO_LIVE_TODAY_RUNBOOK.md) · Cloudflare エッジ運用: [`../cloudflare-edge-mcp-playbook.md`](../cloudflare-edge-mcp-playbook.md)

---

## 日本語

JP Bids MCP 公開版（**`v0.10.2`**・`JP_BIDS_PROFILE=public_mvp`・公開7ツール＋AI Bid Workspace UI＋Cloudflare エッジゲートウェイ）の各ディレクトリ・レジストリ状況です。`v0.10.2` は Cloud Run 本番配備・Cloudflare エッジ切替・npm 公開・公式 MCP Registry 更新・GitHub Release 作成まで完了しており、OpenAI / Anthropic 両ディレクトリへの提出手続きを残しています。

### 基本情報 (`0.10.2` 本番稼働・公開済み)

- Display Name: `JP Bids`（npm パッケージ名: `jp-bids-mcp`）
- Live Version: `0.10.2`（`JP_BIDS_PROFILE=public_mvp` 無料公開7ツール・読み取り専用 / Cloudflare エッジ `jp-bids-edge-gateway` + Cloud Run `jp-bids-mcp-00091-jiq` 100% 稼働）
- MCP Registry Name: `io.github.sugukurukabe/jp-bids`（`0.10.2` `active`, `isLatest: true`）
- Remote Endpoint: `https://mcp.bid-jp.com/mcp`（Streamable HTTP + 1クリック OAuth 2.0 DCR / PKCE S256 稼働中）
- Feedback Endpoint: `https://mcp.bid-jp.com/feedback`（Cloudflare Turnstile + D1 日英窓口稼働中）
- GitHub: `https://github.com/sugukurukabe/koko-call-mcp`（`PUBLIC`）
- Data Source: 中小企業庁 官公需情報ポータルサイト 検索API（`https://www.kkj.go.jp/s/help/notes/`）

### Submission Targets と現在の正直な状態

| ディレクトリ / 配布チャネル | 現在の状態 (`0.10.2`) | 残課題・次のアクション |
|---|---|---|
| **Anthropic Connectors Directory** | 提出資料整備済み・**未提出** (`NOT_SUBMITTED`) | 実 Claude 上での `0.10.2` 表示・操作録画を確認のうえ、代表者操作で提出 |
| **OpenAI ChatGPT Apps Directory** | **`LOCAL_PARTIAL_VALIDATION_WITH_SCHEMA_WARNING_NOT_SUBMITTED`**<br>（6ファイル構成ZIP・ローカル構造/画像検査 `65/65` 通過、スキーマ警告 **`CORE_MCP_OPENAI_EXTENSION_MISMATCH`** あり・**未提出**） | 提出前に実 ChatGPT 画面・動画取得、ポータル上のドメインチャレンジ照合・Business Verification・提出と **Case ID** 記録が必要（現在 Case ID: `UNASSIGNED_NOT_SUBMITTED`） |
| **npm (`jp-bids-mcp`)** | **`0.10.2` 公開済み**（Sigstore SLSA Provenance v1 付き） | 完了（`npm view jp-bids-mcp@0.10.2` 反映確認済み） |
| **MCP Official Registry** (`io.github.sugukurukabe/jp-bids`) | **`0.10.2` 公開済み** (`status: active`, `isLatest: true`) | 完了 |
| **Smithery** | 既存掲載あり (`listed`) / `.smithery/shttp/manifest.json` 同期済み | リモート更新反映確認 |
| **GitHub Releases (Skills ZIP)** | **`v0.10.2` 公開済み**（`searching-japanese-bids.zip` 添付済み） | 完了 |

### Short Description

```text
Free, read-only MCP server (7 public_mvp tools + AI Bid Workspace UI) for searching, ranking, inspecting official URLs, and exporting 16-column CSV/JSON shortlists of Japanese government procurement notices (KKJ).
```

---

## English

Directory and registry status for **JP Bids MCP (`0.10.2`)** (`JP_BIDS_PROFILE=public_mvp`, 7 free tools + single-file `AI Bid Workspace` UI + Cloudflare Edge Gateway). Version `0.10.2` is live behind Cloudflare Edge (`jp-bids-edge-gateway`) and Cloud Run (`https://mcp.bid-jp.com/mcp`, revision `jp-bids-mcp-00091-jiq`), published on npm (`jp-bids-mcp@0.10.2` with Sigstore provenance), published on the Official MCP Registry (`io.github.sugukurukabe/jp-bids@0.10.2`), and released on GitHub (`v0.10.2`). External directory submissions to Anthropic and OpenAI remain pending.

| Directory / Channel | Current Status (`0.10.2`) | Remaining Prerequisites |
|---|---|---|
| **Anthropic Connectors Directory** | Submission materials prepared (`0.10.2`); **not submitted** | Complete live Claude host UI recording on `0.10.2`, then submit |
| **OpenAI ChatGPT Apps Directory** | **`LOCAL_PARTIAL_VALIDATION_WITH_SCHEMA_WARNING_NOT_SUBMITTED`** (6-file ZIP, `65/65` local checks, warning **`CORE_MCP_OPENAI_EXTENSION_MISMATCH`**; **not submitted**, Case ID: `UNASSIGNED_NOT_SUBMITTED`) | Complete live `0.10.2` ChatGPT screenshots/video, portal domain challenge & Business Verification, submit, and record Case ID |
| **npm (`jp-bids-mcp`)** | **`0.10.2` published** (Sigstore SLSA Provenance v1) | Complete |
| **MCP Official Registry** | **`0.10.2` published** (`active`, `isLatest: true`) | Complete |
| **GitHub Releases (Claude Skill ZIP)** | **`v0.10.2` published** (`searching-japanese-bids.zip` attached) | Complete |

---

## Bahasa Indonesia

Status direktori dan registri untuk **JP Bids MCP (`0.10.2`)** (`JP_BIDS_PROFILE=public_mvp`, 7 alat gratis + UI `AI Bid Workspace` + Cloudflare Edge Gateway). Versi `0.10.2` sudah aktif melalui Cloudflare Edge dan Cloud Run (`https://mcp.bid-jp.com/mcp`, revisi `jp-bids-mcp-00091-jiq`), terbit di npm (`jp-bids-mcp@0.10.2`), MCP Official Registry (`io.github.sugukurukabe/jp-bids@0.10.2`), dan GitHub Release `v0.10.2`. Pengajuan direktori Anthropic dan OpenAI masih menunggu verifikasi klien langsung dan pengiriman portal.

| Direktori / Kanal | Status Saat Ini (`0.10.2`) | Prasyarat Tersisa |
|---|---|---|
| **Anthropic Connectors Directory** | Dokumen `0.10.2` siap; **belum diajukan** | Verifikasi & rekaman UI `0.10.2` di klien Claude nyata, lalu ajukan |
| **OpenAI ChatGPT Apps Directory** | **`LOCAL_PARTIAL_VALIDATION_WITH_SCHEMA_WARNING_NOT_SUBMITTED`** (ZIP 6 file, `65/65` pemeriksaan lokal, peringatan **`CORE_MCP_OPENAI_EXTENSION_MISMATCH`**; **belum diajukan**) | Selesaikan tangkapan layar/video `0.10.2` di ChatGPT nyata, Business Verification, tantangan domain portal, dan catat Case ID |
| **npm, MCP Official Registry & GitHub Release** | **`0.10.2` sudah diterbitkan** | Selesai |
