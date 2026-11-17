# Remote Release Checklist (`v0.10.1` — Public MVP Candidate)

> 承認境界の正本は **[`../JP_BIDS_CLIENT_ACCEPTANCE_APPROVAL_MATRIX_v1.0.md`](../JP_BIDS_CLIENT_ACCEPTANCE_APPROVAL_MATRIX_v1.0.md)**、具体的な実行コマンドと安全制御は **[`./GO_LIVE_TODAY_RUNBOOK.md`](./GO_LIVE_TODAY_RUNBOOK.md)** を参照してください。本チェックリストの整備自体は本番照会・Cloud Run 配備・`git push`・`npm publish`・外部申請の承認を意味しません。

## 日本語

`mcp.bid-jp.com` の Cloud Run 上へ **`v0.10.1`（`JP_BIDS_PROFILE=public_mvp`・公開7ツール・課金ツール非登録）** を配備・公開する場合は、独立再監査完了および管理者の明示的承認のもと以下の順序で実施します（`npmjs.org` には `jp-bids-mcp@0.10.0` が既公開のため、新版 `0.10.1` に統一し `v0.10.0` の再公開は行いません）。

1. ローカル（外部通信 0 回）で `npm run check`、`npm run docs:check`、`npm run registry:validate`、`npm run release:parity`、Gate 1 受入ランナー（35/35 PASS：Node VM 起動＋ローカルヘッドレスブラウザ UI 13項目検証）、および `cloudshell/run-offline-cloudshell-sim.mjs` を実行する。
2. `package.json`, `package-lock.json`, `server.json`, `public/.well-known/mcp/server-card.json`, `public/.well-known/mcp-server.json`, `public/.well-known/agents.json`, `.smithery/shttp/manifest.json`, `CITATION.cff`, `public/index.html`, `src/lib/version.ts`, `plugins/jp-bids-mcp/plugin.json` のすべてが **`0.10.1`** で一致していることを確認する。
3. Gate 4A-1 承認後、`0.10.1` コミット（`TARGET_SHA`）を `main` ブランチへ通常 push し、GitHub Actions `ci.yml` 全通過を確認する（まだ `v0.10.1` タグは付けない）。
4. Gate 4B-Stage 1 承認後、`cloudshell/stage1-deploy-0pct-candidate.sh` を実行し、現在の `percent === 100` リビジョンと全タグ・Runtime SA・Secret参照を固定した上で、Cloud Build の不変 `sha256` digest 指定で `--no-traffic` 候補リビジョンを配備し、設定前後差分照合および16項目ランタイム検証（OAuth正負例、認証付き MCP `2025-11-25` & `2026-07-28` 7ツール、`ui://jp-bids/search-results.html` SHA-256 一致、実KKJ通信 0回）を通過させて `stage1-verified-receipt.json` を封印する。
5. Gate 4B-Stage 2 承認後、`cloudshell/stage2-promote-verified-candidate.sh` を実行し、レシート鮮度・`generation`・競合リビジョン・全タグ・digest・SA直前照合を経て単発 `100%` 切替を行い、候補URLと `https://mcp.bid-jp.com` の双方で16項目検証を完了させる（失敗時は第三者変更がないことを所有権確認した上で最大1回のみ旧 `100%` リビジョンへ復帰し、復帰後状態を照合する）。
6. 実 Claude および実 ChatGPT から `https://mcp.bid-jp.com/mcp` に接続し、`0.10.1` での `AI Bid Workspace` 表示と選択CSV出力を確認して `docs/VERIFICATION_STATUS.md` を更新する。
7. Gate 4A-2 / 4C 承認後、オンライン環境で `npm audit --omit=dev` を再確認し、未公開の `v0.10.1` タグを push して `.github/workflows/release.yml`（`npm view jp-bids-mcp@0.10.1` `E404` 未公開確認＋`release:gate` → `npm publish --provenance`）を完了させる。
8. `mcp-publisher publish` で公式 MCP Registry（`io.github.sugukurukabe/jp-bids`）を `0.10.1` に更新し、GitHub Release `v0.10.1` に `artifacts/skills/searching-japanese-bids.zip` を添付する。
9. OpenAI 残課題（KKJ二次利用条件確認 `OAI-01/04`、Business Verification、ドメインチャレンジ検証、`0.10.1` 実ホスト画面・動画、Case ID 記録）を完了した上で OpenAI ChatGPT Apps および Anthropic Connectors Directory へ提出する。

## English

