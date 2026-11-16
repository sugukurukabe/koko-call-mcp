# AI Bid Workspace (MCP Apps)

## 日本語

`search_bids_app` は MCP Apps UI として「AI Bid Workspace」（`ui://jp-bids/search-results.html`）を提供する。v0.9.0 / v0.10.0 の Public MVP プロファイルでは、完全無料・読み取り専用の公開7ツールと整合するアクション構成に整理されている。

### ペルソナ

1. 営業責任者: 朝15分で今日追う案件を決めたい。
2. 入札事務担当: 提出漏れと期限漏れをゼロにしたい。
3. 経営者: この案件は会社に合うかだけ判断したい。
4. 新人担当者: 何を見ればよいか分からない。

### 画面構成

- Welcome Screen: 初回表示時の1クリック入力例チップ（クリックでアプリ内検索またはチャット送信を即時開始）。
- Priority Lane: 案件一覧カード、複数選択チェックボックス、全選択/解除、バッチ操作（`選択比較 (rank)` / `選択CSV` / `選択JSON`）、下部アクション（`全件CSV` / `文脈同期`）。
- Selected Bid Workbench: 選択案件の詳細（提出期限、開札、公告日、サーバー評価スコア・優先度・評価理由、公式公告リンク）。
- Action Dock: 公開承認済みツール・ホスト連携ボタン — `📄 要件抽出` (`extract_bid_requirements`) / `🔍 詳細取得` (`get_bid_detail`) / `🔗 公式` (`openLink`)。
- Manual Export Panel (`CSV/JSON 手動取得欄`): ホスト側でファイル保存とクリップボード書込みの双方が制限されている場合に自動表示される読み取り専用コピー欄（`全選択` ボタン付き）。
- Evidence & Safety Panel: 未信頼データ警告、入札 `key`、署名付き `bid_ref` 先頭プレフィックス、ファイル種別、ファイルサイズ、出典、取得日時。

### host連携

- `callServerTool` でアプリ内再検索 (`search_bids_app`)、選択比較 (`rank_bids`)、選択/全件エクスポート (`export_bid_shortlist`) を直接実行（非対応時は `sendMessage` またはクリップボードへフォールバック）。
- `sendMessage` で `extract_bid_requirements` / `get_bid_detail` の呼び出し依頼をチャットへ送信（拒否時はプロンプトのクリップボードコピーへフォールバック）。
- `downloadFile` で16列CSV（UTF-8 BOM付き）/ JSON エクスポート。拒否・非対応時は `clipboard.writeText` → `ManualExportPanel` の3段階フォールバック。
- `openLink` で案件に紐づく HTTPS 公式ページを開く（拒否時はURLコピー）。
- `updateModelContext` で選択中の案件とチェック済み選択リストをモデル文脈へ同期。
- `requestDisplayMode` で `inline` / `fullscreen` 切替。

### 安全性

- 上流PDF/公告文は未信頼データとして扱う。
- UI上にEvidence & Safety panelで出典・取得日時・ファイル情報を表示。
- 入札判断前に公式書類を確認するよう警告を常時表示。
- CSP は `connectDomains: []`, `resourceDomains: []` の単一HTMLバンドル（外部スクリプト・外部CSS読込ゼロ）。
- sourceUri・SHA-256・抽出modeは文書抽出結果（`extract_bid_requirements`）側の値で、検索結果のworkspaceには含まれない。SHA-256は `src/api/pdf-fetcher.ts` がサーバ側で計算する。詳細は ADR-0014。

### 確認観点

- `tools/list` に `search_bids_app` が含まれること。
- `resources/list` に `ui://jp-bids/search-results.html` が含まれること。
- `resources/read` で `text/html;profile=mcp-app` が返ること。
- 各host actionが拒否されてもUIが壊れず3段階フォールバックが機能すること。
- non-UIクライアントではtext + structuredContentだけで使えること。

### ローカル確認とスクリーンショット取得

`scripts/apps-harness/` は最小のモックホストである。`ui/initialize` に応答し、固定の tool result を流すため、本番バンドル（`dist/apps/search-results.html`）に手を入れずに実機相当の画面を確認できる。

```bash
npm run apps:harness   # http://127.0.0.1:8899/host.html をブラウザで開く
npm run apps:capture   # images/mcp-apps-bid-workspace/ へ決定的な9枚（01-welcome.png〜09-export-json.png）を書き出す
```

クエリパラメータで host 側の条件を切り替える。

| パラメータ | 効果 |
|---|---|
| `theme=dark` | `hostContext.theme` を dark にする（`:root[data-theme="dark"]` および `prefers-color-scheme` に対応） |
| `denyMessage=1` | `hostCapabilities.message` を外し `ui/message` を拒否する |
| `denyDownload=1` | `ui/download-file` を拒否する |
| `denyClipboard=1` | クリップボード書込みも拒否し `ManualExportPanel` フォールバックを確認する |
| `autoResult=0` | tool result を流さず Welcome 画面（1クリック入力例チップ付き）を出す |
| `openEvidence=1` | Evidence & Safety のアコーディオンを開く |
| `selectBids=11_unordered` | 11件の案件を指定順序でチェック選択する |
| `clickAction=要件抽出` | Action Dock やバッチ操作ボタン（`要件抽出` / `選択比較` / `選択CSV` / `選択JSON` 等）を押す |

