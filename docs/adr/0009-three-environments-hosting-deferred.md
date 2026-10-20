# ADR 0009: Three environments; hosting deferred

**Status:** Accepted · **Date:** 2026-10-20

## Context
The product owner wants a hosted test environment and a production environment, in addition to local development, and no paid services yet.

## Decision
Run three app environments identified by `APP_ENV`: `local`, `test` (hosted QA) and `production`. Each has fully separate databases and credentials. Automated test runs are not an environment; they use the local `dodoi_test` database or a CI service container. The hosting provider is chosen before the first test deploy (OD-01).

## Alternatives considered
Single production environment only (no safe place to verify changes); sharing credentials between test and production (risk of test data reaching real users).

## Consequences
Proposed promotion flow: `main` deploys to test automatically; version tags deploy to production after PO approval. Hosting-specific setup is task P1-35.
