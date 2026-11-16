# Remote Release Checklist (v0.10.0 — Public MVP)

> 実運用でのコピペ実行手順（ロールバック手順・申請6ステップ含む）は **[`GO_LIVE_TODAY_RUNBOOK.md`](./GO_LIVE_TODAY_RUNBOOK.md)** を参照してください。

## 日本語

`mcp.bid-jp.com` の Cloud Run 上へ **`v0.10.0`（`JP_BIDS_PROFILE=public_mvp`・完全無料・公開7ツール）** を配備・公開する場合は、以下の順序で実施します。

1. `npm run remote:domain` で Cloud Run カスタムドメイン（`mcp.bid-jp.com`）の Ready 状態を確認し、現在の100%トラフィック稼働リビジョン名を控える。
2. `npm run remote:health` を実行し、現行本番の `/readyz` (200) と `/mcp` GET (405) を確認する。
3. `package.json`, `package-lock.json`, `server.json`, `public/.well-known/mcp/server-card.json`, `public/.well-known/mcp-server.json`, `public/.well-known/agents.json`, `.smithery/shttp/manifest.json`, `CITATION.cff`, `public/index.html`, `src/lib/version.ts`, `plugins/jp-bids-mcp/plugin.json` のすべてが **`0.10.0`** で一致していることを確認する（`npm run registry:validate` および `npm run release:parity`）。
4. 本番環境変数として `JP_BIDS_PROFILE=public_mvp`, `JP_BIDS_DOCUMENT_EXTRACTION=off`, `JP_BIDS_BASE_URL=https://mcp.bid-jp.com`, `ALLOWED_ORIGINS`, `JP_BIDS_OAUTH_SECRET`, `JP_BIDS_PDF_ALLOWED_HOSTS` が Secret Manager またはサービス設定で明示されていることを確認する。
5. ローカルで `npm run check`、Gate 1 受入ランナー（35/35 PASS・外部通信0件）、および `npm run release:gate` を実行する。
6. `dist/apps/search-results.html`（単一ファイルUIバンドル）を含むコンテナイメージをビルドし、まず **`--no-traffic` タグ付きリビジョン**として Cloud Run `jp-bids-mcp` に配備する。
7. タグ付きURLに対してスモーク検証（`/health` 200、`/readyz` 200、未認証 `POST /mcp` 401、OAuth PKCE S256 トークン取得 `Cache-Control: no-store`、`tools/list` が厳密に公開7ツール `search_bids`, `list_recent_bids`, `get_bid_detail`, `rank_bids`, `extract_bid_requirements`, `export_bid_shortlist`, `search_bids_app` のみを返すこと）を実施する。
8. カナリア（10%）→ 本番（100%）の順でトラフィックを切り替え、`npm run remote:health` を再実行する（異常時は直ちに旧リビジョン 100% へロールバックする）。
9. Git タグ `v0.10.0` を push し、GitHub Actions `release.yml`（Trusted Publisher 経由の `npm publish --provenance`）を完了させる。
10. `mcp-publisher publish` で公式 MCP Registry（`io.github.sugukurukabe/jp-bids`）を `0.10.0` に更新し、GitHub Release `v0.10.0` に `dist/searching-japanese-bids.zip` と OpenAI 提出用プラグインZIPを添付する。
11. OpenAI ChatGPT Apps および Anthropic Connectors Directory の申請・掲載情報を更新する。

## English

When releasing **`v0.10.0` (`JP_BIDS_PROFILE=public_mvp`, 7 free tools + AI Bid Workspace UI)** to the Cloud Run remote at `mcp.bid-jp.com`, follow this order (see [`GO_LIVE_TODAY_RUNBOOK.md`](./GO_LIVE_TODAY_RUNBOOK.md) for exact copy-paste commands):

