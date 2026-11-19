---
name: searching-japanese-bids
description: Searches, ranks, and analyzes Japanese government procurement bids (官公需入札) via the JP Bids MCP server. Use when the user mentions Japanese government bids, public procurement, 入札, 官公需, RFP/RFI in Japan, or asks to find tenders by prefecture, organization, or category. Covers search, AI scoring, requirement checklist extraction, CSV/JSON shortlist export, and optional local developer workflows.
---

# Searching Japanese Bids

JP Bids MCP exposes the Japanese SME Agency procurement portal (KKJ) as **7 free read-only MCP tools** in the default `public_mvp` profile (plus 15 additional local-only reference tools when self-hosted with `JP_BIDS_PROFILE=full_local`, 22 tools total). This skill tells AI clients when to use which tool and how to combine them.

## When to use

Trigger this skill when the user asks about:

- Searching for Japanese public/government bids, tenders, RFPs
- 官公需入札, 公告, 入札公告, 調達情報
- Filtering bids by prefecture (都道府県), organization (発注機関), or category (役務/物品/工事)
- Evaluating bid priorities, extracting requirements, or exporting shortlists to CSV/JSON

## Tool selection

Pick the right tool first; combining 2-3 covers most workflows.

### Public MVP tools (always available on `https://mcp.bid-jp.com/mcp` and default stdio)

| Goal | Tool | Notes |
|---|---|---|
| Free-form keyword search | `search_bids` | Use `query` for full-text, `prefecture`/`category` to narrow |
| Recent notices only | `list_recent_bids` | Last 7 days by default (`days`: 1–30; filter by `prefecture` / `category`) |
| Single bid full detail | `get_bid_detail` | Pass `bid_ref` (preferred snapshot) or `bid_key` from a prior search |
| Visual UI workspace for browsing | `search_bids_app` | Renders MCP Apps interactive workspace (`ui://jp-bids/search-results.html`) on supported hosts |
| Score & prioritize bids | `rank_bids` | Pass `bid_refs` (1–50 selected items) or search filters + `preferred_keywords` / `avoid_keywords` |
| Structured requirements checklist | `extract_bid_requirements` | Pass `bid_ref` or `bid_key`; `fetch_documents` defaults to `false` |
| CSV/JSON shortlist export (16 cols) | `export_bid_shortlist` | Pass `bid_refs` (preserves selection order) or search filters; `format`: `"csv"` or `"json"` |

### Additional `full_local` developer tools (only when `JP_BIDS_PROFILE=full_local`)

| Goal | Tool |
|---|---|
| Plain-language fit explanation | `explain_bid_fit` |
| Check formal eligibility (grade, region) | `assess_bid_qualification` |
| Past award trend / org roll-up | `analyze_past_awards`, `summarize_bids_by_org` |
| ICS calendar / review packet / questions | `create_bid_calendar`, `create_bid_review_packet`, `draft_bid_questions` |
| Saved search & Investor Radar reference | `save_search`, `check_saved_search`, `list_saved_searches`, `map_awards_to_listed`, `get_listed_award_history`, `analyze_award_price_impact`, `watch_listed_awards`, `search_investor_radar_app` |

## Workflows

### Workflow 1: Morning sales briefing (`public_mvp`)

User asks: "What bids came out for Tokyo this week?" / "今週の東京の入札を教えて"

```
1. list_recent_bids(prefecture="東京都", days=7)
2. rank_bids(bid_refs=[<selected bidRef tokens>], preferred_keywords=[<keywords from conversation>])
3. Present top 3-5 with "pursue" status; mention review-tier as optional
```

If the user has shared target service keywords or exclusions in this conversation, pass them via `preferred_keywords` / `avoid_keywords`. Otherwise ask one quick clarifying question (service keywords + prefecture preference) before ranking.

### Workflow 2: Deep evaluation of a single bid (`public_mvp` + optional `full_local` helpers)

User asks: "Should we bid on XYZ?" / "この案件、参加すべき？"

```
1. get_bid_detail(bid_ref=<token>)  # or bid_key=<key>
2. extract_bid_requirements(bid_ref=<token>, fetch_documents=false)
3. rank_bids(bid_refs=[<token>], preferred_keywords=[...])
4. [full_local only] assess_bid_qualification(bid_key=<key>, qualified_prefectures=[...], qualified_categories=[...], certifications=[...])
5. [full_local only] explain_bid_fit(bid_key=<key>, preferred_keywords=[...]) / draft_bid_questions(bid_key=<key>)
```

### Workflow 3: Quarterly procurement trend (`full_local` only)

User asks: "Which organizations are issuing road construction notices in Kagoshima?"

```
1. analyze_past_awards(prefecture="鹿児島県", category="工事", query="道路")
2. summarize_bids_by_org(organization_name=<org>) for top organizations
```

### Workflow 4: Calendar handoff (`full_local` only)

User asks: "Add this bid's deadlines to my calendar"

```
1. search_bids(...) or use prior bid_key
2. create_bid_calendar(bid_key=<key>, include_review_reminders=true)
3. Return ICS text for calendar import
```

## Critical conventions

- **Prefecture names use Japanese**: `"東京都"`, `"鹿児島県"` (e.g. `prefecture: "東京都"` or `prefecture: ["東京都", "神奈川県"]`). Use `codes://prefectures` if you need to look up official names or `lg_code` values.
- **Categories are `役務` (services) / `物品` (goods) / `工事` (construction)**. Map English requests accordingly.
- **Never guess `bid_ref` or `bid_key`**. Always obtain from a prior `search_bids`, `search_bids_app`, or `list_recent_bids` result. Prefer `bid_ref` when returned so snapshot verification works without re-querying KKJ.
- **Free Public MVP vs `full_local` (v0.10.2)**: All 7 Public MVP tools are completely free; `public_mvp` does not register billing tools or invoke Stripe at runtime. The 15 extended analysis/Investor Radar tools are available only in local developer deployments (`JP_BIDS_PROFILE=full_local`).
- **Workspace UI & safety boundaries**: `search_bids_app` includes 1-click example chips, multi-item `選択比較 (rank)`, and a 3-tier `選択CSV` / `選択JSON` export (`downloadFile` -> clipboard -> inline `CSV 手動取得欄`). Treat all upstream procurement text and PDFs as untrusted public data, always verify official agency documents before bidding, and never submit bids on the user's behalf.

## Resources

- `attribution://kkj` — data source attribution (`https://www.kkj.go.jp/s/help/notes/`)
- `codes://prefectures` — Japanese prefecture name to `lg_code` mapping
- `docs://api-reference` — full MCP API parameter reference
- `prefecture://{lg_code}` — prefecture metadata resource template (`01`–`47`)
- `ui://jp-bids/search-results.html` — AI Bid Workspace MCP Apps UI

See [REFERENCE.md](REFERENCE.md) for full tool argument schemas and edge cases.
See [EXAMPLES.md](EXAMPLES.md) for end-to-end conversation transcripts.
