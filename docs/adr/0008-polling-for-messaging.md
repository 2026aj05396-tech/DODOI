# ADR 0008: Polling for direct messaging

**Status:** Accepted · **Date:** 2026-10-20

## Context
Direct messaging arrives in Phase 3. Serverless hosting cannot keep WebSocket connections open, and paid realtime services are out of budget.

## Decision
Deliver messages by short-interval polling against Route Handlers; messages are persisted in PostgreSQL.

## Alternatives considered
Managed realtime services such as Pusher or Ably (free tiers with limits); a self-hosted WebSocket server (extra service).

## Consequences
Slightly higher latency and request volume. The transport can be swapped later without changing message storage.
