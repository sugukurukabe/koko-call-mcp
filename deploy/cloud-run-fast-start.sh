#!/bin/bash
# Cloud Run 高速起動デプロイテンプレート
# すべての child MCP で共通して使う「世界最速クラス」設定

set -e

SERVICE_NAME=$1
IMAGE=$2
REGION=${3:-asia-northeast1}

if [ -z "$SERVICE_NAME" ] || [ -z "$IMAGE" ]; then
  echo "Usage: $0 <service-name> <image> [region]"
  echo "Example: $0 real-estate-intel-mcp gcr.io/.../real-estate-intel-mcp:latest"
  exit 1
fi

echo "🚀 Deploying $SERVICE_NAME with ultra-fast cold start settings..."

gcloud run deploy "$SERVICE_NAME" \
  --image="$IMAGE" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --cpu-boost \
  --memory=1Gi \
  --cpu=1 \
  --concurrency=100 \
  --timeout=300s \
  --min-instances=0 \
  --max-instances=10 \
  --port=8080 \
  --set-env-vars="NODE_ENV=production" \
  --quiet

echo "✅ $SERVICE_NAME deployed with fast-start config."
echo "Cold start should be under 2-3 seconds for Node.js MCP servers."