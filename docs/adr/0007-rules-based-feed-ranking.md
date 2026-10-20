# ADR 0007: Rules-based feed ranking

**Status:** Accepted · **Date:** 2026-10-20

## Context
The discovery feed must be personalised from day one and encourage exploring new skills, without a machine-learning pipeline.

## Decision
Rank candidates per request with transparent rules: interest match, level fit, freshness, save affinity, negative feedback, a discovery quota for unfamiliar skills and a diversity rule. Feed sessions record served posts so pages never repeat. Weights live in one config file.

## Alternatives considered
ML recommendation system (needs data and infrastructure we do not have); chronological feed (no personalisation).

## Consequences
Weights are PROPOSED and will be tuned after measuring real usage.
