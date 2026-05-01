# ADR-0002: Transport 方針 / Transport Policy / Kebijakan Transport

## Status

Accepted

## Decision

Support stdio for local clients and Streamable HTTP for Cloud Run from the first release.

## Rationale

The MCP specification defines both transports. stdio keeps local installation simple, while Streamable HTTP makes the HTTP-only KKJ API available behind an HTTPS MCP endpoint.
