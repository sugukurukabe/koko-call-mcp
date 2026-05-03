# JP Bids MCP — Tool Reference

Full input schemas and edge cases for all 14 tools. Loaded only when needed for parameter-level details.

## Free tier tools (always available)

### `search_bids`

Full-text search across all Japanese government procurement notices.

| Param | Type | Notes |
|---|---|---|
| `query` | string | Free text. Searches title, body, and attachments |
| `project_name` | string | Title-only filter (faster, narrower) |
| `organization_name` | string | Procuring organization name |
| `prefecture` | string | Japanese name (e.g. `"東京都"`) or `lg_code` |
| `category` | enum | `"役務"` / `"物品"` / `"工事"` |
| `announcement_date_from` / `_to` | YYYY-MM-DD | Public posting date range |
| `submission_deadline_from` / `_to` | YYYY-MM-DD | Bid submission deadline |
| `opening_date_from` / `_to` | YYYY-MM-DD | Bid opening date |
| `delivery_date_from` / `_to` | YYYY-MM-DD | Required delivery date |
| `limit` | number | Default 20, max 100 |

**Edge cases**:
- Empty result is normal for narrow queries; widen by removing one filter at a time.
- KKJ source data updates daily around 06:00 JST.

### `list_recent_bids`

Shorthand for "what came out recently". Equivalent to `search_bids` with `announcement_date_from = today - days`.

| Param | Type |
|---|---|
| `days` | number (default 7) |
| `prefecture`, `category` | same as `search_bids` |

### `get_bid_detail`

| Param | Type | Required |
|---|---|---|
| `bid_key` | string | yes |

`bid_key` is opaque — always source from a prior search result.

### `rank_bids`

Scores a list of bids against a company profile and returns sorted results with `pursue` / `review` / `skip` recommendations.

| Param | Type |
|---|---|
| `bids` | array of bid objects from a prior search |
| `profile` | object: `{ industry, size, prefecture_focus, contractor_grade?, capabilities? }` |

If `profile` is missing, ask the user for: industry/specialty, employee count, geographic focus, government contractor grade (if known).

## Pro tier tools (free during beta, paid after June 2026)

### `search_bids_app`

Same input as `search_bids` but renders an interactive MCP Apps panel on supported clients (Claude.ai web, Claude Desktop). Falls back to text on non-supported clients.

### `explain_bid_fit`

Generates plain-language fit narrative.

| Param | Required |
|---|---|
| `bid_key` | yes |
| `company_profile` | yes |

### `assess_bid_qualification`

Checks formal eligibility: contractor grade required, regional restrictions, prior experience requirements. Returns boolean per criterion plus overall verdict.

### `extract_bid_requirements`

Fetches the bid's primary attachment (PDF or HTML) and extracts structured requirements via Vertex AI Gemini.

| Returned field | Description |
|---|---|
| `scope` | Project scope summary |
| `deliverables` | List of required deliverables |
| `submission_format` | Required document format |
| `evaluation_criteria` | Scoring rubric if disclosed |
| `prerequisites` | Required certifications, past experience |

**SSRF guard**: server only fetches from KKJ-domain attachments. External URLs are rejected.

### `export_bid_shortlist`

| Param | Values |
|---|---|
| `format` | `"csv"` / `"json"` |
| `bid_keys` | array |

Returns base64-encoded file content + suggested filename.

### `create_bid_calendar`

Generates RFC 5545 ICS file with submission deadline events.

| Param | Notes |
|---|---|
| `bid_keys` | array |
| `event_type` | `"submission"` / `"opening"` / `"both"` |

### `create_bid_review_packet`

Markdown document combining bid detail, fit explanation, qualification check, extracted requirements, and a recommendation. Use as input to internal review meetings.

### `draft_bid_questions`

Drafts clarification questions to send to the procuring organization. Output respects Japanese business communication norms (敬語).

### `analyze_past_awards`

Aggregates historical award data. Returns top winning organizations, average award amounts, and year-over-year trends.

### `summarize_bids_by_org`

Roll-up by procuring organization showing recent activity volume, typical contract sizes, and category mix.

## Common error responses

| Error | Cause | Fix |
|---|---|---|
| `invalid_prefecture` | Prefecture name not recognized | Use `codes://prefectures` resource |
| `quota_exceeded` | Pro tool called without API key after beta | Inform user about Pro tier |
| `attachment_unavailable` | PDF not yet indexed | Retry in 1-2 hours |
| `pdf_too_large` | Attachment > 20MB | Cannot process; suggest manual review |
