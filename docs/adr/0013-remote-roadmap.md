# ADR-0013: Remote Transport, Tasks, Sampling, and Auth Roadmap

## Status

Accepted

## Decision

Keep JP Bids MCP v0.3.x focused on read-only procurement search over stdio. Add remote Streamable HTTP metadata, Tasks, Sampling, and enterprise authentication only after concrete operational requirements exist.

## Rationale

The current KKJ API calls are short-running and use public data. Adding Tasks, Sampling, OAuth, or enterprise IdP support before there is a long-running workflow or protected data would increase risk and maintenance cost without improving the main user value.

## Consequences

- Cloud Run remote metadata will be added only after a live endpoint passes health checks.
- Tasks will be introduced only for bulk search, scheduled reports, or workflows that exceed normal request timeouts.
- Sampling is not implemented until a separate prompt-injection and traffic-gateway review is complete.
- OAuth and enterprise IdP support will be designed in a separate ADR if remote access control becomes necessary.
