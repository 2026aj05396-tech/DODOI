# ADR 0001: Modular monolith in Next.js

**Status:** Accepted · **Date:** 2026-10-20

## Context
dodoi needs a web UI, a JSON API, background jobs and several business areas (users, skills, content, feed, search, collections, later communities, messaging and AI). The team is small, development is AI-assisted, and there is no budget for running several services.

## Decision
Build one Next.js (App Router, TypeScript) application. UI routes and `/api/*` Route Handlers live in `src/app`; business logic lives in `src/server/modules/<module>` with a public `index.ts`; data access via Prisma in each module's repository. Mutations go through Route Handlers; Server Actions are not used.

## Alternatives considered
Separate frontend and backend services (more deploys and contracts to keep in sync); microservices (operational cost far beyond current needs); BaaS such as Supabase/Firebase (business rules spread across client and platform policies).

## Consequences
One repo and one deploy; strict internal boundaries must be enforced by lint rules and review (CODE_QUALITY §3–4, §12). Persistent WebSockets are not available on serverless hosts, which is why messaging starts with polling (ADR 0008).
