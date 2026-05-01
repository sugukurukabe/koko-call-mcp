# ADR-0010: Prompt Injection Defense

## Status

Accepted

## Decision

Treat upstream text as untrusted data and never execute instructions contained in bid descriptions or attachments.

## Rationale

Procurement descriptions can contain arbitrary text. The server returns data with source attribution and leaves interpretation to the host, while keeping tool behavior deterministic.
