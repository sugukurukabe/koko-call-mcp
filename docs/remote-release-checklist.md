# Remote Release Checklist

## 日本語

`mcp.bid-jp.com` のCloud Run証明書がReadyになったら、以下の順で `0.3.2` を公開します。

1. `npm run remote:domain` でCloud Run domain mappingのReady状態を確認する。
2. `npm run remote:health` を実行する。
3. `server.json` に `remotes` を追加する。
4. `public/.well-known/mcp-server.json` に `endpoints.mcp` と `streamable-http` transportを追加する。
5. READMEに `https://mcp.bid-jp.com/mcp` を追加する。
6. `0.3.2` にversion bumpする。
7. `npm run release:gate` を実行する。
8. tag `v0.3.2` をpushする。
9. `mcp-publisher publish` でRegistryを更新する。

## English

When the Cloud Run certificate for `mcp.bid-jp.com` is ready, publish `0.3.2` in this order.

1. Run `npm run remote:domain` to check the Cloud Run domain mapping readiness.
2. Run `npm run remote:health`.
3. Add `remotes` to `server.json`.
4. Add `endpoints.mcp` and `streamable-http` transport to `public/.well-known/mcp-server.json`.
5. Add `https://mcp.bid-jp.com/mcp` to the README.
6. Bump the version to `0.3.2`.
7. Run `npm run release:gate`.
8. Push tag `v0.3.2`.
9. Run `mcp-publisher publish` to update the Registry.

## Bahasa Indonesia

Saat sertifikat Cloud Run untuk `mcp.bid-jp.com` sudah Ready, rilis `0.3.2` dengan urutan berikut.

1. Jalankan `npm run remote:domain` untuk memeriksa kesiapan domain mapping Cloud Run.
2. Jalankan `npm run remote:health`.
3. Tambahkan `remotes` ke `server.json`.
4. Tambahkan `endpoints.mcp` dan transport `streamable-http` ke `public/.well-known/mcp-server.json`.
5. Tambahkan `https://mcp.bid-jp.com/mcp` ke README.
6. Naikkan versi ke `0.3.2`.
7. Jalankan `npm run release:gate`.
8. Push tag `v0.3.2`.
9. Jalankan `mcp-publisher publish` untuk memperbarui Registry.
