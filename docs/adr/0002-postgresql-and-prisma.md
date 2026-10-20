# ADR 0002: PostgreSQL and Prisma

**Status:** Accepted · **Date:** 2026-10-20

## Context
The data model is highly relational (follows, collections, memberships, saves, reports) and needs full-text search and integrity constraints.

## Decision
PostgreSQL as the database, accessed through Prisma ORM 7 with the `@prisma/adapter-pg` driver adapter. Schema source of truth is docs/DATABASE_SCHEMA.md; changes only via Prisma migrations. Local development uses PostgreSQL in Docker (host port 5433).

## Alternatives considered
MongoDB (weaker relational integrity); Drizzle (viable, but Prisma chosen for schema-first workflow and generated types).

## Consequences
Features Prisma cannot model (tsvector columns, trigram indexes, partial unique indexes) are created in hand-edited SQL migrations and queried with tagged `$queryRaw`. Prisma 7 does not load env files itself; `prisma.config.ts` loads `.env.local`.
