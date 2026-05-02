# Remote Release Checklist

## 日本語

`mcp.bid-jp.com` のCloud Run証明書がReadyになったら、以下の順で `0.3.2` を公開します。

1. `npm run remote:domain` でCloud Run domain mappingのReady状態を確認する。
2. `npm run remote:health` を実行する。`/readyz` と `/mcp` GET 405 を確認します。
3. `npm run remote:mcp` を実行し、tools/prompts/resources/templates/completion/tool callを確認する。
4. `server.json` に `remotes` を追加する。
5. `public/.well-known/mcp-server.json` に `endpoints.mcp` と `streamable-http` transportを追加する。
6. READMEに `https://mcp.bid-jp.com/mcp` を追加する。
7. `0.3.2` にversion bumpする。
8. `npm run release:gate` を実行する。
9. tag `v0.3.2` をpushする。
10. `mcp-publisher publish` でRegistryを更新する。

## English

When the Cloud Run certificate for `mcp.bid-jp.com` is ready, publish `0.3.2` in this order.

1. Run `npm run remote:domain` to check the Cloud Run domain mapping readiness.
2. Run `npm run remote:health`. It checks `/readyz` and `/mcp` GET 405.
3. Run `npm run remote:mcp` to verify tools, prompts, resources, templates, completion, and a tool call.
4. Add `remotes` to `server.json`.
5. Add `endpoints.mcp` and `streamable-http` transport to `public/.well-known/mcp-server.json`.
6. Add `https://mcp.bid-jp.com/mcp` to the README.
7. Bump the version to `0.3.2`.
8. Run `npm run release:gate`.
9. Push tag `v0.3.2`.
10. Run `mcp-publisher publish` to update the Registry.

## Bahasa Indonesia

Saat sertifikat Cloud Run untuk `mcp.bid-jp.com` sudah Ready, rilis `0.3.2` dengan urutan berikut.

1. Jalankan `npm run remote:domain` untuk memeriksa kesiapan domain mapping Cloud Run.
2. Jalankan `npm run remote:health`. Perintah ini memeriksa `/readyz` dan `/mcp` GET 405.
3. Jalankan `npm run remote:mcp` untuk memverifikasi tools, prompts, resources, templates, completion, dan tool call.
4. Tambahkan `remotes` ke `server.json`.
5. Tambahkan `endpoints.mcp` dan transport `streamable-http` ke `public/.well-known/mcp-server.json`.
6. Tambahkan `https://mcp.bid-jp.com/mcp` ke README.
7. Naikkan versi ke `0.3.2`.
8. Jalankan `npm run release:gate`.
9. Push tag `v0.3.2`.
10. Jalankan `mcp-publisher publish` untuk memperbarui Registry.
