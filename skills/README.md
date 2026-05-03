# JP Bids MCP — Agent Skills

This directory contains [Anthropic Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) that guide Claude in using the JP Bids MCP server effectively.

## Available skills

### `searching-japanese-bids`

Searches, ranks, and analyzes Japanese government procurement bids via the JP Bids MCP server.

**Triggers**: Japanese government bids, public procurement, 入札, 官公需, RFPs in Japan, prefecture/organization/category-based tender search.

**Files**:
- [`SKILL.md`](searching-japanese-bids/SKILL.md) — Main skill definition with workflows
- [`REFERENCE.md`](searching-japanese-bids/REFERENCE.md) — Full tool argument schemas
- [`EXAMPLES.md`](searching-japanese-bids/EXAMPLES.md) — End-to-end conversation transcripts

## Installation

### Claude.ai

1. Zip the `searching-japanese-bids/` directory:
   ```bash
   cd skills && zip -r searching-japanese-bids.zip searching-japanese-bids/
   ```
2. Open Claude.ai → Settings → Features → Skills → Upload skill
3. Select the zip file

### Claude Code

```bash
mkdir -p ~/.claude/skills
cp -r skills/searching-japanese-bids ~/.claude/skills/
```

### Claude API

Upload via the `/v1/skills` endpoint with the beta headers `code-execution-2025-08-25`, `skills-2025-10-02`, `files-api-2025-04-14`.

See the [Skills API guide](https://platform.claude.com/docs/en/build-with-claude/skills-guide).

## Pairing with the MCP server

These skills assume the JP Bids MCP server is connected. Add the remote endpoint:

```text
https://mcp.bid-jp.com/mcp
```

See the [main README](../README.md) for MCP setup.

## License

Apache-2.0 — same as the parent project.
