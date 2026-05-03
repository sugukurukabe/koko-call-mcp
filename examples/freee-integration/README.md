# JP Bids MCP × freee MCP — Procurement Accounting Integration

> **JP Bids MCP** and **freee MCP** are independent servers operated by separate organizations.
> JP Bids MCP is operated by Sugukuru Inc. and uses the SME Agency KKJ public API.
> freee MCP is provided by freee K.K. and uses the freee Accounting / HR / Invoice APIs.
> Always verify against official documents and consult with a certified accountant before making financial decisions.

Two MCP servers let an LLM handle both **bid discovery** and **accounting/invoicing** in a single conversation:

| Server | Data source | Operator | What it answers |
|---|---|---|---|
| [JP Bids MCP](https://github.com/sugukurukabe/koko-call-mcp) | KKJ (中小企業庁) | Sugukuru Inc. | "Which government contracts should we bid on?" |
| [freee MCP](https://www.npmjs.com/package/freee-mcp) | freee Accounting/HR/Invoice | freee K.K. | "What's our financial position? Can we handle this contract?" |

---

## Setup

### Prerequisites

- freee account with API access
- An MCP-compatible client: Claude Desktop, Cursor, or VS Code

### 1. Configure freee MCP (Remote)

freee MCP provides a remote endpoint. In Claude Desktop, add a custom connector:

- Name: `freee`
- URL: `https://mcp.freee.co.jp/mcp`

### 2. Connect JP Bids MCP (Remote)

JP Bids MCP is hosted at `https://mcp.bid-jp.com/mcp`.

### 3. Client configuration

See `claude_desktop_config.json` and `cursor.mcp.json` in this directory.

---

## Workflows

### Workflow 1 — Financial readiness check before bidding

**Goal**: Before pursuing a bid, verify the company's financial capacity and outstanding receivables.

**Tools used**: `search_bids` + `rank_bids` (JP Bids) → `freee_api_get` (freee)

**Prompt**:

```
鹿児島県のITシステム案件を探して、スコアの高い案件について、
freeeで当社の直近の売掛金残高と預金残高を確認して、
入札に必要な資金的余力があるか判断してください。
```

Expected flow:
1. `search_bids(query="システム", prefecture="鹿児島県")` → find candidates
2. `rank_bids(bids=[...], company_profile={...})` → score and sort
3. `freee_api_get(service="accounting", path="/api/1/reports/trial_bs")` → get balance sheet
4. LLM evaluates: current assets vs. estimated contract size

---

### Workflow 2 — Auto-create deal entry after winning a bid

**Goal**: After winning a government contract, create an accounting entry in freee.

**Tools used**: `get_bid_detail` (JP Bids) → `freee_api_post` (freee)

**Prompt**:

```
案件「2026-KKJ-12345」の詳細を取得して、
落札額と発注機関名をもとに freee に売上取引を登録してください。
勘定科目は「売上高」、取引先は発注機関名で新規作成してください。
```

Expected flow:
1. `get_bid_detail(bid_key="2026-KKJ-12345")` → get contract details
2. `freee_api_post(service="accounting", path="/api/1/deals", body={...})` → create deal
3. LLM confirms the entry with amount, partner, and account item

---

### Workflow 3 — Invoice generation from bid data

**Goal**: Generate an invoice for a completed government contract using bid metadata.

**Tools used**: `get_bid_detail` (JP Bids) → `freee_api_post` (freee Invoice)

**Prompt**:

```
落札案件「2026-KKJ-12345」の情報をもとに、
freee請求書で請求書を作成してください。
品名は案件タイトル、金額は落札額、支払期限は納品日から30日後としてください。
```

Expected flow:
1. `get_bid_detail(bid_key="2026-KKJ-12345")` → contract details
2. `freee_api_post(service="invoice", path="/invoices", body={...})` → create invoice

---

### Workflow 4 — Monthly bid expense tracking

**Goal**: Track bid preparation expenses (travel, printing, consultants) against actual bids.

**Tools used**: `analyze_past_awards` (JP Bids) + `freee_api_get` (freee)

**Prompt**:

```
先月の入札関連経費（旅費交通費、印刷費、外注費）をfreeeから集計して、
同期間の落札実績と合わせて、入札の費用対効果を分析してください。
```

Expected flow:
1. `freee_api_get(service="accounting", path="/api/1/deals", params={...})` → bid-related expenses
2. `analyze_past_awards(category="...", months=1)` → recent awards
3. LLM calculates: total bid expenses vs. total contract value won

---

## Tool Reference

### JP Bids MCP tools used in these workflows

| Tool | Description | Tier |
|---|---|---|
| `search_bids` | Keyword/region/category search | Free |
| `rank_bids` | Score bids by company profile | Free |
| `get_bid_detail` | Full bid details | Free |
| `analyze_past_awards` | Historical award analysis | Pro |

### freee MCP tools used in these workflows

| Tool | Description |
|---|---|
| `freee_api_get` | GET request to freee API (trial balance, deals, etc.) |
| `freee_api_post` | POST request to freee API (create deals, invoices, etc.) |
| `freee_api_list_paths` | List available API paths |

Source: [freee-mcp (npm)](https://www.npmjs.com/package/freee-mcp)

---

## Notes

- JP Bids MCP is read-only; it never writes to freee or any other system.
- freee MCP requires OAuth authentication. The first connection will open a browser for login.
- Financial data from freee is your company's private data. Treat LLM outputs containing financial information with appropriate confidentiality.
- This integration is informational. Consult a certified tax accountant (税理士) before making accounting entries based on bid data.
