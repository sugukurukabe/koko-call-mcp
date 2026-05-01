# ADR-0005: 認証方針 / Authentication Policy / Kebijakan Autentikasi

## Status

Accepted

## Decision

Do not add OAuth in v0.1.0. The server is read-only and the upstream API requires no authentication.

## Rationale

Adding authorization before user-specific data or write actions would increase operational complexity without improving the initial risk profile.