1. Run `npm run remote:domain` to verify the custom domain mapping is Ready and record the active 100%-traffic rollback revision.
2. Run `npm run remote:health` (`/readyz` 200, `/mcp` GET 405, `/mcp` DELETE 405).
3. Confirm all manifests (`package.json`, `package-lock.json`, `server.json`, `public/.well-known/mcp/server-card.json`, `public/.well-known/mcp-server.json`, `public/.well-known/agents.json`, `.smithery/shttp/manifest.json`, `CITATION.cff`, `public/index.html`, `src/lib/version.ts`, and `plugins/jp-bids-mcp/plugin.json`) read **`0.10.0`** via `npm run registry:validate` and `npm run release:parity`.
4. Confirm production environment variables (`JP_BIDS_PROFILE=public_mvp`, `JP_BIDS_DOCUMENT_EXTRACTION=off`, `JP_BIDS_BASE_URL=https://mcp.bid-jp.com`, `ALLOWED_ORIGINS`, `JP_BIDS_OAUTH_SECRET`, `JP_BIDS_PDF_ALLOWED_HOSTS`) are explicitly configured.
5. Run `npm run check`, the offline Gate 1 runner (`35/35` PASS), and `npm run release:gate`.
6. Build the container image containing `dist/apps/search-results.html` and deploy to Cloud Run `jp-bids-mcp` with `--no-traffic` and a revision tag first.
7. Run smoke checks against the tagged revision URL (`/health` 200, unauthenticated `POST /mcp` 401, OAuth DCR + PKCE S256 token exchange with `Cache-Control: no-store`, and `tools/list` exposing strictly the 7 `public_mvp` tools).
8. Shift traffic 10% canary → 100% production and re-run `npm run remote:health` (roll back immediately to the recorded previous revision if any check fails).
9. Push tag `v0.10.0` so GitHub Actions `release.yml` runs `npm publish --access public --provenance --ignore-scripts`.
10. Run `mcp-publisher publish` to update the official MCP Registry (`io.github.sugukurukabe/jp-bids`) and upload `dist/searching-japanese-bids.zip` to the GitHub Release.
11. Submit/update the OpenAI ChatGPT Apps and Anthropic Connectors Directory listings.

## Bahasa Indonesia

Saat merilis **`v0.10.0` (`JP_BIDS_PROFILE=public_mvp`, 7 alat publik gratis + UI AI Bid Workspace)** ke Cloud Run di `mcp.bid-jp.com`, ikuti urutan berikut (lihat [`GO_LIVE_TODAY_RUNBOOK.md`](./GO_LIVE_TODAY_RUNBOOK.md) untuk perintah siap salin):

1. Jalankan `npm run remote:domain` dan catat revisi aktif saat ini untuk rollback.
2. Jalankan `npm run remote:health` (`/readyz` 200 dan `/mcp` GET 405).
3. Pastikan seluruh manifes (`package.json`, `server.json`, `public/.well-known/*`, `.smithery/shttp/manifest.json`, `CITATION.cff`, `src/lib/version.ts`, `plugins/jp-bids-mcp/plugin.json`) bernilai **`0.10.0`** menggunakan `npm run registry:validate` dan `npm run release:parity`.
4. Pastikan variabel lingkungan produksi (`JP_BIDS_PROFILE=public_mvp`, `JP_BIDS_DOCUMENT_EXTRACTION=off`, `ALLOWED_ORIGINS`, `JP_BIDS_OAUTH_SECRET`, `JP_BIDS_BASE_URL`) telah disetel secara eksplisit.
5. Jalankan `npm run check`, Gate 1 Acceptance Runner (`35/35` LULUS), dan `npm run release:gate`.
6. Build image Docker yang menyertakan `dist/apps/search-results.html` dan deploy ke Cloud Run `jp-bids-mcp` dengan `--no-traffic` terlebih dahulu.
7. Verifikasi URL revisi bertanda (`401` tanpa token, OAuth PKCE S256 `Cache-Control: no-store`, dan `tools/list` menampilkan tepat 7 alat publik `public_mvp`).
8. Alihkan trafik bertahap (10% kanari → 100% produksi) dan jalankan kembali `npm run remote:health`.
9. Push tag `v0.10.0` untuk menjalankan `npm publish --provenance` melalui GitHub Actions.
10. Jalankan `mcp-publisher publish` untuk memperbarui MCP Registry dan lampirkan `dist/searching-japanese-bids.zip` pada GitHub Release.
