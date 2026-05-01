# ADR-0004: 入出力検証 / Input and Output Validation / Validasi Input dan Output

## Status

Accepted

## Decision

Use Zod schemas for all public tool inputs, normalized API outputs, and attribution payloads.

## Rationale

The upstream XML contains optional and inconsistent fields. Parsing through `unknown` and validating with schemas avoids unsafe casts and keeps `any` out of the codebase.
