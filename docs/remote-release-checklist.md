# Remote Release Checklist

## 日本語

`mcp.bid-jp.com` の Cloud Run 上で v0.4.0 を反映する場合、以下の順で公開します。

1. `npm run remote:domain` で Cloud Run domain mapping の Ready 状態を確認する。
2. `npm run remote:health` を実行し、`/readyz` と `/mcp` GET 405 を確認する。
3. `npm run remote:mcp` で v0.3.x 時点の tool / prompt / resource / template / completion / tool call を確認する (旧版 baseline)。
4. `package.json`, `server.json`, `public/.well-known/mcp-server.json`, `public/.well-known/agents.json`, `CITATION.cff`, `src/server.ts` の version が `0.4.0` であることを確認する (`npm run registry:validate`)。
5. 本番公開前に必ず `ALLOWED_ORIGINS` を Secret Manager か環境変数で明示する (公開時のCORSはこの値で制御される)。
6. `npm run check` と `npm run release:gate` を実行する。
7. `dist/apps/search-results.html` が含まれる Docker image を build & push する (`docs/deployment-cloud-run.md` の手順)。
8. Cloud Run service `jp-bids-mcp` を新リビジョンで deploy する。
9. `npm run remote:health` と `npm run remote:mcp` を再実行し、新しい AI Bid Radar tools (`rank_bids`, `analyze_past_awards` ほか) と `search_bids_app` が `tools/list` に出ることを確認する。
10. tag `v0.4.0` を push し、`mcp-publisher publish` で MCP Registry を更新する。
11. `npm publish --provenance` を GitHub Actions Trusted Publisher 経由で実行し、npm に v0.4.0 を反映する。

## English

When releasing v0.4.0 to the Cloud Run remote at `mcp.bid-jp.com`, follow this order.

1. Run `npm run remote:domain` to confirm the Cloud Run domain mapping is Ready.
2. Run `npm run remote:health`. It checks `/readyz` and `/mcp` GET 405.
3. Run `npm run remote:mcp` to capture the current (pre-v0.4.0) tools/prompts/resources/templates/completion/tool call as a baseline.
4. Confirm `package.json`, `server.json`, `public/.well-known/mcp-server.json`, `public/.well-known/agents.json`, `CITATION.cff`, and `src/server.ts` all read `0.4.0` (`npm run registry:validate`).
5. Before public release, set `ALLOWED_ORIGINS` explicitly through Secret Manager or environment variables (this controls CORS at the public endpoint).
6. Run `npm run check` and `npm run release:gate`.
7. Build and push a Docker image that includes `dist/apps/search-results.html` (see `docs/deployment-cloud-run.md`).
8. Deploy a new revision of the Cloud Run service `jp-bids-mcp`.
9. Re-run `npm run remote:health` and `npm run remote:mcp` and confirm the new AI Bid Radar tools (`rank_bids`, `analyze_past_awards`, and the rest) plus `search_bids_app` appear in `tools/list`.
10. Push tag `v0.4.0` and run `mcp-publisher publish` to update the MCP Registry.
11. Run `npm publish --provenance` through the GitHub Actions Trusted Publisher to release v0.4.0 on npm.

## Bahasa Indonesia

Saat merilis v0.4.0 ke remote Cloud Run di `mcp.bid-jp.com`, ikuti urutan berikut.

1. Jalankan `npm run remote:domain` untuk memastikan domain mapping Cloud Run sudah Ready.
2. Jalankan `npm run remote:health`. Perintah ini memeriksa `/readyz` dan `/mcp` GET 405.
3. Jalankan `npm run remote:mcp` untuk mencatat tools/prompts/resources/templates/completion/tool call saat ini (sebelum v0.4.0) sebagai baseline.
4. Pastikan `package.json`, `server.json`, `public/.well-known/mcp-server.json`, `public/.well-known/agents.json`, `CITATION.cff`, dan `src/server.ts` semuanya bernilai `0.4.0` (`npm run registry:validate`).
5. Sebelum rilis publik, set `ALLOWED_ORIGINS` secara eksplisit lewat Secret Manager atau environment variable (nilai inilah yang mengatur CORS di endpoint publik).
6. Jalankan `npm run check` dan `npm run release:gate`.
7. Build dan push Docker image yang menyertakan `dist/apps/search-results.html` (lihat `docs/deployment-cloud-run.md`).
8. Deploy revisi baru Cloud Run service `jp-bids-mcp`.
9. Jalankan kembali `npm run remote:health` dan `npm run remote:mcp`, lalu konfirmasi tools AI Bid Radar baru (`rank_bids`, `analyze_past_awards`, dll.) serta `search_bids_app` muncul di `tools/list`.
10. Push tag `v0.4.0` dan jalankan `mcp-publisher publish` untuk memperbarui MCP Registry.
11. Jalankan `npm publish --provenance` melalui GitHub Actions Trusted Publisher untuk merilis v0.4.0 ke npm.
