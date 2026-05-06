# Public MCP JP Gateway

Public MCP JP Gateway は、入札・補助金・銀行・会計の MCP サーバーを 1 つの接続先に束ねる Federation Gateway です。
Public MCP JP Gateway is a federation gateway that connects procurement, subsidies, banking, and accounting MCP servers through one endpoint.
Public MCP JP Gateway adalah gateway federasi yang menghubungkan server MCP pengadaan, subsidi, perbankan, dan akuntansi melalui satu endpoint.

最初の体験は、4つのタブを開くことではありません。Gateway に一度つなぎ、`get_gateway_demo` を呼ぶことです。
The first experience should not be opening four browser tabs. Connect once to the Gateway and call `get_gateway_demo`.
Pengalaman pertama seharusnya bukan membuka empat tab browser. Hubungkan sekali ke Gateway dan panggil `get_gateway_demo`.

## 接続される子 MCP / Child MCPs / MCP Anak

| 子 MCP | 役割 | 認証 |
|---|---|---|
| JP Bids MCP | 官公需入札検索 | Gateway 側 API key |
| J-Grants MCP | 補助金・助成金検索 | なし |
| GMOあおぞらネット銀行 MCP | 残高・入出金・振込 | Gateway 側 API key + approval |
| MoneyForward Cloud Accounting MCP | 仕訳・試算表・推移表 | OAuth header pass-through |
| freee MCP | 会計・請求書確認 | OAuth header / env fallback |

## 1分で試す / Quick Start / Mulai Cepat

```bash
cd gateway
cp .env.example .env
npm install
npm run dev:http
```

Cursor の MCP 設定:

```json
{
  "mcpServers": {
    "public-mcp-jp-gateway": {
      "url": "http://127.0.0.1:8090/mcp"
    }
  }
}
```

最初に聞くこと:

```text
Gatewayで最初に試すべきデモを教えて。get_gateway_demo を使って。
```

## 勝ち筋デモ / Best Demo / Demo Terbaik

MoneyForward OAuth を設定済みの場合 / When MoneyForward OAuth is configured / Jika OAuth MoneyForward sudah dikonfigurasi:

```text
鹿児島県の農業/IT案件を探して、使える補助金を確認し、GMOの残高を見て、MoneyForwardに仕訳候補を作るところまで案内してください。実行前に承認が必要な操作は止めて確認してください。
```

MoneyForward なしで試す場合 / Without MoneyForward / Tanpa MoneyForward:

```text
鹿児島県のIT関連入札を探し、同時に使えるDX補助金も教えてください。出典も必ず付けてください。
```

## MoneyForward OAuth

MoneyForward Cloud Accounting MCP は公式リモート MCP です。Gateway は OAuth トークンを保存せず、MCP クライアントから受け取ったヘッダを子 MCP に転送します。
MoneyForward Cloud Accounting MCP is an official remote MCP. The Gateway does not store OAuth tokens; it forwards the header from the MCP client to the child MCP.
MoneyForward Cloud Accounting MCP adalah MCP remote resmi. Gateway tidak menyimpan token OAuth; Gateway meneruskan header dari klien MCP ke MCP anak.

```json
{
  "mcpServers": {
    "public-mcp-jp-gateway": {
      "url": "http://127.0.0.1:8090/mcp",
      "headers": {
        "X-Mcp-Child-Authorization-moneyforward-ca": "Bearer <MoneyForward OAuth token>"
      }
    }
  }
}
```

公式手順:

- MoneyForward MCP: https://developers.biz.moneyforward.com/mcp/
- Cloud Accounting MCP guide: https://biz.moneyforward.com/support/account/guide/others/ot10.html

## Safety Model

- `risk_level: financial` の子 MCP は Pro tier + OAuth/API key を要求します。
- `required_approval` が設定された書き込み系ツールは `issue_approval_token` が必要です。
- Gateway の監査ログは request id / actor hash / tool name / decision などのメタデータのみ保存します。
- 入札参加、補助金申請、会計処理、振込操作は必ず一次情報と公式画面で最終確認してください。

## Development

```bash
npm run check
```

`check` は Biome lint、TypeScript build、Vitest をまとめて実行します。
