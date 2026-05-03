# Remote Smoke Prompts

## 日本語

MCP Inspector または対応クライアントで `https://mcp.bid-jp.com/mcp` に接続したあと、以下を試してください。

### 1. 検索系

#### Tool: search_bids

```json
{
  "query": "システム",
  "prefecture": "鹿児島県",
  "category": "役務",
  "limit": 3
}
```

#### Tool: list_recent_bids

```json
{
  "prefecture": "鹿児島県",
  "category": "役務",
  "days": 7,
  "limit": 5
}
```

### 2. AI Bid Radar

#### Tool: rank_bids

```json
{
  "query": "システム",
  "prefecture": "鹿児島県",
  "category": "役務",
  "preferred_keywords": ["保守", "クラウド"],
  "avoid_keywords": ["夜間"],
  "due_within_days": 30,
  "limit": 20
}
```

#### Tool: assess_bid_qualification

```json
{
  "bid_key": "<rank_bidsで返ったbid_key>",
  "qualified_prefectures": ["鹿児島県", "宮崎県"],
  "qualified_categories": ["役務"],
  "certifications": ["A", "B"],
  "service_keywords": ["システム", "保守"]
}
```

#### Tool: create_bid_review_packet

```json
{ "bid_key": "<rank_bidsで返ったbid_key>", "preferred_keywords": ["保守"] }
```

#### Tool: analyze_past_awards

```json
{
  "query": "システム",
  "prefecture": "鹿児島県",
  "window_days": 365,
  "limit": 200
}
```

### 3. Resource / Resource Template

```text
attribution://kkj
docs://api-reference
docs://agentic-cloud-roadmap
docs://agentic-security-storage-readiness
codes://prefectures
ui://jp-bids/search-results.html
prefecture://46
org://鹿児島市
bid://<rank_bidsで返ったbid_key>
```

## English

After connecting to `https://mcp.bid-jp.com/mcp` with MCP Inspector or a compatible client, try these examples.

### 1. Discovery

#### Tool: search_bids

```json
{
  "query": "system",
  "prefecture": "鹿児島県",
  "category": "役務",
  "limit": 3
}
```

#### Tool: list_recent_bids

```json
{
  "prefecture": "鹿児島県",
  "category": "役務",
  "days": 7,
  "limit": 5
}
```

### 2. AI Bid Radar

#### Tool: rank_bids

```json
{
  "query": "system",
  "prefecture": "鹿児島県",
  "category": "役務",
  "preferred_keywords": ["maintenance"],
  "due_within_days": 30,
  "limit": 20
}
```

#### Tool: create_bid_review_packet

```json
{ "bid_key": "<bid_key from rank_bids>" }
```

#### Tool: analyze_past_awards

```json
{ "query": "system", "prefecture": "鹿児島県", "window_days": 365, "limit": 200 }
```

### 3. Resources

```text
attribution://kkj
docs://api-reference
docs://agentic-cloud-roadmap
docs://agentic-security-storage-readiness
codes://prefectures
ui://jp-bids/search-results.html
prefecture://46
org://鹿児島市
bid://<bid_key from rank_bids>
```

## Bahasa Indonesia

Setelah tersambung ke `https://mcp.bid-jp.com/mcp` dengan MCP Inspector atau klien yang kompatibel, coba contoh berikut.

### 1. Pencarian

#### Tool: search_bids

```json
{ "query": "system", "prefecture": "鹿児島県", "category": "役務", "limit": 3 }
```

#### Tool: list_recent_bids

```json
{ "prefecture": "鹿児島県", "days": 7, "limit": 5 }
```

### 2. AI Bid Radar

#### Tool: rank_bids

```json
{
  "query": "system",
  "prefecture": "鹿児島県",
  "preferred_keywords": ["maintenance"],
  "due_within_days": 30,
  "limit": 20
}
```

#### Tool: analyze_past_awards

```json
{ "query": "system", "prefecture": "鹿児島県", "window_days": 365, "limit": 200 }
```

### 3. Resources

```text
attribution://kkj
docs://agentic-cloud-roadmap
ui://jp-bids/search-results.html
prefecture://46
org://鹿児島市
```
