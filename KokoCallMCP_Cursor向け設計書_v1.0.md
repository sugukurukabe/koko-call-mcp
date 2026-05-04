# JP Bids MCP — 官公需入札MCP Cursor向け設計書 v1.0

> **対象API**：中小企業庁 官公需情報ポータルサイト検索API（e-Govカタログ #67）
> **エンドポイント**：`http://www.kkj.go.jp/api/`
> **認証**：不要
> **レスポンス**：XML
> **準拠仕様**：MCP Spec 2025-11-25 + ext-apps 2026-01-26（Phase 4以降）
> **ライセンス**：Apache-2.0
> **想定実装期間**：Phase 0=5日、Phase 1=2週、Phase 2=1ヶ月

---

## 0. これは何か（3行）

日本全国の入札情報を Claude / Cursor / VS Code から自然言語で検索・追跡できる MCP サーバ。「鹿児島県の今月のIT入札」「東京都の建設工事で締切が来週のもの」を一発で返す。米国 SAM.gov MCP（`blencorp/capture-mcp-server`）の日本版に相当する、日本の公共調達データ向け MCP 実装を目指す。

---

## 1. なぜこの順番で作るべきか

| 軸 | 評価 |
|---|---|
| **API単純度** | エンドポイント1つ・認証なし・REST GET・XML返却 |
| **データ整備コスト** | ゼロ（公式APIが全データ提供） |
| **既存OSS** | GitHub・npm検索では公開例が限られる |
| **米国先行** | SAM.gov MCP 多数（型紙としての参考は豊富） |
| **想定ユーザー** | 自治体ITベンダー数千社・建設業数万社・公共コンサル |
| **競合商用** | NJSS（月2-5万円）、入札情報サービス（高額） |
| **OSS化リスク** | 規約上問題なし（kkj.go.jp 利用規約は公開API使用を許容） |
| **PR効果** | 「日本独自MCPの先駆け事例」として日経クロステック等で取り上げられ得る |

**スグクル本業との関連**：直接的でない。だが**「営業で公的調達を狙う」「自社/子会社の知見を地方自治体に売り込む」場面で利用価値あり**。鹿児島県内自治体への提案活動でも使える。何より **OSS リード企業としてのブランド構築** が最大の価値。

---

## 2. API 仕様の核心（完全把握済み）

API ガイド（`https://www.kkj.go.jp/doc/ja/api_guide.pdf` v1.1, 2016-05-27）を完全読解した結果、必要な情報すべて：

### 2.1 エンドポイント
```
http://www.kkj.go.jp/api/
```
HTTPS非対応のため、Cloud Run/Express から呼ぶことで実質HTTPS化される（クライアント→Cloud Run はHTTPS、Cloud Run→kkj.go.jp はHTTP）。

### 2.2 主要パラメータ

| パラメータ | 形式 | 必須 | 内容 |
|---|---|---|---|
| `Query` | 文字列 | △ | 検索キーワード（AND/OR/ANDNOT/NOT 演算子対応） |
| `Project_Name` | 文字列 | △ | 件名で絞込（前後方・途中一致） |
| `Organization_Name` | 文字列 | △ | 機関名で絞込（前後方・途中一致） |
| `LG_Code` | 数値,数値,... | △ | 都道府県コード（JIS X0401、複数指定可） |
| `Category` | 数値 | – | 1=物品, 2=工事, 3=役務 |
| `Procedure_Type` | 数値 | – | 1=一般競争入札, 2=簡易公募型競争入札, 3=簡易公募型指名競争入札 |
| `Certification` | 英字 | – | A/B/C/D 入札資格 |
| `CFT_Issue_Date` | 期間 | – | 公告日 |
| `Tender_Submission_Deadline` | 期間 | – | 入札開始日 |
| `Opening_Tenders_Event` | 期間 | – | 開札日 |
| `Period_End_Time` | 期間 | – | 納入期限日 |
| `Count` | 数値 | – | 最大件数（既定10、上限1,000） |

> △印は **いずれか1つ必須**（AND結合）。

### 2.3 期間形式

`YYYY-MM-DD/YYYY-MM-DD`、`YYYY-MM-DD/`（以降）、`/YYYY-MM-DD`（以前）、`YYYY-MM-DD`（同日）

### 2.4 レスポンスXMLの主要タグ

