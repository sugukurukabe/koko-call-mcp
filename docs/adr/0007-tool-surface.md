# ADR-0007: Tool Surface

## Status

Accepted; expanded for v0.4.0 (AI Bid Radar).

## Decision

### v0.1 - v0.3 (initial surface)

Expose four model-visible tools: `search_bids`, `list_recent_bids`, `get_bid_detail`, and `summarize_bids_by_org`.

### v0.4 (AI Bid Radar expansion)

Add nine tools that turn search results into actionable internal review:

- `rank_bids` — score and prioritize candidates
- `explain_bid_fit` — per-bid pursue / review / skip rationale
- `assess_bid_qualification` — match a bid against a company profile (regions, categories, certifications, service keywords)
- `extract_bid_requirements` — safe pre-Document AI requirement triage
- `export_bid_shortlist` — Sheets/Excel-friendly CSV with score, reasons, risks
- `create_bid_calendar` — ICS for submission/opening/internal-review dates
- `create_bid_review_packet` — Markdown internal review memo
- `draft_bid_questions` — clarification question draft for the buyer
- `analyze_past_awards` — competitor radar over past notices

Add one MCP Apps view tool: `search_bids_app` (UI overlay; falls back to text + structuredContent on non-UI clients).

## Rationale

The original four tools cover discovery only. AI Bid Radar adds the candidate-to-decision loop (rank, explain, qualify, extract, export, schedule, document, ask, study competitors), which is what real public-procurement teams need next. The v0.4 tools all stay read-only against KKJ and degrade gracefully when fields are missing.

`search_bids_app` reuses the same input/output schemas as `search_bids` and is intentionally separated so MCP Apps-aware hosts can render the table while non-UI clients keep the standard tool surface untouched.

### v0.8.x (Investor Radar)

Add Pro-tier fact tools that map KKJ notices to listed-company tickers. No buy/sell advice (ADR-0025):

- `map_awards_to_listed` — name-match notices to ticker codes (bundled catalog; J-Quants key optional)
- `get_listed_award_history` — KKJ notice history for a company or ticker
- `analyze_award_price_impact` — notice-date window of public daily closes (J-Quants key required)
- `watch_listed_awards` — ticker watchlist + state_token diff (saved-search pattern)
- `search_investor_radar_app` — MCP Apps overlay; text + structuredContent fallback

Existing published tool names and required arguments are unchanged.
