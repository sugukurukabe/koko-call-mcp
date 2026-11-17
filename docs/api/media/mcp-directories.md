# MCP Directory Submission Notes (`v0.10.1` Candidate)

> Anthropic Connectors Directory チェックリスト: [`anthropic-connector-checklist.md`](./anthropic-connector-checklist.md)  
> OpenAI ChatGPT Apps チェックリスト: [`chatgpt-apps-submission-checklist.md`](./chatgpt-apps-submission-checklist.md)（操作手順: [`chatgpt-app-submission-instructions.md`](./chatgpt-app-submission-instructions.md)）  
> 段階的本番配備・公開ランブック: [`../GO_LIVE_TODAY_RUNBOOK.md`](../GO_LIVE_TODAY_RUNBOOK.md)

---

## 日本語

JP Bids MCP 公開候補（**`v0.10.1`**・`JP_BIDS_PROFILE=public_mvp`・公開7ツール＋AI Bid Workspace UI）の各ディレクトリ・レジストリ準備状況です（※ `npmjs.org` には `jp-bids-mcp@0.10.0` が既公開のため、本候補は未公開の `0.10.1` に統一しています。本候補パッケージ作成時点では外部申請・本番配備は未実施です）。

### 基本情報 (`0.10.1` 候補)

- Display Name: `JP Bids`（npm パッケージ名: `jp-bids-mcp`）
- Candidate Version: `0.10.1`（未公開 / `JP_BIDS_PROFILE=public_mvp` 無料公開7ツール・読み取り専用 / ※ 既公開 npm 版は `0.10.0`）
- MCP Registry Name: `io.github.sugukurukabe/jp-bids`
- Remote Endpoint: `https://mcp.bid-jp.com/mcp`（Streamable HTTP + 1クリック OAuth 2.0 DCR / PKCE S256 ※ `0.10.1` は未配備）
- GitHub: `https://github.com/sugukurukabe/koko-call-mcp`
- Data Source: 中小企業庁 官公需情報ポータルサイト 検索API（`https://www.kkj.go.jp/s/help/notes/`）

### Submission Targets と現在の正直な状態

| ディレクトリ / 配布チャネル | 現在の状態 (`0.10.1` 候補) | 残課題・承認後のアクション |
|---|---|---|
| **Anthropic Connectors Directory** | ローカル原稿整備済み・**未提出** (`NOT_SUBMITTED`) | 再監査・Stage 1/2 昇格承認後、実 Claude 上で `0.10.1` の表示・操作を確認（現在 `NOT_EXECUTED_ON_0_10_1`）してから提出 |
| **OpenAI ChatGPT Apps Directory** | **`LOCAL_PARTIAL_VALIDATION_WITH_SCHEMA_WARNING_NOT_SUBMITTED`**<br>（6ファイル構成ZIP・ローカル構造/画像検査 `65/65` 通過、スキーマ警告 **`CORE_MCP_OPENAI_EXTENSION_MISMATCH`** あり・**未提出**） | ポータル互換性確認・審査合格とは別。提出前に ① KKJ二次利用条件根拠確認 (`OAI-01/04`)、② Business Verification、③ ドメインチャレンジ検証、④ `0.10.1` 実 ChatGPT 画面・動画取得、⑤ 提出と **Case ID** 記録が必要（現在 Case ID: `UNASSIGNED_NOT_SUBMITTED`） |
| **npm (`jp-bids-mcp`)** | `0.10.0` 既公開 / **`0.10.1` 未公開** | 再監査・公開承認後、`v0.10.1` タグ push により `.github/workflows/release.yml`（既公開版 fail-closed 停止ゲート付き）で公開 |
| **MCP Official Registry** (`io.github.sugukurukabe/jp-bids`) | `0.10.1` `server.json` ローカル検証済み・**未公開** | `0.10.1` Cloud Run 昇格・npm 公開後に `mcp-publisher publish` を実行 |
| **Smithery** | 既存掲載あり (`listed`) / `.smithery/shttp/manifest.json` を `0.10.1` 公開7ツールに同期済み | リモート更新後に反映確認 |
| **GitHub Releases (Skills ZIP)** | `artifacts/skills/searching-japanese-bids.zip` (`0.10.1`, 3ファイル) ローカル生成済み・**未アップロード** | `v0.10.1` リリース承認後に添付 |

