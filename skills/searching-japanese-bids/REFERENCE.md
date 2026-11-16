# JP Bids MCP — Tool Reference

Input schemas and edge cases for Public MVP (7 free tools) and `full_local` developer tools.

## Public MVP tools (free, always available)

### `search_bids`

Full-text search across Japanese government procurement notices.

| Param | Type | Notes |
|---|---|---|
| `query` | string | Free text keyword query |
| `project_name` | string | Title-only filter (narrower) |
| `organization_name` | string | Procuring organization name |
| `prefecture` | string or string[] | Japanese prefecture name(s), e.g. `"東京都"` or `["東京都", "神奈川県"]` |
| `category` | enum | `"役務"` / `"物品"` / `"工事"` |
| `procedure_type` | enum | `"一般競争入札"` / `"簡易公募型競争入札"` / `"簡易公募型指名競争入札"` |
| `certification` | array | `("A" \| "B" \| "C" \| "D")[]` |
| `issued_after` / `issued_before` | YYYY-MM-DD | Public posting date range |
| `due_after` / `due_before` | YYYY-MM-DD | Bid submission deadline range |
| `opening_after` / `opening_before` | YYYY-MM-DD | Bid opening date range |
| `period_end_after` / `period_end_before` | YYYY-MM-DD | Delivery / contract end date range |
| `limit` | number | Default 20, max 1000 (`structuredContent.bids` returns up to 100 items) |

**Edge cases**:
- At least one search filter (`query`, `project_name`, `organization_name`, `prefecture`, `category`, `issued_*`, `due_*`, etc.) is required.
- Empty result is normal for narrow queries; widen by removing one filter at a time.

### `list_recent_bids`

Shorthand for recent notices (`days`: 1–30, default 7). Accepts optional `prefecture`, `category`, and `limit` (default 20, max 1000; `structuredContent.bids` capped at 100). Does **not** accept `query` (use `search_bids` when filtering by keyword).

### `get_bid_detail`

| Param | Type | Notes |
|---|---|---|
| `bid_ref` | string (optional) | Signed snapshot token from a prior search (preferred; avoids extra KKJ search) |
| `bid_key` | string (optional) | Notice Key from a prior search (provide `bid_ref` or `bid_key`) |

### `rank_bids`

Scores candidate bids (either `bid_refs` selection of 1–50 items, or search filter parameters) with optional `preferred_keywords`, `avoid_keywords`, `due_within_days` (default 14), and `shortlist_limit` (default 10 in search mode; selection mode ranks all provided `bid_refs` without truncating). Returns `pursue` / `review` / `skip` priorities, scores (0–100), reasons, risks, and next actions. Do not combine `bid_refs` and search filter parameters in the same call.

### `search_bids_app`

Same search input as `search_bids`; renders the interactive AI Bid Workspace (`ui://jp-bids/search-results.html`) on MCP Apps-capable hosts and falls back to structured text on text-only hosts.

### `extract_bid_requirements`

Organizes eligibility, deadlines, required documents, and contact points from `bid_ref` or `bid_key`. `fetch_documents` defaults to `false` (metadata-only; unverified fields are listed in `missingRequirements`).

### `export_bid_shortlist`

| Param | Values |
|---|---|
| `bid_refs` | Optional array of 1–50 signed `bid_ref` tokens (preserves selection order; mutually exclusive with search filters) |
| `format` | `"csv"` (default) / `"json"` |
| `preferred_keywords` / `avoid_keywords` / `due_within_days` | Optional scoring criteria applied to exported rows |

Returns 16-column `csv` string (or `jsonContent` array with string values), `rankedCount`, `columns`, and suggested `filename` in `structuredContent`.

## Local developer profile tools (`JP_BIDS_PROFILE=full_local` only)

### `explain_bid_fit`

Generates a plain-language fit breakdown (`bid_key` or `bid_ref`, plus optional `preferred_keywords`, `avoid_keywords`, `due_within_days`).

### `assess_bid_qualification`

Checks formal eligibility against explicit company parameters (`bid_key`, `qualified_prefectures`, `qualified_categories`, `certifications`, `service_keywords`, `excluded_keywords`).

### `create_bid_calendar`

Generates an RFC 5545 ICS calendar for a single bid's dates.

| Param | Notes |
|---|---|
| `bid_key` | Notice Key from a prior search |
| `include_review_reminders` | Boolean (default `true`): adds internal review reminders before deadlines |

### `create_bid_review_packet`

Markdown document combining bid detail, fit explanation, qualification check, extracted requirements, and ICS calendar for a single `bid_key`.

### `draft_bid_questions`

Drafts clarification questions (`bid_key`, optional `company_name`, `contact_person`, `extra_topics`) in polite Japanese business style (敬語).

### `analyze_past_awards`

Aggregates historical notice frequency (`query`, `organization_name`, `prefecture`, `category`, `window_days`, `limit`). Note: KKJ contains public tender notices rather than official winning-bidder registries.

### `summarize_bids_by_org`

Roll-up by `organization_name` showing recent notice volume, procedure breakdown, and category mix.

### `save_search` / `check_saved_search` / `list_saved_searches`

Save and re-check search filters locally (`save_search` takes `name` plus optional `query`, `project_name`, `organization_name`, `prefecture`, `category`; `check_saved_search` takes `name`; `list_saved_searches` takes no arguments).

### Investor Radar reference tools (`full_local` only)

`map_awards_to_listed`, `get_listed_award_history`, `analyze_award_price_impact`, `watch_listed_awards`, and `search_investor_radar_app` (`ui://jp-bids/investor-radar.html`).

## Common error responses

| Error | Cause | Fix |
|---|---|---|
| Invalid prefecture | Prefecture name not recognized | Check `codes://prefectures` resource and pass Japanese name (e.g. `"鹿児島県"`) |
| Invalid or expired `bid_ref` | Token expired (default 24h TTL) or server secret rotated | Re-run `search_bids`, `search_bids_app`, or `list_recent_bids` to obtain fresh `bid_ref` tokens |
| Mixed selection & search args | Both `bid_refs` and search filter parameters passed to `rank_bids` or `export_bid_shortlist` | Pass either `bid_refs` only (selection mode) or search filters only |
| Document extraction disabled / > 10 MiB | `fetch_documents` disabled on server (`JP_BIDS_DOCUMENT_EXTRACTION=off` by default) or attachment exceeds 10 MiB | Review `missingRequirements` and check the official announcement URL directly |
