# Cloud Run Deployment

## 日本語

Cloud Run は Streamable HTTP 版の公開先です。KKJ APIはHTTPのみですが、ユーザーにはCloud RunのHTTPS endpointを提供します。

```bash
gcloud run deploy koko-call-mcp \
  --source . \
  --region asia-northeast1 \
  --min-instances 0 \
  --max-instances 5 \
  --memory 256Mi \
  --cpu 1 \
  --concurrency 80 \
  --timeout 30s \
  --allow-unauthenticated \
  --set-env-vars PORT=8080,KOKO_CALL_RATE_LIMIT_PER_SECOND=1
```

推奨環境変数:

- `PORT=8080`
- `HTTP_HOST=0.0.0.0`（Cloud Runでは `K_SERVICE` により自動判定されます）
- `ALLOWED_ORIGINS=https://claude.ai,https://cursor.com`
- `KOKO_CALL_RATE_LIMIT_PER_SECOND=1`

デプロイ後確認:

```bash
curl https://YOUR_CLOUD_RUN_URL/healthz
npm run registry:validate
```

## English

Cloud Run hosts the Streamable HTTP server. The upstream KKJ API is HTTP-only, but users access an HTTPS Cloud Run endpoint.

Recommended environment variables:

- `PORT=8080`
- `HTTP_HOST=0.0.0.0` (automatically inferred on Cloud Run through `K_SERVICE`)
- `ALLOWED_ORIGINS=https://claude.ai,https://cursor.com`
- `KOKO_CALL_RATE_LIMIT_PER_SECOND=1`

Post-deploy checks:

```bash
curl https://YOUR_CLOUD_RUN_URL/healthz
npm run registry:validate
```

## Bahasa Indonesia

Cloud Run menjadi host server Streamable HTTP. API KKJ upstream hanya HTTP, tetapi pengguna mengakses endpoint HTTPS dari Cloud Run.

Environment variable yang direkomendasikan:

- `PORT=8080`
- `HTTP_HOST=0.0.0.0` (di Cloud Run otomatis melalui `K_SERVICE`)
- `ALLOWED_ORIGINS=https://claude.ai,https://cursor.com`
- `KOKO_CALL_RATE_LIMIT_PER_SECOND=1`

Pemeriksaan setelah deploy:

```bash
curl https://YOUR_CLOUD_RUN_URL/healthz
npm run registry:validate
```
