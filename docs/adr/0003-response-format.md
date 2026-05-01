# ADR-0003: 応答形式 / Response Format / Format Respons

## Status

Accepted

## Decision

Every tool returns human-readable `content` and machine-readable `structuredContent`.

## Rationale

MCP recommends duplicating structured output into text for compatibility. This keeps older clients useful while enabling typed downstream composition.
