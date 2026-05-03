---
name: searching-japanese-bids
description: Searches, ranks, and analyzes Japanese government procurement bids (官公需入札) via the JP Bids MCP server. Use when the user mentions Japanese government bids, public procurement, 入札, 官公需, RFP/RFI in Japan, or asks to find tenders by prefecture, organization, or category. Covers search, AI scoring, qualification assessment, PDF requirement extraction, calendar export, and sales briefing workflows.
---

# Searching Japanese Bids

JP Bids MCP exposes the Japanese SME Agency procurement portal (KKJ) as 14 MCP tools. This skill tells Claude when to use which tool and how to combine them for common workflows.

## When to use

Trigger this skill when the user asks about:

- Searching for Japanese public/government bids, tenders, RFPs
- 官公需入札, 公告, 入札公告, 落札, 調達情報
- Filtering bids by prefecture (都道府県), organization (発注機関), or category (役務/物品/工事)
- Evaluating bid fit, qualifications, or extracting requirements from bid documents
- Generating bid calendars, review packets, or competitor radars

## Tool selection

Pick the right tool first; combining 2-3 covers most workflows.

### Discovery (start here)

| Goal | Tool | Notes |
|---|---|---|
| Free-form keyword search | `search_bids` | Use `query` for full-text, `prefecture`/`category` to narrow |
| Recent notices only | `list_recent_bids` | Last 7 days by default |
| Single bid full detail | `get_bid_detail` | Needs `bid_key` from a prior search |
| Visual UI panel for browsing | `search_bids_app` | Renders MCP Apps interactive table on supported clients |

### Decision support

| Goal | Tool |
|---|---|
| Score bids against company profile | `rank_bids` |
| Plain-language fit explanation | `explain_bid_fit` |
| Check eligibility (grade, region, license) | `assess_bid_qualification` |
| Pull structured requirements from bid PDF/HTML | `extract_bid_requirements` |
| Past award trend by organization | `analyze_past_awards` |
| Roll-up by procuring organization | `summarize_bids_by_org` |

### Output / handoff

| Goal | Tool |
|---|---|
| CSV/JSON export for spreadsheets | `export_bid_shortlist` |
| ICS file for calendar deadlines | `create_bid_calendar` |
| Internal review document | `create_bid_review_packet` |
| Draft clarification questions to procuring org | `draft_bid_questions` |

## Workflows

### Workflow 1: Morning sales briefing

User asks: "What bids came out for Tokyo this week?" / "今週の東京の入札を教えて"

```
1. list_recent_bids(prefecture="東京都", days=7)
2. rank_bids(bids=<results>, profile=<company info from conversation>)
3. Present top 3-5 with "pursue" status; mention review-tier as optional
```

If the user has shared a company profile in this conversation, use it for `rank_bids`. Otherwise ask one quick clarifying question (industry + prefecture preference + government contractor grade) before ranking.

### Workflow 2: Deep evaluation of a single bid

User asks: "Should we bid on XYZ?" / "この案件、参加すべき？"

```
1. get_bid_detail(bid_key=<key>)
2. assess_bid_qualification(bid_key=<key>, company_profile=<profile>)
3. extract_bid_requirements(bid_key=<key>)  # if PDF attached
4. explain_bid_fit(bid_key=<key>, company_profile=<profile>)
5. (Optional) draft_bid_questions(bid_key=<key>) for unclear requirements
```

### Workflow 3: Quarterly competitive intelligence

User asks: "Who's winning road construction bids in Kagoshima?"

```
1. analyze_past_awards(prefecture="鹿児島県", category="工事", keyword="道路")
2. summarize_bids_by_org(...) for top 3 winning organizations
```

### Workflow 4: Calendar handoff

User asks: "Add bid deadlines to my calendar"

```
1. search_bids(...) or use prior shortlist
2. create_bid_calendar(bid_keys=[...])
3. Return ICS file for download
```

## Critical conventions

- **Prefecture names use Japanese**: `"東京都"`, `"鹿児島県"`. Pass through user input as-is; the server accepts both display names and `lg_code`.
- **Categories are 役務 (services) / 物品 (goods) / 工事 (construction)**. Map English requests accordingly.
- **Never guess `bid_key`**. Always obtain from a prior search or `list_recent_bids` result.
- **Free tier vs Pro tier**: All 14 tools are free during the beta period (until end of June 2026). After that, Pro tools require an API key. Do not block users; the server returns clear errors when quota is exceeded.

## Resources

- `attribution://kkj` — data source attribution (cite when displaying results publicly)
- `codes://prefectures` — prefecture name to `lg_code` mapping
- `docs://api-reference` — full MCP API surface
- `bid://{bid_key}` — resource template for individual bids

See [REFERENCE.md](REFERENCE.md) for full tool argument schemas and edge cases.
See [EXAMPLES.md](EXAMPLES.md) for end-to-end conversation transcripts.