```xml
<Results>
  <Version>1.0</Version>
  <SearchResults>
    <SearchHits>123</SearchHits>
    <SearchResult>
      <ResultId>1</ResultId>
      <Key>...</Key>
      <ExternalDocumentURI>https://...</ExternalDocumentURI>
      <ProjectName>○○システム保守業務委託</ProjectName>
      <Date>2026-04-25T09:00:00+09:00</Date>
      <LgCode>46</LgCode>
      <PrefectureName>鹿児島県</PrefectureName>
      <CityCode>46201</CityCode>
      <CityName>鹿児島市</CityName>
      <OrganizationName>鹿児島市</OrganizationName>
      <Certification>A B</Certification>
      <CftIssueDate>2026-04-25</CftIssueDate>
      <PeriodEndTime>2027-03-31</PeriodEndTime>
      <Category>役務</Category>
      <ProcedureType>一般競争入札</ProcedureType>
      <Location>鹿児島市役所</Location>
      <TenderSubmissionDeadline>2026-05-15</TenderSubmissionDeadline>
      <OpeningTendersEvent>2026-05-20</OpeningTendersEvent>
      <ItemCode>...</ItemCode>
      <ProjectDescription>...</ProjectDescription>
      <Attachments>
        <Attachment>
          <Name>仕様書.pdf</Name>
          <Uri>https://...</Uri>
        </Attachment>
      </Attachments>
    </SearchResult>
  </SearchResults>
</Results>
```

### 2.5 都道府県コード（JIS X0401）

01=北海道, 02=青森, ..., 13=東京都, 27=大阪府, 46=鹿児島県, 47=沖縄県（全47）

### 2.6 既知の制限・注意

- **HTTPS非対応**：MCPサーバ側でラップして提供
- **Count上限1,000**：ページング機能なし、これ以上は期間絞込で対応
- **Query等いずれか必須**：MCPツール側で`LG_Code`既定値（全都道府県）を入れる工夫が必要なケースあり
- **オプション項目**：`LgCode`等の地理情報は欠落しているレコード多数（公告元が記載していない）
- **レート制限**：明示なし。Zennの実装事例（2025-03）でも問題報告なし。常識的に1秒1-2リクエストで運用

---

## 3. ツール設計（model-visible 4本のみ）

### 3.1 ツール一覧

| name | 引数 | 役割 |
|---|---|---|
| `search_bids` | `query?, prefecture?, category?, procedure_type?, due_after?, due_before?, limit?` | メイン入札検索 |
| `list_recent_bids` | `prefecture?, category?, days?` | 直近X日間の新着入札（営業の毎日チェック用） |
| `get_bid_detail` | `bid_key` | 1件の完全詳細（添付ファイル含む） |
| `summarize_bids_by_org` | `organization_name, since?` | 機関別の発注パターン分析 |

> **設計原則の適用**：
> - **Convergence over choice**：`get_weather_1km` の中で複数データソースを統合した SuguAgriField と同じく、`search_bids` 1本で多様な検索ニーズを吸収
> - **Composability over specificity**：4本の組み合わせで「鹿児島市の過去半年の役務発注パターン」のような複合質問もLLMが組み立てる
> - **Capability over compensation**：自然言語クエリのパースは LLM に丸投げ、MCP側はパラメータマッピングのみ

### 3.2 各ツールの詳細スキーマ

**`search_bids`**

```typescript
{
  query: z.string().optional()
    .describe("自由記述キーワード。複数キーワードはAND結合（例: 'Webシステム 保守'）"),
  prefecture: z.union([z.string(), z.array(z.string())]).optional()
    .describe("都道府県名（'鹿児島県'）または配列（['東京都', '神奈川県']）"),
  category: z.enum(["物品", "工事", "役務"]).optional()
    .describe("入札カテゴリ"),
  procedure_type: z.enum(["一般競争入札", "簡易公募型競争入札", "簡易公募型指名競争入札"]).optional(),
  certification: z.array(z.enum(["A", "B", "C", "D"])).optional()
    .describe("必要な入札資格"),
  organization_name: z.string().optional()
    .describe("発注機関名（前後方・途中一致）"),
  // 期間系
  issued_after: z.string().optional()
    .describe("公告日（YYYY-MM-DD）以降"),
  issued_before: z.string().optional(),
  due_after: z.string().optional()
    .describe("入札開始日（YYYY-MM-DD）以降"),
  due_before: z.string().optional(),
  limit: z.number().int().min(1).max(1000).default(20),
}
```

