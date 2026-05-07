// Gateway MCP Resources — 静的・動的リソースの公開
// Gateway MCP Resources — Static and dynamic resource publication
// Sumber Daya MCP Gateway — Publikasi sumber daya statis dan dinamis

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadRegistry } from "../registry/loader.js";

export function registerResources(server: McpServer): void {
  server.registerResource(
    "registry_summary",
    "gateway://registry/summary",
    {
      title: "子MCPレジストリ概要",
      description:
        "接続中の子MCPサーバー一覧とメタデータの概要。" +
        "Summary of connected child MCP servers and metadata. " +
        "Ringkasan server MCP anak yang terhubung dan metadata.",
      mimeType: "application/json",
    },
    async () => {
      const registry = loadRegistry();
      const summary = registry.servers.map((s) => ({
        id: s.id,
        display_name: s.display_name,
        display_name_en: s.display_name_en,
        risk_level: s.risk_level,
        auth_type: s.auth_type,
        tool_count: s.tool_allowlist.length > 0 ? s.tool_allowlist.length : "dynamic",
        modes: Object.keys(s.tool_modes ?? {}).filter((m) => (s.tool_modes?.[m]?.length ?? 0) > 0),
        attribution: s.attribution,
      }));
      return {
        contents: [
          {
            uri: "gateway://registry/summary",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                version: registry.version,
                server_count: registry.servers.length,
                servers: summary,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerResource(
    "quickstart",
    "gateway://quickstart",
    {
      title: "初めてのGateway — 30秒で最高の体験を",
      description:
        "Public MCP JP Gateway に初めて接続した方へ。30秒で価値を理解し、すぐに感動できる3つのデモを試せます。" +
        "First-time guide for Public MCP JP Gateway. Understand the value in 30 seconds and try three impressive demos immediately. " +
        "Panduan pertama kali untuk Public MCP JP Gateway. Pahami nilainya dalam 30 detik dan coba tiga demo yang mengesankan.",
      mimeType: "text/markdown",
    },
    async () => {
      const content = `# ようこそ、Public MCP JP Gateway へ

**30秒でわかる、このGatewayの価値**

日本の公的データと業務SaaSを**1つの接続で全部使える** Federation Gateway です。

- 入札（JP Bids）
- 補助金（J-Grants）
- 農業・自治体統計（AgriOps）
- 不動産投資分析（Real Estate Intel）← **新登場・特に推奨**
- 法人番号（Houjin Bangou）
- クラウド会計（MoneyForward / freee）

これらを**AIが賢く振り分けて**、1回の会話で横断検索・分析できます。

---

## 最初に試してほしい「一撃で感動する」3つのデモ

### 1. 不動産投資分析（一番おすすめ・新機能）
**「東京都新宿区の地価トレンドと災害リスクを分析して、投資判断の材料をまとめて」**

またはもっと具体的に：
\`\`\`
real_estate_assessment(area: "東京都新宿区", purpose: "investment")
\`\`\`

**得られるもの**: 地価推移・災害リスクスコア・人流データ・投資適性まで一気に。

### 2. 入札＋補助金の一気通貫調査
**「鹿児島県のIT関連入札を探して、同時に使えるDX補助金も教えて。出典も必ず付けて」**

\`\`\`
search_public_opportunities(keyword: "IT システム", prefecture: "鹿児島県")
\`\`\`

### 3. 資金繰り＋出店判断の複合分析
**「今月の資金繰りを確認して、可能なら新宿区に出店した場合の収支シミュレーションも」**

\`\`\`
financial_health_check(focus: "full_review")
\`\`\`
その後 \`real_estate_assessment\` で出店分析へ。

---

## あなたに合った次のアクション

- **不動産・店舗出店を考えている方** → \`real_estate_assessment\` をまず呼ぶ
- **補助金・入札を日常的に探している方** → \`investigate_opportunity\` プロンプト
- **経理・資金繰りを最優先したい方** → \`financial_health_check\`
- **とにかく何ができるか知りたい方** → \`get_gateway_demo(scenario: "quick_start")\`

---

## すぐに使えるリソース

- \`gateway://samples/queries\` — コピペして試せるサンプル集
- \`gateway://modes/reference\` — 各モードで使えるツール一覧
- \`gateway://attribution/all\` — 全子MCPの出典情報（必ず引用してください）

---

**このGatewayは「複数のMCPを繋ぐため」ではなく、「あなたの業務を1つの会話で完結させるため」に作られています。**

まずは上の3つのデモのどれか1つを試してみてください。  
きっと「これまでになかった体験」になるはずです。

---

*出典は各ツールの \`attribution\` フィールドから必ず明記してください。*
`;

      return {
        contents: [
          {
            uri: "gateway://quickstart",
            mimeType: "text/markdown",
            text: content,
          },
        ],
      };
    },
  );

  server.registerResource(
    "modes_reference",
    "gateway://modes/reference",
    {
      title: "動的モード一覧",
      description:
        "registry.json で定義されている全モードとモード別ツール配置の参照。" +
        "Reference of all dynamic modes and their tool assignments defined in registry.json. " +
        "Referensi semua mode dinamis dan penugasan alatnya yang didefinisikan di registry.json.",
      mimeType: "application/json",
    },
    async () => {
      const registry = loadRegistry();
      const modeMap: Record<string, Array<{ server: string; tools: string[] }>> = {};
      for (const s of registry.servers) {
        for (const [mode, tools] of Object.entries(s.tool_modes ?? {})) {
          if (tools.length === 0) continue;
          if (!modeMap[mode]) modeMap[mode] = [];
          modeMap[mode].push({ server: s.id, tools });
        }
      }
      return {
        contents: [
          {
            uri: "gateway://modes/reference",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                description:
                  "Dynamic modes are defined per-server in registry.json. " +
                  "full_orchestration is the reserved mode that shows all tools.",
                modes: modeMap,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerResource(
    "sample_queries",
    "gateway://samples/queries",
    {
      title: "サンプルクエリ集",
      description:
        "Gateway ですぐに試せるサンプルクエリ・会話例。" +
        "Sample queries and conversation examples ready to try on this Gateway. " +
        "Contoh kueri dan percakapan yang siap dicoba di Gateway ini.",
      mimeType: "application/json",
    },
    async () => {
      const samples = [
        {
          category: "入札調査 / Bid Search",
          queries: [
            "東京都のDX関連入札を探して、使える補助金も一緒に教えて。",
            "IT system procurement bids in Osaka, with related subsidies.",
          ],
        },
        {
          category: "資金繰り / Financial Check",
          queries: [
            "MoneyForwardの試算表を確認して、今月の資金繰りに問題がないか教えて。",
            "Check MoneyForward trial balance and summarize cash flow status.",
          ],
        },
        {
          category: "補助金探索 / Subsidy Search",
          queries: [
            "中小企業が使えるDX推進の補助金を探して。",
            "Find subsidies for small businesses related to digital transformation.",
          ],
        },
        {
          category: "一気通貫 / End-to-End",
          queries: [
            "IT入札を探して、補助金を確認して、会計データを見て、受注判断の材料をまとめて。",
            "Search IT bids, check subsidies, verify accounting data, and summarize decision factors.",
          ],
        },
        {
          category: "不動産分析 / Real Estate Analysis",
          queries: [
            "東京都新宿区の地価トレンドと災害リスクを分析して、投資判断の材料をまとめて。",
            "Compare land prices and investment scores across Tokyo, Osaka, and Fukuoka.",
          ],
        },
        {
          category: "横断比較 / Cross-MCP",
          queries: [
            "接続されている全子MCPの一覧と、それぞれで何ができるか教えて。",
            "List all connected child MCPs and explain what each one can do.",
          ],
        },
      ];
      return {
        contents: [
          {
            uri: "gateway://samples/queries",
            mimeType: "application/json",
            text: JSON.stringify({ sample_count: samples.length, samples }, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "attribution_all",
    "gateway://attribution/all",
    {
      title: "出典一覧",
      description:
        "全子MCPの出典・ライセンス情報をまとめて返す。" +
        "Aggregated attribution and license information for all child MCPs. " +
        "Informasi atribusi dan lisensi gabungan untuk semua MCP anak.",
      mimeType: "application/json",
    },
    async () => {
      const registry = loadRegistry();
      const attributions = registry.servers.map((s) => ({
        server_id: s.id,
        display_name: s.display_name,
        ...s.attribution,
      }));
      return {
        contents: [
          {
            uri: "gateway://attribution/all",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                note: "Always cite the attribution.source field when presenting data from each child MCP.",
                attributions,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