### Investor Radar (`full_local` プロファイル専用)

ローカル開発用プロファイル（`JP_BIDS_PROFILE=full_local`）では、`search_investor_radar_app` が `ui://jp-bids/investor-radar.html` を返す（公開 `public_mvp` エンドポイントでは非公開）。CSP は Bid Workspace と同様 `connectDomains: []`, `resourceDomains: []`。`ErrorBoundary` と `applyHostTheme` によるダークモード切替を備え、`openLink` 許可リストは `www.kkj.go.jp` に加え TDnet / EDINET / J-Quants 公式ドメイン。ハーネスは `scripts/apps-harness/investor-host.html`。

## English

`search_bids_app` delivers the **AI Bid Workspace** (`ui://jp-bids/search-results.html`) via MCP Apps. In the v0.9.0 / v0.10.0 `public_mvp` profile, all workspace actions align strictly with the 7 free read-only public tools.

### Personas

1. Sales manager: decide which bids to pursue within 15 minutes each morning.
2. Bid administrator: ensure zero missed submissions and deadlines.
3. Executive: quickly judge if a bid fits the company.
4. Junior staff: understand what to look at without prior bid experience.

### Layout

- Welcome Screen: interactive 1-click example prompt chips for immediate search onboarding.
- Priority Lane: bid cards, multi-select checkboxes, batch actions (`選択比較 (rank)` / `選択CSV` / `選択JSON`), and lane actions (`全件CSV` / `文脈同期`).
- Selected Bid Workbench: submission deadline, opening date, issue date, server ranking score/priority/reasons, and official announcement link.
- Action Dock: approved public tool buttons — `📄 要件抽出` (`extract_bid_requirements`) / `🔍 詳細取得` (`get_bid_detail`) / `🔗 公式` (`openLink`).
- Manual Export Panel: read-only textarea with 1-click Select All when both `downloadFile` and `clipboard.writeText` are blocked by the host sandbox.
- Evidence & Safety Panel: untrusted data warning, bid `key`, truncated `bid_ref`, file type, file size, attribution, accessed-at timestamp.

### Host integration & deterministic capture

- `callServerTool` powers in-app re-search (`search_bids_app`), selection ranking (`rank_bids`), and shortlist export (`export_bid_shortlist`) with `sendMessage` / clipboard fallbacks.
- `downloadFile` exports 16-column UTF-8 BOM CSV or JSON with a 3-tier fallback (`downloadFile` → `clipboard` → `ManualExportPanel`).
- `openLink`, `updateModelContext`, and `requestDisplayMode` (`inline` / `fullscreen`) degrade gracefully when unsupported.
- `npm run apps:capture` renders the unmodified production bundle in `scripts/apps-harness/host.html` and outputs **9 deterministic screenshots** (`01-welcome.png` through `09-export-json.png`).

### Safety

- Upstream PDF and notice text are treated as untrusted data with zero external domains (`connectDomains: []`, `resourceDomains: []`).
- Source URI, SHA-256, and extraction mode belong to document extraction results (`extract_bid_requirements`) and are computed server-side in `src/api/pdf-fetcher.ts`. See ADR-0014.

## Bahasa Indonesia

`search_bids_app` menyediakan **AI Bid Workspace** (`ui://jp-bids/search-results.html`) melalui MCP Apps. Pada profil `public_mvp` v0.9.0 / v0.10.0, seluruh tombol aksi selaras dengan 7 tool publik gratis yang bersifat hanya-baca.

### Tata letak

- Welcome Screen: chip contoh prompt interaktif 1-klik untuk memulai pencarian langsung.
- Priority Lane: kartu tender, kotak centang multi-pilihan, aksi batch (`選択比較 (rank)` / `選択CSV` / `選択JSON`), serta `全件CSV` dan `文脈同期`.
- Selected Bid Workbench: tenggat pengajuan, pembukaan, tanggal pengumuman, skor/prioritas server, dan tautan resmi.
- Action Dock: `📄 要件抽出` (`extract_bid_requirements`) / `🔍 詳細取得` (`get_bid_detail`) / `🔗 公式` (`openLink`).
- Manual Export Panel: panel salin manual hanya-baca ketika `downloadFile` dan clipboard dibatasi sandbox host (`npm run apps:capture` menghasilkan 9 tangkapan layar deterministik `01-welcome.png`–`09-export-json.png`).
- Evidence & Safety Panel: peringatan data tidak tepercaya, `key` tender, `bid_ref`, jenis/ukuran file, atribusi KKJ, dan waktu pengambilan (lihat ADR-0014).