**`list_recent_bids`**

```typescript
{
  prefecture: z.string().optional(),
  category: z.enum(["物品", "工事", "役務"]).optional(),
  days: z.number().int().min(1).max(30).default(7)
    .describe("過去何日間の新着を取得するか（既定: 7日）"),
}
```

**`get_bid_detail`**

```typescript
{
  bid_key: z.string()
    .describe("search_bids/list_recent_bids が返す Key フィールド"),
}
```

**`summarize_bids_by_org`**

```typescript
{
  organization_name: z.string()
    .describe("分析対象の発注機関名"),
  since: z.string().optional()
    .describe("YYYY-MM-DD 以降のデータで集計（既定: 過去1年）"),
}
```

---

## 4. プロジェクト構造（Cursor IDE 最適化）

シンプルさ最優先。SuguAgriFieldの v2.0 から **大幅減量** した構造：

```
jp-bids-mcp/
├── .cursor/
│   └── rules/
│       ├── 00-project.mdc          \# プロジェクト概要
│       ├── 01-mcp-rules.mdc        \# MCPツール命名・スキーマ規約
│       └── 02-data-license.mdc     \# kkj.go.jp 規約
├── AGENTS.md                       \# Cursor/Claude Code 共通指示
├── README.md (英)
├── README.ja.md (日)
├── LICENSE                         \# Apache-2.0
├── CHANGELOG.md
├── package.json
├── tsconfig.json
├── biome.json
├── vitest.config.ts
├── Dockerfile
├── server.ts                       \# エントリポイント
├── src/
│   ├── kkj-client.ts               \# kkj.go.jp APIラッパー
│   ├── xml-parser.ts               \# fast-xml-parser でXML→JSON
│   ├── prefecture-codes.ts         \# 都道府県名⇔JISコード変換
│   ├── tools/
│   │   ├── _registry.ts
│   │   ├── search-bids.ts
│   │   ├── list-recent-bids.ts
│   │   ├── get-bid-detail.ts
│   │   └── summarize-bids-by-org.ts
│   ├── lib/
│   │   ├── cache.ts                \# in-memory LRU（kkj.go.jpへの負荷軽減）
│   │   └── rate-limiter.ts         \# token-bucket
│   └── types/
│       └── bid.ts
├── public/
│   └── .well-known/
│       └── mcp-server.json         \# Server Card（公式ロードマップ整合）
├── tests/
│   ├── kkj-client.test.ts
│   ├── xml-parser.test.ts
│   └── tools/
└── docs/
    ├── api-reference.md
    └── data-license.md
```

**特徴**：
- ファイル数 **30未満**（SuguAgriField v2.0 は 60超）
- TypeScript ESM + Node 18+
- 依存：`@modelcontextprotocol/sdk`, `fast-xml-parser`, `zod`, `node-fetch`, `lru-cache`（Phase 0で必要なのはこれだけ）
- 静的データ（都道府県コード）はTSコードに直書き → DB不要

---

## 5. .cursor/rules/ 最小セット

### `00-project.mdc`

```mdc
---
description: JP Bids MCP project overview
alwaysApply: true
---

\# JP Bids MCP

日本の官公需入札情報を MCP で提供するサーバ。
中小企業庁 官公需情報ポータルサイト検索API（http://www.kkj.go.jp/api/）の唯一のラッパー。

\## 重要事実
- 認証なし、HTTP(S)→GET、XMLレスポンス
- 自治体ITベンダー・建設業・コンサル向け
- 米国 SAM.gov MCP（blencorp/capture-mcp-server）の日本版
- 既存OSS: ゼロ（世界初）

\## 守るべきこと
- API ガイド（docs/api-reference.md）から逸脱しない
- 規約（02-data-license.mdc）の出典明記義務を守る
- ツール名・引数スキーマは公開後変更しない（Stability原則）

\## 現在の Phase
package.json の version で判定
- 0.1.x = Phase 0 (4ツール完成、stdio動作)
- 0.2.x = Phase 1 (Cloud Run公開)
- 0.3.x = Phase 2 (Prompts追加)
- 1.0.0 = Phase 3完了でAPI固定
```

### `01-mcp-rules.mdc`

