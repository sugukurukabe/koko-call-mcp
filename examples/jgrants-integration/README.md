# JP Bids MCP × J-Grants MCP — Integration Guide

> **JP Bids MCP** and **J-Grants MCP** are independent servers operated by separate organizations.
> JP Bids MCP is operated by Sugukuru Inc. and uses the SME Agency KKJ public API.
> J-Grants MCP is provided by the Digital Agency of Japan and uses the J-Grants public API.
> Always verify results against official procurement and grant documents before making decisions.

Two complementary MCP servers now let an LLM host handle both sides of Japan's public-sector funding landscape in a single conversation:

| Server | Data source | Operator | What it answers |
|---|---|---|---|
| [JP Bids MCP](https://github.com/sugukurukabe/koko-call-mcp) | KKJ (中小企業庁) | Sugukuru Inc. | "Which government contracts should we bid on?" |
| [J-Grants MCP](https://github.com/digital-go-jp/jgrants-mcp-server) | J-Grants (デジタル庁) | Digital Agency | "Which subsidies can fund the work?" |

Data licenses differ: KKJ data is subject to the [KKJ API Terms](https://kkj.go.jp), and J-Grants data is subject to the [J-Grants Open API Terms](https://www.jgrants-portal.go.jp/open-api). Read both before building any downstream product.

---

## Setup

### Prerequisites

- Python 3.11+ (for J-Grants MCP, which runs locally)
- Node.js 20+ (for JP Bids MCP stdio option)
- An MCP-compatible client: Claude Desktop, Cursor, VS Code with MCP extension, etc.

### 1. Clone and start the J-Grants MCP server

```bash
git clone https://github.com/digital-go-jp/jgrants-mcp-server.git
cd jgrants-mcp-server
pip install -e .
python -m jgrants_mcp_server.core
# Listens on http://127.0.0.1:8000/mcp (Streamable HTTP)
```

### 2. Connect JP Bids MCP (remote, no install required)

JP Bids MCP is hosted at `https://mcp.bid-jp.com/mcp` and requires no local setup. Use `npx mcp-remote` as a stdio bridge if your client does not support Streamable HTTP natively:

```bash
npx --yes mcp-remote https://mcp.bid-jp.com/mcp
```

### 3. Register both servers in your client

See `claude_desktop_config.json` and `cursor.mcp.json` in this directory for ready-to-use configuration files.

---

## Workflows

### Workflow 1 — Search bids and grants simultaneously

**Goal**: Find public-works contracts in Kagoshima and confirm whether IT subsidies are available.

**Tools used**: `search_bids` (JP Bids) + `search_subsidies` (J-Grants)

**Prompt example**:

```
鹿児島県のITシステム調達案件を探して、同時に中小企業向けのDX補助金も調べてください。
スコアが高い入札案件と、申請中の補助金の一覧を合わせて教えてください。
```

Expected conversation flow:
1. LLM calls `search_bids` with `prefecture="鹿児島県"`, `category="役務"`, `query="システム"`
2. LLM calls `search_subsidies` with `keyword="DX"`, `target_number_of_employees="21-50人"`
3. LLM synthesizes both results and presents a combined funding opportunity summary

---

### Workflow 2 — Use grants to fund a bid

**Goal**: Identify a grant that can subsidize the cost of preparing or executing a government contract.

**Tools used**: `search_subsidies` → `rank_bids` → `create_bid_review_packet`

**Prompt example**:

```
IT補助金で原資を確保した上で、AIシステム開発の入札案件を探してください。
補助金の締切と入札の締切が重ならない組み合わせを提案してください。
```

Expected flow:
1. `search_subsidies keyword="AI" acceptance=1` — find currently-open grants
2. `search_bids query="AI システム開発"` + `rank_bids` — rank bids by profile fit
3. `create_bid_review_packet` — produce internal review memo that includes the matched grant as a financing option

---

### Workflow 3 — Cross-reference past awards with grant usage

**Goal**: Determine which past award winners in a category also received grants, to benchmark realistic all-in budgets.

**Tools used**: `analyze_past_awards` (JP Bids) + `get_subsidy_overview` (J-Grants)

**Prompt example**:

```
清掃業務の過去落札実績を分析して、同カテゴリで利用可能な補助金との組み合わせを示してください。
```

Expected flow:
1. `analyze_past_awards category="清掃"` — distribution of award amounts
2. `get_subsidy_overview keyword="清掃"` — count of available grants by deadline range
3. LLM presents a funding landscape overview for the cleaning-services category

---

## Tool Reference

### JP Bids MCP tools used in these workflows

| Tool | Description | Tier |
|---|---|---|
| `search_bids` | Keyword/region/category search of KKJ notices | Free |
| `rank_bids` | Score bids by your company profile | Free |
| `analyze_past_awards` | Historical award analysis | Pro |
| `create_bid_review_packet` | Internal review memo generation | Pro |

### J-Grants MCP tools used in these workflows

| Tool | Description |
|---|---|
| `search_subsidies` | Search subsidies by keyword, industry, region |
| `get_subsidy_detail` | Full detail including attachments |
| `get_subsidy_overview` | Statistical overview by deadline and amount |

Source: [digital-go-jp/jgrants-mcp-server](https://github.com/digital-go-jp/jgrants-mcp-server)

---

## Notes

- Results from both servers are reference information. Always verify against the original government procurement and grant documents.
- J-Grants MCP runs locally; JP Bids MCP runs remotely. The two servers do not share data or sessions.
- Data coverage: KKJ covers ~9,000 contracting authorities; J-Grants covers national and municipal grants on the J-Grants portal. Neither guarantees exhaustive coverage of all government funding.
- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — the protocol both servers implement.
