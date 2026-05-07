#!/bin/bash
# ============================================================
# Public MCP JP Gateway — 全7本 Cloud Run 一括デプロイスクリプト
# ============================================================
# このスクリプトを実行すると、以下の4つの child MCP を本番に上げます:
#   - jgrants-mcp
#   - agriops-mcp
#   - houjin-bangou-mcp
#   - real-estate-intel-mcp
#
# 前提:
#   - gcloud auth login 済み
#   - プロジェクト ID が 397249937286 または $PROJECT_ID で設定可能
#   - Docker がインストール済み
#
# 使い方:
#   chmod +x deploy/deploy-all-production.sh
#   ./deploy/deploy-all-production.sh
# ============================================================

set -e

PROJECT_ID=${PROJECT_ID:-397249937286}
REGION=${REGION:-asia-northeast1}

echo "🚀 Public MCP JP Gateway 全本番デプロイを開始します"
echo "   Project: $PROJECT_ID"
echo "   Region : $REGION"
echo ""

# ============================================================
# 1. J-Grants MCP (Python)
# ============================================================
echo "=== [1/4] J-Grants MCP をデプロイ ==="
cd jgrants-mcp-server
gcloud builds submit --tag gcr.io/$PROJECT_ID/jgrants-mcp --quiet
cd ..
./deploy/cloud-run-fast-start.sh jgrants-mcp gcr.io/$PROJECT_ID/jgrants-mcp:latest $REGION

# ============================================================
# 2. AgriOps MCP (Node.js)
# ============================================================
echo "=== [2/4] AgriOps MCP をデプロイ ==="
cd deploy/agriops-cloud-run
gcloud builds submit --tag gcr.io/$PROJECT_ID/agriops-mcp --quiet
cd ../..
./deploy/cloud-run-fast-start.sh agriops-mcp gcr.io/$PROJECT_ID/agriops-mcp:latest $REGION

# ============================================================
# 3. Houjin Bangou MCP (Node.js)
# ============================================================
echo "=== [3/4] 法人番号 MCP をデプロイ ==="
cd deploy/houjin-bangou-cloud-run
gcloud builds submit --tag gcr.io/$PROJECT_ID/houjin-bangou-mcp --quiet
cd ../..
./deploy/cloud-run-fast-start.sh houjin-bangou-mcp gcr.io/$PROJECT_ID/houjin-bangou-mcp:latest $REGION

# ============================================================
# 4. Real Estate Intel MCP (Node.js) — 最重要
# ============================================================
echo "=== [4/4] 不動産インテル MCP をデプロイ（最優先） ==="
cd deploy/real-estate-intel-cloud-run
gcloud builds submit --tag gcr.io/$PROJECT_ID/real-estate-intel-mcp --quiet
cd ../..
./deploy/cloud-run-fast-start.sh real-estate-intel-mcp gcr.io/$PROJECT_ID/real-estate-intel-mcp:latest $REGION

echo ""
echo "✅ すべての Cloud Run サービスがデプロイされました！"
echo ""
echo "次のステップ:"
echo "  1. 各サービスの URL を確認（gcloud run services list）"
echo "  2. Gateway の registry.json が正しい URL を指していることを確認"
echo "  3. cd gateway && npm run verify:production を実行して本番状態を検証"
echo ""
echo "全7本が production_ready: true になれば完了です。"