```mdc
---
description: MCP tool design rules
globs: src/tools/**/*.ts
---

\# MCP ツール設計ルール

\## ツール命名
- snake_case
- 動詞_名詞: search_bids, get_bid_detail
- 公開後変更不可

\## 戻り値の必須形式
\`\`\`typescript
{
  content: [{ type: "text", text: "<人間向けサマリ>" }],
  structuredContent: { /* 型をZodで定義 */ },
  _meta: { /* viewUUID等は必要に応じて */ }
}
\`\`\`

\## エラー
- 引数不正 → { isError: true, content: [{ type: "text", text: "..." }] }
- API障害 → throw（SDKがJSON-RPC errorに変換）

\## description
- LLM向けの完全文。1-2文で「いつ呼ぶか」が明確に
- 例: "日本全国の官公需入札情報を、キーワード・都道府県・カテゴリで検索する。直近の新着が欲しいなら list_recent_bids を使う。"

\## キャッシュ
- kkj.go.jpへの負荷軽減のため、同一クエリは10分間キャッシュ
- src/lib/cache.ts のLRU使用
```

### `02-data-license.mdc`

```mdc
---
description: kkj.go.jp data usage policy
alwaysApply: true
---

\# 官公需情報ポータルサイト 利用規約まとめ

\## 出典
中小企業庁 官公需情報ポータルサイト（https://kkj.go.jp/）

\## 規約上のポイント
- 公開API使用OK（kkj.go.jp 利用規約 R6/6/25版）
- 出典明記必須
- システムに過大な負荷をかけない

\## 本MCPでの実装
1. ツール戻り値のtextに「出典: 中小企業庁 官公需情報ポータルサイト」を毎回付加
2. レート制限: 同一プロセスから 1秒1リクエスト上限（token-bucket）
3. キャッシュ: 同一クエリは10分保持
4. README で利用規約原文URLを掲載

\## 禁止事項
- 取得データの再配布（バルクダウンロード→公開不可）
- 商用サービスでデータをそのまま販売
```

### `AGENTS.md`

```markdown
\# AGENTS.md

\## あなたの役割
このリポジトリは JP Bids MCP（官公需入札MCP）。MCP公式仕様（https://modelcontextprotocol.io）と
.cursor/rules/ を最優先で参照。

\## 開発前に必ずやること
1. .cursor/rules/00-project.mdc を読む
2. 関連するルール（01, 02）を読む
3. 既存実装（src/kkj-client.ts など）を読む
4. テストを書いてから実装

\## してはいけないこと
- 公開済みツールの引数・名称を変更（CHANGELOG確認）
- kkj.go.jp に短時間で大量アクセス
- 取得XMLデータをコミット（テスト用フィクスチャは tests/fixtures/ にOK）

\## Phase進行
- Phase 0 (Day 1-5): 4ツール + stdio動作
- Phase 1 (Day 6-10): Cloud Run公開
- Phase 2 (Week 3-4): Prompts追加
- Phase 3 (Week 5-8): MCP Apps UI（オプション、需要あれば）
```

---

## 6. コード雛形（コピペで動くレベル）

### 6.1 `src/kkj-client.ts` — APIラッパー

