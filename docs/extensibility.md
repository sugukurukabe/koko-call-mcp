# 拡張性ガイド / Extensibility Guide / Panduan Perluasan

JP Bids MCP は以下の軸で拡張可能に設計されています。

## 1. ツールの追加（5分で新ツール）

新しいツールは `src/tools/` に1ファイル追加し、`register-tools.ts` に1行追加するだけ。

```typescript
// src/tools/my-new-tool.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KkjClient } from "../api/kkj-client.js";
import { z } from "zod";
import { jsonText } from "../lib/tool-result.js";

export function registerMyNewTool(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "my_new_tool",
    {
      title: "新機能",
      description: "新しいツールの説明。Description. Deskripsi.",
      inputSchema: { query: z.string().min(1) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (args) => {
      const result = await client.search({ Query: args.query, Count: 10 });
      return { content: [{ type: "text", text: jsonText(result) }] };
    },
  );
}
```

```typescript
// register-tools.ts に追加
import { registerMyNewTool } from "./my-new-tool.js";

const PRO_ONLY_REGISTRATIONS = [
  // ... 既存ツール
  registerMyNewTool,  // ← 1行追加
] as const;
```

## 2. ホワイトラベル（ENV変数で切替）

環境変数を設定するだけで、自社ブランドのMCPサーバーとして運用可能。

```bash
JP_BIDS_BRAND_NAME="MyBids Pro"
JP_BIDS_BRAND_SHORT_NAME="MyBids"
JP_BIDS_BRAND_ORG="Acme Corp"
JP_BIDS_BRAND_URL="https://mybids.example.com"
JP_BIDS_BRAND_CONTACT="support@example.com"
```

- MCPサーバーの `name` / `title` が自動的に切り替わる
- 出典表記も上書き可能
- コード変更不要

## 3. データソースの追加

`KkjClient` と同じインターフェースで新しいデータソースを追加可能。

```
src/api/
  kkj-client.ts       ← 既存: 官公需情報ポータル
  jetro-client.ts     ← 追加例: JETRO 海外入札情報
  eprocure-client.ts  ← 追加例: 電子調達システム
```

`createJpBidsServer()` で複数クライアントを注入するパターン:

```typescript
export interface CreateJpBidsServerOptions {
  kkjClient?: KkjClient;
  jetroClient?: JetroClient;  // 追加
  tier?: Tier;
}
```

## 4. ティアの追加

現在は Free / Pro の2ティア。Enterprise ティアの追加例:

```typescript
// src/lib/auth.ts
export type Tier = "free" | "pro" | "enterprise";

// register-tools.ts
const ENTERPRISE_ONLY_REGISTRATIONS = [
  registerBulkExport,      // 一括エクスポート
  registerWebhookManager,  // Webhook管理
  registerCustomScoring,   // カスタムスコアリング
] as const;
```

## 5. 通知システムの拡張

`save_search` / `check_saved_search` ツールは通知システムの起点。

拡張パス:
1. **Slack通知**: 既存の `src/jobs/slack-briefing.ts` パターンを再利用
2. **Webhook**: `check_saved_search` の結果を外部URLにPOST
3. **メール**: SendGrid / SES 連携
4. **定期実行**: Cloud Scheduler → Cloud Run Jobs

## 6. MCP Resourceの追加

`src/resources/register-resources.ts` にResource / ResourceTemplateを追加。

URI設計パターン:
- `bid://{bid_key}` — 案件詳細
- `prefecture://{lg_code}` — 都道府県情報
- `org://{organization_name}` — 発注機関情報
- `saved://{search_name}` — 保存検索結果（拡張例）
- `report://{report_id}` — 分析レポート（拡張例）

## 7. CI/CDパイプライン

新ツール追加時のチェックリスト:
1. `npm run lint` — biome check
2. `npm run build` — TypeScript コンパイル
3. `npm run test` — vitest（99テスト）
4. `npm run docs:check` — typedoc 生成
5. `npm run registry:validate` — server.json 整合性
6. `npm run release:gate` — 全ゲート通過

## アーキテクチャ図

```
┌─────────────────────────────────────────────┐
│  MCP Client (Claude / Cursor / ChatGPT)     │
└──────────────┬──────────────────────────────┘
               │ Streamable HTTP / stdio
┌──────────────▼──────────────────────────────┐
│  JP Bids MCP Server                         │
│  ┌─────────┐ ┌─────────┐ ┌──────────────┐  │
│  │ Tools   │ │Resources│ │ Prompts      │  │
│  │ (17)    │ │ (9)     │ │ (3)          │  │
│  └────┬────┘ └────┬────┘ └──────────────┘  │
│       │           │                         │
│  ┌────▼───────────▼────┐  ┌──────────────┐ │
│  │   KkjClient         │  │ Branding     │ │
│  │   (+ extensible)    │  │ (white-label)│ │
│  └────────┬────────────┘  └──────────────┘ │
└───────────┼────────────────────────────────┘
            │ HTTP
┌───────────▼────────────────────────────────┐
│  KKJ API (kkj.go.jp)                       │
│  + JETRO / eProcure / etc. (extensible)    │
└────────────────────────────────────────────┘
```
