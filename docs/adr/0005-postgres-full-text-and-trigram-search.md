# ADR 0005: PostgreSQL full-text search and pg_trgm

**Status:** Accepted · **Date:** 2026-10-20

## Context
Phase 1 needs search across posts, skills and creators with partial-keyword and typo tolerance, at no extra cost.

## Decision
Use PostgreSQL full-text search (`tsvector` + GIN) combined with `pg_trgm` trigram similarity. No separate search service.

## Alternatives considered
Meilisearch (better relevance, extra service to run); Algolia (quota-limited free tier, data leaves our database).

## Consequences
Relevance tuning is done with constants in the search module. A dedicated search engine can be introduced later behind the search module's public API.
