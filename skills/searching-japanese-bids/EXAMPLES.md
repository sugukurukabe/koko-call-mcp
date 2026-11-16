# JP Bids MCP — Conversation Examples

Concrete end-to-end transcripts showing how to chain tools.

## Example 1: Morning briefing for IT consulting firm (`public_mvp`)

**User**: "What IT-related bids came out for Tokyo this week?"

**Assistant's process**:

1. Call `list_recent_bids(prefecture="東京都", category="役務", days=7, limit=50)`
2. Collect `bidRef` tokens from IT-relevant notices (システム / 開発 / DX / AI) or run `rank_bids(query="システム", prefecture="東京都", category="役務", preferred_keywords=["AI", "クラウド", "DX"], shortlist_limit=10)`
3. Present top 3 `pursue` bids with one-line rationale each, plus a count of `review` bids and official URLs

**Sample response shape**:
```
今週の東京都IT系入札から注目候補を3件に絞り込みました（出典: 中小企業庁 官公需情報ポータルサイト）:

1. 江東区AIデマンド交通実証運行 (5/20締切) — AIキーワード一致、期限余裕あり
2. 機械学習基盤クラウド構築 (5/15締切) — クラウド・AI領域に合致
3. デジタル庁システム改修 (5/22締切) — 一般競争入札・役務案件

その他「review（要検討）」が6件あります。選んだ候補をCSV/JSONで出力しますか？
```

## Example 2: Single bid requirement check (`public_mvp`)

**User**: "Check the requirements for the first bid and export our top 2 choices as CSV."

**Assistant's process**:

1. `get_bid_detail(bid_ref=<bidRef_1>)`
2. `extract_bid_requirements(bid_ref=<bidRef_1>, fetch_documents=false)`
3. `export_bid_shortlist(bid_refs=[<bidRef_1>, <bidRef_2>], format="csv")`
4. Summarize confirmed metadata fields vs `missingRequirements` (items to verify on the official announcement PDF/page) and present the exported shortlist

## Example 3: Qualification & calendar handoff (`full_local` local profile only)

**User**: "Using our local developer server, check qualification for bid key KKJ-2026-001, draft questions, and create an ICS calendar."

**Assistant's process** (`JP_BIDS_PROFILE=full_local`):

1. `assess_bid_qualification(bid_key="KKJ-2026-001", qualified_prefectures=["東京都"], qualified_categories=["役務"], certifications=["A", "B"], service_keywords=["システム", "保守"])`
2. `draft_bid_questions(bid_key="KKJ-2026-001")`
3. `create_bid_calendar(bid_key="KKJ-2026-001", include_review_reminders=true)`

## Example 4: Procuring organization trend (`full_local` local profile only)

**User**: "Which organizations in Kagoshima are publishing road construction notices recently?"

**Assistant's process** (`JP_BIDS_PROFILE=full_local`):

1. `analyze_past_awards(prefecture="鹿児島県", category="工事", query="道路", window_days=180)`
2. For top organizations: `summarize_bids_by_org(organization_name=<each>)`
3. Present notice counts, category/procedure breakdown, and note that KKJ reflects published tender notices

## Anti-patterns

**Don't**: Call `extract_bid_requirements` with `fetch_documents=true` on every search result. Keep `fetch_documents=false` (the default) unless document extraction is explicitly enabled and requested for a shortlisted notice.

**Don't**: Guess `bid_ref` or `bid_key` from a partial title. Always source from a prior search result.

**Don't**: Combine `bid_refs` and search filter parameters (`query`, `prefecture`, etc.) in the same `rank_bids` or `export_bid_shortlist` call — they are mutually exclusive.

**Don't**: Assume the user knows Japanese procurement categories. When they say "construction" map to `"工事"`, "services" to `"役務"`, "goods" to `"物品"`.
