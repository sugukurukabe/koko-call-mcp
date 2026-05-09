#!/bin/bash
# ============================================================
# Public MCP JP Gateway — 全7本 Cloud Run 一括デプロイスクリプト
# プロジェクトIDベース（デフォルト: ssw-compass-prod-494613）
# ============================================================
set -e

EXPECTED_PROJECT_ID=${PROJECT_ID:-ssw-compass-prod-494613}
CURRENT_PROJECT_ID=$(gcloud config get-value project)
PROJECT_ID="$EXPECTED_PROJECT_ID"
if [ -z "$PROJECT_ID" ]; then
  echo "ERROR: gcloud config にプロジェクトが設定されていません"
  echo "  gcloud config set project <PROJECT_ID>"
  exit 1
fi

if [ "$CURRENT_PROJECT_ID" != "$PROJECT_ID" ]; then
  echo "ERROR: gcloud の現在プロジェクトが想定と違います"
  echo "  Current : $CURRENT_PROJECT_ID"
  echo "  Expected: $PROJECT_ID"
  echo ""
  echo "以下を実行してから再実行してください:"
  echo "  gcloud config set project $PROJECT_ID"
  echo ""
  echo "別プロジェクトにデプロイする場合は明示的に PROJECT_ID を指定してください:"
  echo "  PROJECT_ID=$CURRENT_PROJECT_ID ./deploy/deploy-all-production.sh"
  exit 1
fi

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
REGION=${REGION:-asia-northeast1}

echo "🚀 Public MCP JP Gateway 全本番デプロイを開始します"
echo "   Project ID    : $PROJECT_ID"
echo "   Project Number: $PROJECT_NUMBER"
echo "   Region        : $REGION"
echo ""

# ============================================================
# 1. J-Grants MCP (Python)
# ============================================================
echo "=== [1/4] J-Grants MCP をデプロイ ==="
cd jgrants-mcp-server
gcloud builds submit --tag "gcr.io/$PROJECT_ID/jgrants-mcp" --quiet
cd ..
gcloud run deploy jgrants-mcp \
  --image="gcr.io/$PROJECT_ID/jgrants-mcp" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --cpu-boost \
  --memory=1Gi \
  --cpu=1 \
  --concurrency=100 \
  --min-instances=0 \
  --max-instances=10 \
  --port=8080 \
  --quiet

# ============================================================
# 2. AgriOps MCP (Node.js)
# ============================================================
echo "=== [2/4] AgriOps MCP をデプロイ ==="
cd deploy/agriops-cloud-run
gcloud builds submit --tag "gcr.io/$PROJECT_ID/agriops-mcp" --quiet
cd ../..
gcloud run deploy agriops-mcp \
  --image="gcr.io/$PROJECT_ID/agriops-mcp" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --cpu-boost \
  --memory=1Gi \
  --cpu=1 \
  --concurrency=100 \
  --min-instances=0 \
  --max-instances=10 \
  --port=8080 \
  --quiet

# ============================================================
# 3. Houjin Bangou MCP (Node.js)
# ============================================================
echo "=== [3/4] 法人番号 MCP をデプロイ ==="
cd deploy/houjin-bangou-cloud-run
gcloud builds submit --tag "gcr.io/$PROJECT_ID/houjin-bangou-mcp" --quiet
cd ../..
gcloud run deploy houjin-bangou-mcp \
  --image="gcr.io/$PROJECT_ID/houjin-bangou-mcp" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --cpu-boost \
  --memory=1Gi \
  --cpu=1 \
  --concurrency=100 \
  --min-instances=0 \
  --max-instances=10 \
  --port=8080 \
  --quiet

# ============================================================
# 4. Real Estate Intel MCP (Node.js) — 最重要
# ============================================================
echo "=== [4/4] 不動産インテル MCP をデプロイ（最優先） ==="
cd deploy/real-estate-intel-cloud-run
gcloud builds submit --tag "gcr.io/$PROJECT_ID/real-estate-intel-mcp" --quiet
cd ../..
gcloud run deploy real-estate-intel-mcp \
  --image="gcr.io/$PROJECT_ID/real-estate-intel-mcp" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --cpu-boost \
  --memory=1Gi \
  --cpu=1 \
  --concurrency=100 \
  --min-instances=0 \
  --max-instances=10 \
  --port=8080 \
  --quiet

echo ""
echo "✅ すべての Cloud Run サービスがデプロイされました！"
echo ""
echo "次のステップ:"
echo "  gcloud run services list --region=$REGION"
echo "  cd gateway && npm run verify:production"
echo ""
echo "全7本が production_ready: true になれば完了です。"
echo "各サービスの URL を確認後、gateway/config/registry.json の endpoint を更新してください。"