When releasing **`v0.10.1` (`JP_BIDS_PROFILE=public_mvp`, 7 free tools + AI Bid Workspace UI)** to `mcp.bid-jp.com` after independent re-audit and explicit operator approval (see [`GO_LIVE_TODAY_RUNBOOK.md`](./GO_LIVE_TODAY_RUNBOOK.md); note `jp-bids-mcp@0.10.0` is already published on `npmjs.org` and must never be re-tagged or overwritten):

1. Run offline local checks (`npm run check`, `npm run docs:check`, `npm run registry:validate`, `npm run release:parity`, Gate 1 `35/35` runner with VM + headless browser UI checks, and `cloudshell/run-offline-cloudshell-sim.mjs`).
2. Confirm all manifests (`package.json`, `package-lock.json`, `server.json`, `public/.well-known/*`, `.smithery/shttp/manifest.json`, `CITATION.cff`, `public/index.html`, `src/lib/version.ts`, `plugins/jp-bids-mcp/plugin.json`) match **`0.10.1`**.
3. After Gate 4A-1 approval, push `TARGET_SHA` to `main` (without a version tag) and confirm `ci.yml` passes.
4. After Stage 1 approval, run `cloudshell/stage1-deploy-0pct-candidate.sh` to lock the unique `percent === 100` revision and all tags/SA/SecretRefs, build & deploy the `--no-traffic` candidate pinned by immutable `sha256` digest, verify zero config drift, pass all 16 OAuth/MCP/UI runtime checks, and seal `stage1-verified-receipt.json`.
5. After Stage 2 approval, run `cloudshell/stage2-promote-verified-candidate.sh` to re-verify freshness, `generation`, tags, digest, and SA, execute a single `100%` cutover RPC, and verify all 16 checks on both the candidate URL and `https://mcp.bid-jp.com` (with ownership-checked max-1 rollback on post-cutover verification failure).
6. Verify live `0.10.1` UI rendering and 16-column CSV export on real Claude and ChatGPT hosts, then record evidence in `docs/VERIFICATION_STATUS.md`.
7. After Gate 4A-2/4C approval, re-run `npm audit --omit=dev`, push tag `v0.10.1` so `release.yml` verifies `jp-bids-mcp@0.10.1` is unpublished (`E404`) before running `npm publish --provenance`, update MCP Registry (`mcp-publisher publish`), attach `searching-japanese-bids.zip` to GitHub Release `v0.10.1`, and complete OpenAI/Anthropic directory submissions after resolving remaining portal prerequisites.

## Bahasa Indonesia

Saat merilis **`v0.10.1` (`JP_BIDS_PROFILE=public_mvp`, 7 alat publik gratis + UI AI Bid Workspace)** ke Cloud Run `mcp.bid-jp.com` setelah audit ulang independen dan persetujuan eksplisit (lihat [`GO_LIVE_TODAY_RUNBOOK.md`](./GO_LIVE_TODAY_RUNBOOK.md); paket `jp-bids-mcp@0.10.0` sudah terbit di `npmjs.org` sehingga rilis baru disatukan pada `0.10.1`):

1. Jalankan pemeriksaan lokal offline (`npm run check`, `npm run docs:check`, `npm run registry:validate`, `npm run release:parity`, Gate 1 `35/35`, dan `cloudshell/run-offline-cloudshell-sim.mjs`).
2. Pastikan seluruh manifes bernilai **`0.10.1`**.
3. Setelah persetujuan Gate 4A-1, push `TARGET_SHA` ke `main` tanpa tag rilis dan pastikan `ci.yml` hijau.
4. Setelah persetujuan Stage 1, jalankan `cloudshell/stage1-deploy-0pct-candidate.sh` untuk deploy kandidat `0%` dengan digest `sha256` tetap, verifikasi konfigurasi/SA/tag, uji 16 pemeriksaan OAuth/MCP/UI, dan segel `stage1-verified-receipt.json`.
5. Setelah persetujuan Stage 2, jalankan `cloudshell/stage2-promote-verified-candidate.sh` untuk pengalihan tunggal `100%` ke kandidat terverifikasi dan uji pada URL kandidat serta `https://mcp.bid-jp.com` (dengan rollback maksimal 1 kali setelah pemeriksaan kepemilikan jika verifikasi gagal).
6. Verifikasi tampilan UI `0.10.1` pada klien Claude dan ChatGPT nyata, push tag `v0.10.1` untuk publikasi npm (`release.yml`), perbarui MCP Registry, dan selesaikan prasyarat pengajuan direktori OpenAI/Anthropic.
