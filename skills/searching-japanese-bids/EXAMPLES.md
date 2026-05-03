# JP Bids MCP — Conversation Examples

Concrete end-to-end transcripts showing how to chain tools.

## Example 1: Morning briefing for IT consulting firm

**User**: "What IT-related bids came out for Tokyo this week?"

**Claude's process**:

1. Call `list_recent_bids(prefecture="東京都", category="役務", days=7)`
2. From the results, filter mentally for IT-relevant titles (システム/開発/DX/AI)
3. Call `rank_bids(bids=<filtered>, profile={industry:"IT consulting", size:50, prefecture_focus:["東京都"]})`
4. Present as: top 3 "pursue" bids with one-line rationale each, plus a count of "review" bids

**Sample response shape**:
```
今週の東京都IT系入札を113件から絞り込みました。注目は3件:

1. 江東区AIデマンド交通実証運行 (5/20締切) — AI実装、競争力ある
2. 機械学習GPUサーバー調達 (5/15締切) — 物品だが規模感マッチ
3. デジタル庁システム改修 (5/22締切) — 過去落札なしの新規枠

その他「要検討」が6件あります。詳細を見ますか？
```

## Example 2: Single bid deep dive

**User**: "Tell me about bid key abc123 — should we go for it?"

**Claude's process**:

1. `get_bid_detail(bid_key="abc123")`
2. Ask user for company profile if not already in conversation
3. `assess_bid_qualification(bid_key="abc123", company_profile=<profile>)`
4. If bid has PDF attachment: `extract_bid_requirements(bid_key="abc123")`
5. `explain_bid_fit(bid_key="abc123", company_profile=<profile>)`
6. Synthesize: bid summary + qualification verdict + key requirements + fit narrative

If `assess_bid_qualification` returns `eligible=false`, surface the blocker prominently before going deeper.

## Example 3: Calendar handoff

**User**: "Add deadlines for the top 5 bids from earlier to my calendar"

**Claude's process**:

1. Recall the 5 `bid_key`s from earlier in conversation
2. `create_bid_calendar(bid_keys=[...], event_type="submission")`
3. Return the ICS file with a one-line "Open this in your calendar app to add 5 deadlines"

## Example 4: Competitive intelligence

**User**: "Who's winning road work bids in Kagoshima recently?"

**Claude's process**:

1. `analyze_past_awards(prefecture="鹿児島県", category="工事", keyword="道路")`
2. From top 3 winners: `summarize_bids_by_org(organization_name=<each>)`
3. Present as: market share table + each winner's typical contract profile

## Anti-patterns

**Don't**: Call `extract_bid_requirements` on every search result. It's expensive (PDF fetch + LLM extraction). Use only when user asks about specific requirements or a bid is shortlisted.

**Don't**: Guess `bid_key` from a partial title. Always source from a search result.

**Don't**: Show the raw KKJ JSON to users. Format it as a readable summary; users care about deadlines, scope, and amounts, not internal field names.

**Don't**: Assume the user knows Japanese procurement categories. When they say "construction" map to `"工事"`, "services" to `"役務"`, "goods" to `"物品"`.