```typescript
import { XMLParser } from "fast-xml-parser";
import { LRUCache } from "lru-cache";

const KKJ_API_URL = "http://www.kkj.go.jp/api/";

export interface KkjSearchParams {
  Query?: string;
  Project_Name?: string;
  Organization_Name?: string;
  LG_Code?: string; // "13" or "13,27,46"
  Category?: 1 | 2 | 3;
  Procedure_Type?: 1 | 2 | 3;
  Certification?: string; // "A,B"
  CFT_Issue_Date?: string;
  Tender_Submission_Deadline?: string;
  Opening_Tenders_Event?: string;
  Period_End_Time?: string;
  Count?: number;
}

export interface KkjBid {
  resultId: number;
  key: string;
  externalDocumentUri?: string;
  projectName: string;
  date: string;
  fileType?: string;
  fileSize?: number;
  lgCode?: string;
  prefectureName?: string;
  cityCode?: string;
  cityName?: string;
  organizationName?: string;
  certification?: string;
  cftIssueDate?: string;
  periodEndTime?: string;
  category?: "物品" | "工事" | "役務";
  procedureType?: string;
  location?: string;
  tenderSubmissionDeadline?: string;
  openingTendersEvent?: string;
  itemCode?: string;
  projectDescription?: string;
  attachments?: { name: string; uri: string }[];
}

export interface KkjSearchResult {
  searchHits: number;
  bids: KkjBid[];
  source: "中小企業庁 官公需情報ポータルサイト";
  fetchedAt: string;
}

const cache = new LRUCache<string, KkjSearchResult>({
  max: 500,
  ttl: 10 * 60 * 1000, // 10分
});

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true,
});

export async function searchKkj(params: KkjSearchParams): Promise<KkjSearchResult> {
  // 必須パラメータの強制
  if (
    !params.Query &&
    !params.Project_Name &&
    !params.Organization_Name &&
    !params.LG_Code
  ) {
    throw new Error(
      "Query, Project_Name, Organization_Name, LG_Code のいずれか1つは必須です"
    );
  }

  const cacheKey = JSON.stringify(params);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = new URL(KKJ_API_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "JP Bids MCP/0.1.0" },
    // 10秒タイムアウト
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(\`kkj.go.jp returned \${res.status}\`);
  }

  const xml = await res.text();
  const parsed = xmlParser.parse(xml);

  // エラーチェック
  if (parsed.Results?.Error) {
    throw new Error(\`kkj API error: \${parsed.Results.Error}\`);
  }

  const sr = parsed.Results?.SearchResults;
  const rawResults = Array.isArray(sr?.SearchResult)
    ? sr.SearchResult
    : sr?.SearchResult
      ? [sr.SearchResult]
      : [];

  const bids: KkjBid[] = rawResults.map((r: any) => ({
    resultId: Number(r.ResultId),
    key: String(r.Key),
    externalDocumentUri: r.ExternalDocumentURI,
    projectName: String(r.ProjectName),
    date: String(r.Date),
    fileType: r.FileType,
    fileSize: r.FileSize ? Number(r.FileSize) : undefined,
    lgCode: r.LgCode ? String(r.LgCode) : undefined,
    prefectureName: r.PrefectureName,
    cityCode: r.CityCode ? String(r.CityCode) : undefined,
    cityName: r.CityName,
    organizationName: r.OrganizationName,
    certification: r.Certification,
    cftIssueDate: r.CftIssueDate,
    periodEndTime: r.PeriodEndTime,
    category: r.Category,
    procedureType: r.ProcedureType,
    location: r.Location,
    tenderSubmissionDeadline: r.TenderSubmissionDeadline,
    openingTendersEvent: r.OpeningTendersEvent,
    itemCode: r.ItemCode,
    projectDescription: r.ProjectDescription,
    attachments: r.Attachments?.Attachment
      ? (Array.isArray(r.Attachments.Attachment)
          ? r.Attachments.Attachment
          : [r.Attachments.Attachment]
        ).map((a: any) => ({ name: a.Name, uri: a.Uri }))
      : undefined,
  }));

  const result: KkjSearchResult = {
    searchHits: Number(sr?.SearchHits ?? 0),
    bids,
    source: "中小企業庁 官公需情報ポータルサイト",
    fetchedAt: new Date().toISOString(),
  };

  cache.set(cacheKey, result);
  return result;
}
```

### 6.2 `src/prefecture-codes.ts`

```typescript
export const PREFECTURE_CODES: Record<string, string> = {
  北海道: "01", 青森県: "02", 岩手県: "03", 宮城県: "04",
  秋田県: "05", 山形県: "06", 福島県: "07", 茨城県: "08",
  栃木県: "09", 群馬県: "10", 埼玉県: "11", 千葉県: "12",
  東京都: "13", 神奈川県: "14", 新潟県: "15", 富山県: "16",
  石川県: "17", 福井県: "18", 山梨県: "19", 長野県: "20",
  岐阜県: "21", 静岡県: "22", 愛知県: "23", 三重県: "24",
  滋賀県: "25", 京都府: "26", 大阪府: "27", 兵庫県: "28",
  奈良県: "29", 和歌山県: "30", 鳥取県: "31", 島根県: "32",
  岡山県: "33", 広島県: "34", 山口県: "35", 徳島県: "36",
  香川県: "37", 愛媛県: "38", 高知県: "39", 福岡県: "40",
  佐賀県: "41", 長崎県: "42", 熊本県: "43", 大分県: "44",
  宮崎県: "45", 鹿児島県: "46", 沖縄県: "47",
};

export function toLgCode(prefectures: string | string[]): string {
  const arr = Array.isArray(prefectures) ? prefectures : [prefectures];
  const codes = arr
    .map((p) => PREFECTURE_CODES[p])
    .filter((c): c is string => Boolean(c));
  if (codes.length === 0) {
    throw new Error(\`Unknown prefecture: \${arr.join(", ")}\`);
  }
  return codes.join(",");
}

export const CATEGORY_CODES = { 物品: 1, 工事: 2, 役務: 3 } as const;
export const PROCEDURE_TYPE_CODES = {
  一般競争入札: 1,
  簡易公募型競争入札: 2,
  簡易公募型指名競争入札: 3,
} as const;
```

