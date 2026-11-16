# JP Bids MCP

## Tagline
Search and AI-analyze Japanese government procurement bids via MCP.

## Description
JP Bids MCP connects LLM-powered clients to Japan's official government procurement portal (官公需情報ポータルサイト, operated by the SME Agency). The hosted Public MVP (`https://mcp.bid-jp.com/mcp`) and default `npx jp-bids-mcp` provide 7 free, read-only tools for real-time bid search, interactive MCP Apps UI browsing (`AI Bid Workspace`), scoring and ranking, official specification URL inspection, and CSV/JSON shortlist export across all 47 prefectures of Japan. Self-hosted/local users can set `JP_BIDS_PROFILE=full_local` to unlock all 22 developer tools (including ICS calendar export, internal review packets, draft questions, saved searches, Investor Radar, and optional `JP_BIDS_DOCUMENT_EXTRACTION=vertex` PDF/HTML extraction).

## Setup Requirements
- Remote endpoint (`https://mcp.bid-jp.com/mcp`): Streamable HTTP with built-in OAuth 2.0 (PKCE + Dynamic Client Registration, 1-click consent, free of charge).
- Local stdio (`npx jp-bids-mcp`): No OAuth or API key required.
- `JP_BIDS_PROFILE` (optional, local/self-hosted): Defaults to `public_mvp` (7 public tools). Set to `full_local` to enable all 22 local workflow and Investor Radar tools.
- `JP_BIDS_DOCUMENT_EXTRACTION` (optional, local/self-hosted): Defaults to `off` (URL listing only). Set to `direct` for direct PDF/HTML text parsing or `vertex` for Vertex AI Gemini extraction (requires `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`).

## Category
Data & Analytics

## Use Cases
Government bid search, Procurement analysis, Bid qualification assessment, Tender deadline tracking, Competitive intelligence, PDF requirement extraction, Sales briefing preparation, Export bid shortlists

## Features
- Search Japanese government procurement bids by keyword, region, category, and date range
- Interactive MCP Apps UI (`AI Bid Workspace`) for visual bid browsing and CSV/JSON shortlist export
- Score and rank bids by your company profile and practical follow-up priority
- Inspect specification attachment URLs (plus optional direct/Vertex AI PDF/HTML extraction when self-hosting)
- Export filtered or selected bid shortlists as validated 16-column CSV or JSON
- Full-text search across all 47 prefectures and procurement categories (`物品`, `工事`, `役務`)
- Both remote Streamable HTTP (`https://mcp.bid-jp.com/mcp`) and local stdio (`npx jp-bids-mcp`) transports supported
- Public MVP profile with 7 free tools (`public_mvp`); local developer profile with 22 tools (`JP_BIDS_PROFILE=full_local`), including ICS calendar export, review packets, draft questions, saved searches, and Investor Radar

## Getting Started
- "Search for IT system bids in Tokyo published this week"
- "Open AI Bid Workspace for service tenders in Kagoshima"
- "Rank these bids by fit for a cloud maintenance team"
- "List official attachment URLs and submission deadlines for this bid"
- "Export the top ranked bids as CSV"
- Tool: search_bids — Search bids by keyword, prefecture, category, date range
- Tool: list_recent_bids — List recent procurement notices from the past 1–30 days
- Tool: get_bid_detail — Get full details for a specific bid (`bid_ref` or `bid_key`)
- Tool: search_bids_app — Open the interactive AI Bid Workspace (MCP Apps UI)
- Tool: rank_bids — Score and rank bids against your company profile
- Tool: extract_bid_requirements — List official attachment URLs (and extract text when configured locally)
- Tool: export_bid_shortlist — Export ranked or selected bids as CSV or JSON

## Tags
japan, government, procurement, bids, tenders, 入札, 官公需, public-procurement, mcp, ai-analysis, pdf-extraction, vertex-ai, bid-search, data-analytics, streamable-http

## Documentation URL
https://github.com/sugukurukabe/koko-call-mcp

## Health Check URL
https://mcp.bid-jp.com/health
