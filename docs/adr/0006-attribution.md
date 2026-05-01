# ADR-0006: 出典明記 / Attribution / Atribusi

## Status

Accepted

## Decision

All tool outputs include a required `attribution` object and human-readable source text.

## Rationale

Attribution is a data contract, not a prompt convention. Making it required prevents accidental omission by clients or models.
