# JP Bids MCP

## Tagline
Search and AI-analyze Japanese government procurement bids via MCP.

## Description
JP Bids MCP connects LLM-powered clients to Japan's official government procurement portal (官公需情報ポータルサイト, operated by the SME Agency). It provides real-time bid search, AI-driven scoring and ranking, PDF/HTML requirement extraction via Vertex AI Gemini, calendar export, review packet generation, and an interactive MCP Apps UI panel. Designed for procurement officers, sales teams, and bid consultants who need to discover, evaluate, and act on public tender opportunities across all 47 prefectures of Japan. All features are free during beta (until end of June 2026).

## Setup Requirements
- No API key required for the remote endpoint. Connect directly via Streamable HTTP.
- `JP_BIDS_PRO_API_KEYS` (optional): Comma-separated API keys for Pro tier enforcement when self-hosting. Default: all requests treated as Pro.
- `JP_BIDS_VERTEX_AI` (optional): Set to `1` to enable Vertex AI Gemini PDF extraction when self-hosting. Requires `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`.

## Category
Data & Analytics

## Use Cases
Government bid search, Procurement analysis, Bid qualification assessment, Tender deadline tracking, Competitive intelligence, PDF requirement extraction, Sales briefing preparation, Export bid shortlists

## Features
- Search Japanese government procurement bids by keyword, region, category, and date range
- AI Bid Radar: score and rank bids by your company profile and practical follow-up priority
- Extract requirements from bid PDF/HTML attachments using Vertex AI Gemini
- Assess bid qualification eligibility against your company credentials
- Generate ICS calendar files for bid submission deadlines
- Create internal review packets summarizing bid opportunities
- Draft clarification questions for procuring organizations
- Analyze past award results by organization
- Export filtered bid shortlists as CSV or JSON
- Interactive MCP Apps UI panel for visual bid browsing in compatible clients
- Full-text search across all 47 prefectures and all procurement categories
- Resource Templates for deep-linking individual bids, prefectures, and organizations
- Both remote Streamable HTTP and local stdio transports supported
- Free tier with 4 core tools; Pro tier with 14 tools (all free during beta)

## Getting Started
- "Search for IT system bids in Tokyo published this week"
- "Rank these bids by fit for a 50-person IT consulting firm"
- "Extract requirements from the PDF attachment of this bid"
- "Show me upcoming bid deadlines as a calendar"
- "Draft clarification questions for this road construction tender"
- Tool: search_bids — Search bids by keyword, prefecture, category, date range
- Tool: rank_bids — Score and rank bids against your company profile
- Tool: get_bid_detail — Get full details for a specific bid
- Tool: extract_bid_requirements — Extract structured requirements from bid PDFs
- Tool: create_bid_calendar — Generate ICS calendar for bid deadlines
- Tool: draft_bid_questions — Draft clarification questions for a bid

## Tags
japan, government, procurement, bids, tenders, 入札, 官公需, public-procurement, mcp, ai-analysis, pdf-extraction, vertex-ai, bid-search, data-analytics, streamable-http

## Documentation URL
https://github.com/sugukurukabe/koko-call-mcp

## Health Check URL
https://mcp.bid-jp.com/health
