# Anthropic / Cursor JPショーケース申請テンプレ

> 機密資料 / 送信前に壁が最終確認

---

## A. Anthropic Solutions Gallery 申請

**申請URL**: https://www.anthropic.com/solutions  
（または solutions@anthropic.com へメール）

**件名**:
```
JP Bids MCP — Japan Government Procurement MCP Server (MCP 2025-11-25, 17 tools)
```

**本文**:
```
Hi Anthropic team,

I'd like to submit JP Bids MCP for consideration in the Anthropic Solutions Gallery / Claude integrations showcase.

**What it is:**
An MCP server that exposes Japan's government procurement portal (KKJ, 1.8M+ bids/yr) as 17 AI tools, built to the MCP 2025-11-25 specification.

**Why it's relevant:**
- First MCP server for Japan's public procurement data
- Full 7-primitive implementation: Tools, Resources, Resource Templates, Prompts, Completion, Logging, Notifications
- Streamable HTTP + OAuth 2.0 (PKCE + DCR)
- outputSchema + annotations on every tool (Smithery quality: 90+)
- J-Grants (subsidies) + freee (accounting) MCP interoperability demos

**Real-world impact:**
Reduces bid research workflow from 2h15m → ~2min for Japanese SMEs.

**Links:**
- Remote endpoint: https://mcp.bid-jp.com/mcp
- GitHub: https://github.com/sugukurukabe/koko-call-mcp
- Smithery: https://smithery.ai/servers/a-kabe-1qio/jp-bids-mcp
- npm: https://www.npmjs.com/package/jp-bids-mcp

Happy to provide a demo or additional technical details.

Kabe
Sugukuru Inc. / CEO
```

---

## B. Cursor MCP Directory / Featured Servers 申請

**申請先**: https://cursor.com/mcp  
（またはCursorのDiscordの #mcp チャンネルに投稿）

**投稿テキスト**:
```
Submitting JP Bids MCP for the Cursor MCP directory.

Japan government procurement search + AI analysis. 17 tools.

- search_bids, rank_bids, analyze_past_awards, extract_bid_requirements (PDF via Gemini)
- Streamable HTTP + OAuth 2.0
- MCP 2025-11-25, full outputSchema + annotations

Setup in Cursor:
Add to .cursor/mcp.json:
{
  "mcpServers": {
    "jp-bids-mcp": {
      "url": "https://mcp.bid-jp.com/mcp"
    }
  }
}

GitHub: https://github.com/sugukurukabe/koko-call-mcp
```

---

## C. dev.to / Zenn クロスポスト後の追加アクション

Zenn・dev.to記事公開後:

1. **Anthropic Discordの #show-and-tell** に記事リンクを投稿
2. **MCP公式リポジトリ（modelcontextprotocol/servers）のREADME** にPRを送る
   - カテゴリ: `Government & Public Data`
   - エントリ: `JP Bids MCP — Japan government procurement (KKJ) search and AI analysis`
3. **X で @AnthropicAI / @cursor_ai をメンション**してショーケース化を促す

---

## タイムライン推奨

| 日付 | アクション |
|------|-----------|
| Zenn記事公開翌日 | Anthropic Solutions Gallery 申請メール送信 |
| 同日 | Cursor Discord #mcp 投稿 |
| +3日 | modelcontextprotocol/servers へのPR作成 |
| +1週間 | 返信がなければフォローアップ1回 |
