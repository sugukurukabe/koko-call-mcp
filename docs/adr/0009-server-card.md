# ADR-0009: Server Metadata

## Status

Accepted

## Decision

Ship both `server.json` for MCP Registry publishing and a static `.well-known/mcp-server.json` for discovery experiments.

## Rationale

Registry metadata is the official publishing path. The `.well-known` file is cheap, static, and useful for early discovery patterns without becoming business logic.
