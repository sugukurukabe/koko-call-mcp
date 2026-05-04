# ADR-0013: Remote Transport, Tasks, Sampling, and Auth Roadmap

## Status

Accepted (refined during v0.4.0)

## Decision

Through v0.3.x, JP Bids MCP stayed read-only over stdio. From v0.4.0, the same read-only stance is kept while remote Streamable HTTP metadata is published and an MCP Apps view is added. In later releases, OAuth 2.0 was introduced for remote client access. Tasks, server-side Sampling, and enterprise IdP integration remain deferred until concrete operational requirements exist.

## Rationale

The KKJ API calls are short-running and use public data. Adding Tasks, server-side Sampling, or enterprise IdP support before there is a long-running workflow or protected enterprise data would increase risk and maintenance cost without improving the main user value. OAuth 2.0 is now used for remote client authorization without changing the server's read-only stance.

## Consequences

- Cloud Run remote metadata is published only after the live endpoint passes `npm run remote:health` and `npm run remote:mcp` (introduced in v0.3.2 and exercised by every release).
- Tasks remain unimplemented. They will be introduced only for bulk search, scheduled reports, or workflows that exceed normal request timeouts.
- Server-side `sampling/createMessage` is not implemented. The optional MCP Apps view (`ui://jp-bids/search-results.html`, added in v0.4.0) may invoke the host-side sampling capability and falls back to chat when the host does not advertise sampling. See ADR-0014.
- OAuth 2.0 is implemented for remote access. Enterprise IdP integration remains out of scope until a separate ADR establishes the access-control model.

## Supersession notes

- v0.4.0 publishes Cloud Run remote metadata (`https://mcp.bid-jp.com/mcp`) and an MCP Apps integration. The original framing of "v0.3.x focused" only describes the v0.3.x phase and is preserved for history.
