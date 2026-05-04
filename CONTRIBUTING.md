# Contributing to JP Bids MCP

JP Bids MCPへのコントリビューションを歓迎します。  
Contributions to JP Bids MCP are welcome.  
Kontribusi untuk JP Bids MCP disambut baik.

---

## Quick Start / クイックスタート / Mulai Cepat

```bash
git clone https://github.com/sugukurukabe/koko-call-mcp.git
cd koko-call-mcp
npm install
npm run build
npm test
```

---

## Good First Issues / 最初のIssue / Issue Pertama

以下は難易度が低く、コントリビューション入門に最適なIssueです。  
These are low-complexity issues ideal for first-time contributors.  
Berikut adalah issue dengan kompleksitas rendah yang ideal untuk kontributor pertama kali.

1. **[good first issue] docs: 都道府県コード一覧のREADME追記**  
   `codes://prefectures` リソースの内容をREADMEに表形式で掲載する。  
   テスト不要。ドキュメントのみ。

2. **[good first issue] test: `list-recent-bids` の境界値テスト追加**  
   `days=1` と `days=30` の両端値でレスポンス型を検証するテストを追加。  
   `tests/tool-execution.test.ts` に2件追加するだけ。

3. **[good first issue] feat: `search_bids` に `sort` パラメータ追加**  
   `sort: "issued_date" | "due_date"` を追加してKKJ APIの `Sort` パラメータに渡す。  
   `src/tools/search-bids.ts` と対応する型定義を変更。

4. **[good first issue] docs: 英語版 CONTRIBUTING.md の充実**  
   このファイルの英語セクションをより詳細に（コーディング規約・コミットメッセージ規則の英語説明）。

5. **[good first issue] chore: `src/server.ts` のバージョン文字列を `package.json` から動的に読み込む**  
   現在ハードコードされている `const version = "0.7.x"` を  
   `createRequire` で `package.json` から取得するように変更。

---

## Adding a New Tool / 新ツールの追加 / Menambahkan Tool Baru

### 1. ファイルを作成 / Create file / Buat file

```
src/tools/your-tool-name.ts
```

### 2. テンプレート / Template

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient } from "../api/kkj-client.js";
import { toolError } from "../lib/tool-result.js";

const YourToolOutputSchema = z.object({
  // ...
});

const inputSchema = {
  param: z.string().describe("パラメータの説明。Description. Deskripsi."),
};

export function registerYourTool(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "your_tool_name",
    {
      title: "ツールのタイトル",
      description:
        "ツールの説明（日本語）。Tool description (English). Deskripsi tool (Bahasa Indonesia).",
      inputSchema,
      outputSchema: YourToolOutputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        // implementation
        const result = { /* ... */ };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error) {
        return toolError(error, "エラーメッセージ。Error message.");
      }
    },
  );
}
```

### 3. 登録 / Register / Daftarkan

`src/tools/register-tools.ts` に追加:

```typescript
import { registerYourTool } from "./your-tool-name.js";
// ...
registerYourTool(server, client);
```

### 4. テスト / Test / Uji

`tests/tool-execution.test.ts` にテストを追加。

### 5. チェックリスト / Checklist

- [ ] `title` あり
- [ ] `description` が日本語・英語・インドネシア語
- [ ] 全パラメータに `.describe()`
- [ ] `outputSchema` あり
- [ ] `annotations` あり
- [ ] テスト追加
- [ ] `register-tools.ts` に登録

---

## Code Style / コードスタイル

- TypeScript / no `any`
- `biome` で自動フォーマット: `npm run lint`
- 変数名・関数名は英語 camelCase
- ファイル名は kebab-case
- コメントは日本語 → English → Bahasa Indonesia の順

---

## Commit Messages / コミットメッセージ

```
feat: 新機能
fix: バグ修正
docs: ドキュメント
test: テスト
refactor: リファクタリング
chore: その他
```

---

## Questions / 質問 / Pertanyaan

GitHub Discussions: https://github.com/sugukurukabe/koko-call-mcp/discussions
