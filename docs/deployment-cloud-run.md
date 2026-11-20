# Cloud Run Deployment

## 日本語

Cloud Run は Streamable HTTP 版の公開先です。KKJ APIはHTTPのみですが、ユーザーにはCloud RunのHTTPS endpointを提供します。

```bash
gcloud run deploy jp-bids-mcp \
  --source . \
  --region asia-northeast1 \
  --min-instances 0 \
  --max-instances 5 \
  --memory 256Mi \
  --cpu 1 \
  --concurrency 80 \
  --timeout 30s \
  --allow-unauthenticated \
  --set-env-vars JP_BIDS_RATE_LIMIT_PER_SECOND=1
```

推奨環境変数:

- `PORT=8080`
- `HTTP_HOST=0.0.0.0`（Cloud Runでは `K_SERVICE` により自動判定されます）
- `ALLOWED_ORIGINS=https://claude.ai,https://cursor.com`
- `JP_BIDS_RATE_LIMIT_PER_SECOND=1`
- `JP_BIDS_EDGE_AUTH_SECRET`（Secret Manager 経由でマウント。Cloudflare Workers エッジゲートウェイからの検証済み転送と OAuth クライアント IP ハッシュ分離・内部テレメトリヘッダー出力に利用。詳細: [`cloudflare-edge-mcp-playbook.md`](./cloudflare-edge-mcp-playbook.md)）

デプロイ後確認:

```bash
curl https://YOUR_CLOUD_RUN_URL/health
curl https://YOUR_CLOUD_RUN_URL/readyz
npm run registry:validate
npm run remote:health
```

## English

Cloud Run hosts the Streamable HTTP server. The upstream KKJ API is HTTP-only, but users access an HTTPS Cloud Run endpoint.

Recommended environment variables:

- `PORT=8080`
- `HTTP_HOST=0.0.0.0` (automatically inferred on Cloud Run through `K_SERVICE`)
- `ALLOWED_ORIGINS=https://claude.ai,https://cursor.com`
- `JP_BIDS_RATE_LIMIT_PER_SECOND=1`
- `JP_BIDS_EDGE_AUTH_SECRET` (mounted via Secret Manager; authenticates Cloudflare Workers edge proxy headers for OAuth IP-hash rate-limit isolation and verified-edge telemetry. See [`cloudflare-edge-mcp-playbook.md`](./cloudflare-edge-mcp-playbook.md))

Post-deploy checks:

```bash
curl https://YOUR_CLOUD_RUN_URL/health
curl https://YOUR_CLOUD_RUN_URL/readyz
npm run registry:validate
npm run remote:health
```

## Bahasa Indonesia

Cloud Run menjadi host server Streamable HTTP. API KKJ upstream hanya HTTP, tetapi pengguna mengakses endpoint HTTPS dari Cloud Run.

Environment variable yang direkomendasikan:

- `PORT=8080`
- `HTTP_HOST=0.0.0.0` (di Cloud Run otomatis melalui `K_SERVICE`)
- `ALLOWED_ORIGINS=https://claude.ai,https://cursor.com`
- `JP_BIDS_RATE_LIMIT_PER_SECOND=1`
- `JP_BIDS_EDGE_AUTH_SECRET` (dipasang via Secret Manager untuk mengautentikasi header proxy Cloudflare Workers bagi isolasi rate-limit IP-hash OAuth dan telemetri edge terverifikasi; lihat [`cloudflare-edge-mcp-playbook.md`](./cloudflare-edge-mcp-playbook.md))

Pemeriksaan setelah deploy:

```bash
curl https://YOUR_CLOUD_RUN_URL/health
curl https://YOUR_CLOUD_RUN_URL/readyz
npm run registry:validate
npm run remote:health
```