### Short Description

```text
Free, read-only MCP server (7 public_mvp tools + AI Bid Workspace UI) for searching, ranking, inspecting official URLs, and exporting 16-column CSV/JSON shortlists of Japanese government procurement notices (KKJ).
```

---

## English

Directory and registry status for **JP Bids MCP (`0.10.1` candidate)** (`JP_BIDS_PROFILE=public_mvp`, 7 free tools + single-file `AI Bid Workspace` UI; `jp-bids-mcp@0.10.0` is already published on `npmjs.org`, while `0.10.1` has not yet been deployed or published).

| Directory / Channel | Current Status (`0.10.1` Candidate) | Remaining Prerequisites |
|---|---|---|
| **Anthropic Connectors Directory** | Checklist prepared (`0.10.1`); **not submitted** | Deploy `0.10.1` after approval, execute live Claude host UI verification (`NOT_EXECUTED_ON_0_10_1`), then submit |
| **OpenAI ChatGPT Apps Directory** | **`LOCAL_PARTIAL_VALIDATION_WITH_SCHEMA_WARNING_NOT_SUBMITTED`** (6-file ZIP, `65/65` local structural/PNG/ZIP checks, warning **`CORE_MCP_OPENAI_EXTENSION_MISMATCH`**; **not submitted**, Case ID: `UNASSIGNED_NOT_SUBMITTED`) | Local checks do not prove portal compatibility or approval. Complete `OAI-01/04` KKJ terms check, Business Verification, Domain Challenge, live `0.10.1` ChatGPT screenshots/video, and record Case ID |
| **npm (`jp-bids-mcp`)** | `0.10.0` already published; **`0.10.1` unpublished** | Push `v0.10.1` tag after approval (`release.yml` enforces fail-closed `E404` check) |
| **MCP Official Registry** | `0.10.1` `server.json` locally validated; **not published** | Run `mcp-publisher publish` after `0.10.1` deployment |
| **GitHub Releases (Claude Skill ZIP)** | `artifacts/skills/searching-japanese-bids.zip` (`0.10.1`, 3 files) built locally; **not uploaded** | Attach to `v0.10.1` release after approval |

---

## Bahasa Indonesia

Status direktori dan registri untuk kandidat **JP Bids MCP (`0.10.1`)** (`JP_BIDS_PROFILE=public_mvp`, 7 alat gratis + UI `AI Bid Workspace`; versi `0.10.0` sudah terbit di `npmjs.org`, sedangkan `0.10.1` belum di-deploy atau diterbitkan).

| Direktori / Kanal | Status Saat Ini (`0.10.1`) | Prasyarat Tersisa |
|---|---|---|
| **Anthropic Connectors Directory** | Dokumen `0.10.1` siap secara lokal; **belum diajukan** | Deploy `0.10.1` setelah persetujuan, verifikasi UI di klien Claude nyata (`NOT_EXECUTED_ON_0_10_1`), lalu ajukan |
| **OpenAI ChatGPT Apps Directory** | **`LOCAL_PARTIAL_VALIDATION_WITH_SCHEMA_WARNING_NOT_SUBMITTED`** (ZIP 6 file, `65/65` pemeriksaan struktural lokal, peringatan **`CORE_MCP_OPENAI_EXTENSION_MISMATCH`**; **belum diajukan**) | Selesaikan konfirmasi ketentuan KKJ (`OAI-01/04`), Business Verification, tantangan domain, tangkapan layar/video `0.10.1` di ChatGPT nyata, dan catat Case ID |
| **npm & MCP Official Registry** | `0.10.1` tervalidasi lokal; **belum diterbitkan** | Terbitkan setelah audit ulang dan persetujuan eksplisit |