### 6.3 `src/tools/search-bids.ts`

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchKkj, type KkjSearchParams } from "../kkj-client.js";
import {
  toLgCode,
  CATEGORY_CODES,
  PROCEDURE_TYPE_CODES,
} from "../prefecture-codes.js";

const inputSchema = {
  query: z.string().optional()
    .describe("自由記述キーワード。複数キーワードはAND結合（例: 'Webシステム 保守'）"),
  prefecture: z.union([z.string(), z.array(z.string())]).optional()
    .describe("都道府県名（'鹿児島県'）または配列（['東京都', '神奈川県']）"),
  category: z.enum(["物品", "工事", "役務"]).optional(),
  procedure_type: z
    .enum(["一般競争入札", "簡易公募型競争入札", "簡易公募型指名競争入札"])
    .optional(),
  certification: z.array(z.enum(["A", "B", "C", "D"])).optional(),
  organization_name: z.string().optional(),
  issued_after: z.string().optional()
    .describe("公告日（YYYY-MM-DD）以降"),
  issued_before: z.string().optional(),
  due_after: z.string().optional()
    .describe("入札開始日（YYYY-MM-DD）以降"),
  due_before: z.string().optional(),
  limit: z.number().int().min(1).max(1000).default(20),
};

export function registerSearchBids(server: McpServer) {
  server.registerTool(
    "search_bids",
    {
      title: "官公需入札検索",
      description:
        "日本全国の官公需入札情報を検索する。中小企業庁 官公需情報ポータルサイトAPIを使用。" +
        "キーワード・都道府県・カテゴリ・公告日・入札開始日などで絞込可能。" +
        "直近の新着だけ欲しい場合は list_recent_bids を使うこと。" +
        "1件の詳細（添付含む）が欲しい場合は get_bid_detail を使うこと。",
      inputSchema,
    },
    async (args) => {
      const params: KkjSearchParams = {};

      if (args.query) params.Query = args.query;
      if (args.organization_name) params.Organization_Name = args.organization_name;
      if (args.prefecture) params.LG_Code = toLgCode(args.prefecture);
      if (args.category) params.Category = CATEGORY_CODES[args.category];
      if (args.procedure_type)
        params.Procedure_Type = PROCEDURE_TYPE_CODES[args.procedure_type];
      if (args.certification && args.certification.length > 0)
        params.Certification = args.certification.join(",");

      // 期間
      if (args.issued_after || args.issued_before) {
        params.CFT_Issue_Date = \`\${args.issued_after ?? ""}/\${args.issued_before ?? ""}\`;
      }
      if (args.due_after || args.due_before) {
        params.Tender_Submission_Deadline = \`\${args.due_after ?? ""}/\${args.due_before ?? ""}\`;
      }

      params.Count = args.limit;

      // いずれか必須の確認（クエリ・件名・機関・都道府県）
      if (!params.Query && !params.Project_Name && !params.Organization_Name && !params.LG_Code) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "検索には query / prefecture / organization_name のいずれか1つ以上が必要です。",
            },
          ],
        };
      }

      const result = await searchKkj(params);

      // LLM向けの人間サマリ
      const summary = formatSummary(result);

      return {
        content: [{ type: "text", text: summary }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    }
  );
}

function formatSummary(r: ReturnType<typeof searchKkj> extends Promise<infer T> ? T : never): string {
  const lines = [
    \`\${r.searchHits}件ヒット（取得 \${r.bids.length}件）\`,
    \`出典: \${r.source}\`,
    "",
  ];
  for (const b of r.bids.slice(0, 10)) {
    lines.push(
      \`■ \${b.projectName}\`,
      \`  機関: \${b.organizationName ?? "?"} | \${b.prefectureName ?? "?"}\`,
      \`  公告日: \${b.cftIssueDate ?? "?"} | 入札開始: \${b.tenderSubmissionDeadline ?? "?"} | 開札: \${b.openingTendersEvent ?? "?"}\`,
      \`  カテゴリ: \${b.category ?? "?"} | 公示種別: \${b.procedureType ?? "?"} | 資格: \${b.certification ?? "?"}\`,
      \`  Key: \${b.key}\`,
      ""
    );
  }
  if (r.bids.length > 10) {
    lines.push(\`(他 \${r.bids.length - 10} 件は structuredContent を参照)\`);
  }
  return lines.join("\n");
}
```

### 6.4 `server.ts` — エントリポイント

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cors from "cors";
import { registerSearchBids } from "./src/tools/search-bids.js";
import { registerListRecentBids } from "./src/tools/list-recent-bids.js";
import { registerGetBidDetail } from "./src/tools/get-bid-detail.js";
import { registerSummarizeBidsByOrg } from "./src/tools/summarize-bids-by-org.js";

const server = new McpServer({
  name: "JP Bids MCP",
  version: "0.1.0",
});

registerSearchBids(server);
registerListRecentBids(server);
registerGetBidDetail(server);
registerSummarizeBidsByOrg(server);

const mode = process.argv.includes("--http") ? "http" : "stdio";

if (mode === "stdio") {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("JP Bids MCP listening on stdio");
} else {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Server Card (公式 roadmap 整合)
  app.use("/.well-known", express.static("public/.well-known"));

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = Number(process.env.PORT ?? 3001);
  app.listen(port, () => {
    console.log(\`JP Bids MCP listening on http://localhost:\${port}/mcp\`);
  });
}
```

### 6.5 `public/.well-known/mcp-server.json`

```json
{
  "name": "JP Bids MCP",
  "version": "0.1.0",
  "description": "Japan Government Procurement (KKJ) Search MCP Server. Search public bids from all Japanese central/local governments via natural language.",
  "homepage": "https://github.com/sugukurukabe/koko-call-mcp",
  "repository": "https://github.com/sugukurukabe/koko-call-mcp",
  "license": "Apache-2.0",
  "endpoints": {
    "mcp": "Cloud Run デプロイ後に確定する公開URL"
  },
  "capabilities": {
    "tools": { "listChanged": false }
  },
  "tools": [
    { "name": "search_bids" },
    { "name": "list_recent_bids" },
    { "name": "get_bid_detail" },
    { "name": "summarize_bids_by_org" }
  ],
  "transports": ["streamable-http"],
  "languages": ["ja", "en"],
  "data_sources": [
    {
      "name": "中小企業庁 官公需情報ポータルサイト 検索API",
      "url": "https://kkj.go.jp/",
      "license_url": "https://kkj.go.jp/s/help/notes/"
    }
  ]
}
```

---

## 7. Phase 別ロードマップ

### Phase 0: コア4ツール（Day 1-5）

| 日 | タスク |
|---|---|
| **Day 1** | プロジェクト初期化、`.cursor/rules/` 6本、kkj-client.ts、xml-parser テスト |
| **Day 2** | search-bids.ts 完成、stdio で Claude Desktop 接続確認 |
| **Day 3** | list-recent-bids.ts、get-bid-detail.ts |
| **Day 4** | summarize-bids-by-org.ts、ユニットテスト一通り |
| **Day 5** | README英日、CHANGELOG、`v0.1.0` GitHub公開 |

**完了基準**：Claude Desktop で「鹿児島県の今月公告された建設工事入札を10件」と聞いて表が返ってくる。

### Phase 1: Cloud Run公開（Day 6-10）

- Dockerfile multi-stage build
- Cloud Run scale-to-zero デプロイ（asia-northeast1）
- Cloud Run デプロイ後に公開URLを `server.json` と README に反映
- `.well-known/mcp-server.json` 配信
- Custom Connector として Claude/ChatGPT/Cursor から接続可
- `v0.3.0` リリース、npm publish (`jp-bids-mcp`)

**月額コスト**：Cloud Run scale-to-zero で **〜200円**（月10万リクエスト未満なら無料枠内）

### Phase 2: Prompts追加（Week 3-4）

3つのスラッシュコマンド：

- `/morning_bid_briefing` — 都道府県・業種を引数に、その日の新着サマリ
- `/competitor_radar` — 競合企業名から、その企業の落札傾向分析
- `/bid_due_alert` — 来週締切の自社向け入札一覧

各々 8-15行のテンプレートで実装可能。

### Phase 3: コミュニティ拡散（Week 5-8）

- modelcontextprotocol/ext-apps Community Servers に PR
- `punkpeye/awesome-mcp-servers` に追加依頼
- `mcpservers.org`、`glama.ai/mcp/servers` に登録
- Zenn / Qiita で「日本独自のMCPを作った」記事
- Anthropic Tokyo Discord で告知

### Phase 4以降（オプション、需要次第）

- **MCP Apps UI** — 入札一覧テーブル＋締切カレンダー (`ext-apps` 採用)
- **Elicitation Form** — 「業種を絞ってください」フォーム
- **新着Webhook** — Tasks primitive で日次新着通知
- **e-Gov 調達情報等公開機能 API 統合** — 別系統の調達データを統合

---

## 8. デプロイ — Cloud Run（最安構成）

### `Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
COPY src ./src
COPY server.ts ./
RUN npm ci && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY public ./public
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/server.js", "--http"]
```

### デプロイコマンド

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
  --allow-unauthenticated
```

**月額試算**：
- Cloud Run（scale-to-zero、月10万req以下）: **無料枠内**
- ドメイン（既存`sugukuru.dev`流用）: **0円**
- Cloudflare（DNS無料）: **0円**
- 合計: **0円〜200円/月**

---

## 9. OSS公開チェックリスト（Phase 1完了時）

- [ ] Apache-2.0 LICENSE
- [ ] README.md（英）と README.ja.md（日）に出典明記、規約URL
- [ ] CHANGELOG.md（Keep a Changelog 形式）
- [ ] CONTRIBUTING.md（issue templateとPR template）
- [ ] SECURITY.md（脆弱性報告先）
- [ ] `.github/workflows/ci.yml`（lint, test, build on PR）
- [ ] `.github/workflows/release.yml`（タグpushでnpm publish）
- [ ] テストカバレッジ70%以上
- [ ] `mcp-server.json` で公式 Server Card 提供
- [ ] modelcontextprotocol/ext-apps の Community Servers に PR
- [ ] Awesome MCP掲載依頼

---

## 10. 今すぐ始める（Cursor で Day 1）

```bash
mkdir jp-bids-mcp && cd jp-bids-mcp
git init
cursor .
```

Cursor Composer に投げるプロンプト：

```
このリポジトリは JP Bids MCP（官公需入札MCP）の初期化です。
docs/design.md に設計書がある。これに従い、Day 1 を実行してください：

1. .cursor/rules/ に 00-project.mdc, 01-mcp-rules.mdc, 02-data-license.mdc を作成
   （内容は設計書 §5 を参照）
2. AGENTS.md, README.md (英), README.ja.md (日), LICENSE (Apache-2.0), CHANGELOG.md
3. package.json (TypeScript ESM, Node 18+, biome lint, vitest)
4. tsconfig.json (target ES2022, moduleResolution bundler)
5. src/kkj-client.ts (設計書 §6.1 のコードをそのまま実装)
6. src/prefecture-codes.ts (§6.2)
7. src/xml-parser.ts は kkj-client.ts に統合済みなので不要
8. tests/kkj-client.test.ts でモックを使ったユニットテスト

ビルドが通ることまで確認して報告してください。
```

Day 2 のプロンプト：

```
src/tools/search-bids.ts を設計書 §6.3 のコード通り実装してください。
server.ts も §6.4 通りに実装。
最後に stdio で起動して、ローカルから kkj.go.jp の本番APIを叩き、
「Query=システム LG_Code=46 Count=5」で5件取得できることを確認してください。
```

---

## 11. SuguAgriField との関係

| 観点 | JP Bids MCP（本書） | SuguAgriField |
|---|---|---|
| 完成スピード | **5-10日** | 8-12週 |
| 実装難度 | 低（API1本ラップ） | 高（多層統合） |
| 利用者規模 | 大（全国数万社） | 中（農業派遣業界） |
| スグクル本業貢献 | 低（営業・自治体提案） | 高（中核業務） |
| OSS拡散性 | **極めて高** | 高 |
| 月額コスト | **〜200円** | 〜1,000円（Phase 6まで） |
| WAGRI 等有料データ | 不要 | Phase 7で必要 |

**戦略**：
- **JP Bids MCP を最初の作品として2週間で出す**
- これでスグクルが「日本のMCP実装をリードする企業」というブランドを獲得
- その勢いで SuguAgriField の v2.0 設計書に着手
- JP Bids MCP のメンテは月数時間で済むため、本業の妨げにならない
