# System Architecture

Markers: **CONFIRMED** / **PROPOSED** / **OPEN**.

---

## 1. Overview

A **modular monolith** in a single Next.js (App Router, TypeScript) application (CONFIRMED). UI, API route handlers and business logic live in one repository and one deployable, with strict internal module boundaries.

```
┌────────────────────────────── Browser / Installed PWA ─────────────────────────────┐
│  React Server Components + Client Components · Service Worker · Cache Storage      │
└───────────────┬───────────────────────────────────────────────┬────────────────────┘
                │ HTTPS (pages, /api/*)                         │ direct signed upload
┌───────────────▼──────────────── Next.js app ──────────────┐   │ (admin, later users)
│  app/ (routes, layouts)   app/api/* (route handlers)       │   │
│        │                         │                         │   │
│        └──────────┬──────────────┘                         │   │
│                   ▼                                        │   │
│   server/modules/*  ← business rules, authorization        │   │
│                   ▼                                        │   │
│   server/db (Prisma client)   server/integrations/*        │   │
└───────────┬─────────────────────────────┬──────────────────┘   │
            ▼                             ▼                      ▼
     PostgreSQL (Docker locally)     Resend (email)        Cloudinary (media + CDN)
     + pg_trgm, full-text search     Google OAuth
```

## 2. Confirmed Stack

| Layer | Choice | Status |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack, React Compiler, Cache Components — framework defaults) + React 19 | CONFIRMED |
| Language | TypeScript, `strict: true` | CONFIRMED |
| Styling | Tailwind CSS 4 + shadcn/ui | CONFIRMED |
| Backend | Route Handlers + service layer (same app) | CONFIRMED |
| Database | PostgreSQL | CONFIRMED |
| ORM | Prisma | CONFIRMED |
| Auth | Auth.js v5 (`next-auth@5.0.0-beta.32`, pinned) with an own minimal adapter on the Prisma client; Credentials + Google | CONFIRMED |
| Email | Resend | CONFIRMED |
| Media | Cloudinary | CONFIRMED |
| Search | PostgreSQL full-text + `pg_trgm` | CONFIRMED |
| Package manager | pnpm | CONFIRMED |
| Tests | Vitest + Testing Library, Playwright + axe | CONFIRMED |
| Local infra | Docker Compose (PostgreSQL) | CONFIRMED |
| Hosting | Local only for now | CONFIRMED; deployment OPEN (OD-01) |
| Messaging transport (P3) | Polling | CONFIRMED |
| AI provider (P4) | — | OPEN (OD-02) |

## 3. Supporting Libraries (APPROVED before P0-02)

All libraries below were approved by the product owner, including `eslint-plugin-import` for circular-import checks.

Libraries are installed in the task that first uses them, so the project never carries unused packages (CODE_QUALITY §12.3).

| Purpose | Library | Why | Installed in |
|---|---|---|---|
| Runtime validation | Zod | Shared request/response schemas for client + server; integrates with forms | P0-02 ☑ |
| Server-only guard | `server-only` | Build error if server code is imported by client code | P0-02 ☑ |
| Formatting | Prettier + `prettier-plugin-tailwindcss` | Consistent formatting and Tailwind class order (Markdown excluded to keep doc tables readable) | P0-02 ☑ |
| Import rules | `eslint-plugin-import` | Import order and circular-dependency checks | P0-02 ☑ |
| Forms | React Hook Form + `@hookform/resolvers` | Accessible, performant forms with Zod | P1-07 |
| Client data fetching/cache | TanStack Query | Infinite feed pagination, optimistic save, retries | P1-07 / first data-driven client UI |
| PWA / service worker | Serwist | Maintained Next.js service-worker tooling (verify Turbopack support at P1-27) | P1-27 |
| Password hashing | `argon2` (or `bcryptjs` if native build is problematic) | Secure password storage | P1-04 |
| Cloudinary SDK | `cloudinary` (server) | Signed uploads, verification, deletion | P1-03 |
| Email | `resend` SDK | Transactional email | P1-05 |
| Test a11y | `@axe-core/playwright` | Automated accessibility checks | P0-06 |

## 4. Architectural Rules

1. **Layering:** `app/` (UI + route handlers) → `server/modules/*` (services) → `server/db` / `server/integrations`. Never skip a layer: UI and route handlers never import Prisma directly.
2. **Module ownership:** each module owns its tables and business rules. Other modules call its public service functions (`server/modules/<name>/index.ts`), never its internals or its tables.
3. **Authorization lives in services.** Every service function receives an explicit `actor` (session user or `null`) and checks permissions itself. Route handlers do authentication; services do authorization.
4. **Validation at boundaries:** all route handler inputs parsed with Zod schemas from `src/lib/schemas/`.
5. **Server Components read via services**; mutations go through route handlers (`/api/*`) so one contract serves UI and future clients. Server Actions: **not used** in MVP (PROPOSED — keeps a single API contract).
6. **Secrets** only in server code. Files importing secrets start with `import "server-only"`.
7. **No microservices**, no message queues in MVP. Background work runs inline or via scripts until a need is proven.
8. **Provider abstraction** for replaceable integrations (email, media, AI): modules depend on an interface in `server/integrations/<kind>/types.ts`.

## 5. Folder Structure

```
src/
├── app/
│   ├── (marketing)/page.tsx            # Landing
│   ├── (auth)/sign-in, sign-up, forgot-password, reset-password, verify-email
│   ├── (app)/                          # Authenticated shell (nav)
│   │   ├── feed/
│   │   ├── explore/
│   │   ├── search/
│   │   ├── s/[slug]/                   # Skill page
│   │   ├── t/[slug]/                   # Theme page
│   │   ├── p/[postId]/                 # Post detail
│   │   ├── saved/ , saved/[collectionId]/
│   │   ├── u/[username]/               # Public profile
│   │   ├── onboarding/
│   │   └── settings/
│   ├── admin/                          # ADMIN-only
│   ├── api/                            # Route handlers (see API_SPECIFICATION.md)
│   │   └── auth/[...nextauth]/route.ts
│   ├── offline/page.tsx
│   ├── manifest.ts
│   └── sw.ts                           # Service worker source (Serwist)
├── components/
│   ├── ui/                             # shadcn primitives (restyled)
│   ├── feed/ post/ collections/ profile/ onboarding/ layout/ admin/
├── hooks/                              # Domain-free client hooks (approved P0-01)
├── server/
│   ├── auth/                           # Auth.js config, session helpers, password utils
│   ├── db/                             # Prisma client singleton
│   ├── modules/
│   │   ├── users/                      # accounts, profiles, user skills
│   │   ├── skills/                     # skills, custom interests, normalization
│   │   ├── content/                    # posts, media assets, themes
│   │   ├── feed/                       # ranking, feedback, sessions
│   │   ├── search/
│   │   ├── collections/                # saves, collections
│   │   ├── admin/                      # audit log, admin ops
│   │   └── (P2+) social/ notifications/ moderation/ communities/ messaging/ help/ sessions/ ai/
│   ├── integrations/
│   │   ├── email/   (resend implementation)
│   │   ├── media/   (cloudinary implementation)
│   │   └── ai/      (P4, provider OPEN)
│   └── lib/                            # errors, logger, rate-limit, pagination, http helpers
├── lib/
│   ├── api-client/                     # Typed browser → /api calls (approved P0-01)
│   ├── constants/                      # Cross-cutting constants (approved P0-01)
│   ├── schemas/                        # Zod schemas shared client/server
│   ├── types/
│   └── utils/
└── styles/
    ├── globals.css
    └── tokens.css
prisma/
├── schema.prisma
├── migrations/
└── seed/                               # reference data + content import
seed-content/                           # JSON + media files for import
tests/
├── integration/
└── e2e/
```

Each module folder: `index.ts` (public API), `service.ts`, `repository.ts` (Prisma queries), `schemas.ts`, `policies.ts` (authorization), `*.test.ts`.

## 6. Authentication Architecture

- **Auth.js** v5 with an own minimal adapter (`src/server/auth/adapter.ts`: `getUser`, `getUserByAccount`) — `@auth/prisma-adapter` only supports Prisma ≤ 6. The `signIn` callback creates or links Google users in the users module (OD-09) before Auth.js looks the account up, so Auth.js never creates users itself. Providers: **Credentials** (email/password) and **Google**.
- **Route protection:** `src/proxy.ts` does an optimistic cookie-only check on signed-in areas and redirects to `/sign-in?returnTo=…`; every page and route handler validates the session against the database through `getActor()` (`src/server/auth/session.ts`). Route handlers declare `auth: "public" | "user"` in `withRouteHandler`.
- **Session strategy: JWT** (CONFIRMED, required): Auth.js Credentials provider does not support database sessions. Implication: immediate server-side session revocation needs a `sessionVersion` (or `tokenVersion`) field on User checked in the JWT callback, incremented on password reset / sign-out-everywhere / deletion.
- Registration, email verification and password reset are **custom route handlers** (Auth.js does not provide password registration/reset). Tokens: random, stored **hashed**, single-use, expiring.
- Role on User: `USER` | `ADMIN` (MVP). `MODERATOR` added in P2.
- Middleware protects `(app)` and `admin` route groups (redirect to sign-in); services re-check authorization.
- Account linking (Google ↔ password, same email): automatic in the `signIn` callback; password removed if the existing account was unverified (CONFIRMED, OD-09; SECURITY §2.6).

## 7. Feed Ranking (Phase 1)

Rules-based, computed per request in `server/modules/feed`. All weights are **PROPOSED** constants in one config file for tuning.

**Candidate pool:** published posts, excluding: posts the user hid ("not interested"), posts already served in this feed session, (P2: blocked users' posts).

**Score** = `interestMatch` + `levelFit` + `freshness` + `saveAffinity` − `negativeFeedbackPenalty`, then **diversity re-ranking**.

| Signal | Rule (PROPOSED) |
|---|---|
| interestMatch | +3 per post skill in user's interests |
| levelFit | +1 if post difficulty ≤ one step above user's level for that skill |
| freshness | decays with post age (e.g. +2 if < 7 days, +1 if < 30 days) |
| saveAffinity | +1 per post skill that appears in user's recent saves |
| negativeFeedbackPenalty | −2 per post skill the user marked "not interested" recently |
| Discovery quota | ≥ 20% of each page drawn from skills outside the user's interests |
| Diversity | no more than 2 consecutive items with the same primary skill |

**Filters (FEED-13):** `for-you` = full ranking above · `skill:<slug>` = candidates restricted to that skill, same ranking without discovery quota · `new-to-you` = candidates restricted to skills outside the user's interests, ranked by freshness + level fit.

**Skill suggestion (FEED-14, PROPOSED rules):** pick an ACTIVE skill not in the user's interests, not dismissed, preferring skills related (SkillRelation) to the user's interests and with ≥ 1 published beginner post; requires `Skill.pitch`. Inserted as first item of page 1.

**Pagination & no-repeat (FEED-09):** a `feedSessionId` is created on first page load (returned to client); served post IDs are recorded server-side (FeedImpression table, see schema) and excluded on subsequent pages. Cursor encodes session ID + page index. Session expiry PROPOSED: 24h.

## 8. Media Architecture

- Storage and delivery: **Cloudinary** (CONFIRMED). Database stores only metadata (`MediaAsset`), never binary data.
- **Upload flow (signed direct upload):**
  1. Client requests a signature: `POST /api/media/sign` (authorized; Phase 1 admin only).
  2. Server validates intended type/size against limits (PRODUCT_REQUIREMENTS §5.8b), returns a signed, short-lived upload signature restricted to a folder and resource type.
  3. Client uploads directly to Cloudinary (progress shown).
  4. Client calls `POST /api/media` with the returned `public_id`; server verifies the asset via Cloudinary Admin API (type, size, dimensions, duration) before creating `MediaAsset`.
- Delivery: Cloudinary URLs with `f_auto,q_auto` and width variants; `width`/`height` stored to prevent layout shift.
- Video: max 60 s / 50 MB (MEDIA-03); poster generated by Cloudinary; no feed autoplay, no preload (FEED-12).
- Deletion: deleting a `MediaAsset` deletes the Cloudinary asset (via service). Orphan cleanup script for uploads never attached (PROPOSED: older than 24h).
- Free-tier quotas must be checked in the Cloudinary dashboard; usage monitored manually in MVP.

## 9. PWA and Offline Strategy

- Manifest via `app/manifest.ts`; icons 192, 512 and maskable (assets OPEN).
- Service worker via Serwist (PROPOSED).

**Offline matrix (PROPOSED — requires approval before implementation):**

| Resource / action | Strategy | Offline result |
|---|---|---|
| App shell, JS/CSS, fonts, icons | Precache | Available |
| Offline fallback page | Precache | Shown for uncached navigations |
| Previously visited pages (feed, detail, saved) | Network-first, cache fallback | Last cached version, marked stale |
| Cloudinary images already viewed | Cache-first, LRU limit (e.g. 200 entries / 7 days) | Available if cached |
| Video | Not cached | Placeholder |
| API GET responses | Network-only (React Query in-memory cache only) | Last in-memory data while tab is open |
| Save / unsave / any mutation | Network-only, **no queue in P1** | Disabled with message |
| Auth (sign-in, reset, verify) | Network-only | Disabled with message |
| Search | Network-only | Disabled with message |

## 10. Search Architecture

- `pg_trgm` extension enabled in the first migration.
- Posts: generated `tsvector` column (title A, description B, skills C) with GIN index; plus trigram GIN index on title for partial/typo matches.
- Skills: trigram index on `name`; profiles: trigram on `username` and `displayName`.
- Prisma does not model `tsvector` natively: columns/indexes created in raw SQL migrations; queries via `prisma.$queryRaw` with tagged templates (parameterized — never string-concatenated).
- Query ranking: `ts_rank` combined with trigram `similarity`, thresholds as PROPOSED constants.

## 11. Error Handling and Observability

- Services throw typed `AppError` subclasses (`ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`). A single route-handler wrapper maps them to the API error format.
- Unexpected errors → 500 with generic message + `requestId`; full details logged server-side.
- Logger: structured JSON to stdout with `requestId`, `userId` (when authenticated), route, latency. **Never log** passwords, tokens, email bodies, private content.
- Error monitoring / analytics services: OPEN (OD-20, OD-21).
- Admin actions → `AuditLog` table.

## 12. Rate Limiting

Required on: register, sign-in, password reset request, resend verification, media sign, search, custom interest creation. Storage: PostgreSQL `RateLimitBucket` table, fixed window (CONFIRMED, OD-27). The limiter must sit behind an interface so the backing store can change.

## 12b. Scheduled Jobs

Daily maintenance (PROPOSED trigger: GitHub Actions scheduled workflow calling a protected endpoint, or `pnpm jobs:daily` locally — deployment target is OPEN): purge expired auth tokens, feed sessions, rate-limit buckets; delete accounts past the 14-day grace period and unverified accounts older than 30 days; delete orphaned media.

## 13. Environments

Three application environments (CONFIRMED) plus automated test runs:

| Environment | `APP_ENV` | Purpose | Where | Data |
|---|---|---|---|---|
| **Local development** | `local` | Developers run the app on their machine | Docker PostgreSQL (`dodoi`), `pnpm dev` | Disposable dev data |
| **Test** (hosted QA) | `test` | PO and testers try features before production | Hosting OPEN (OD-01) | Own database; seed + test accounts only, never real user data |
| **Production** | `production` | Real users | Hosting OPEN (OD-01) | Real user data |
| *Automated test runs* | *(not an app environment)* | Vitest / Playwright locally and in CI | Local `dodoi_test` DB; CI Postgres service container (OD-24) | Created and wiped by the tests |

**Naming:** "Test environment" always means the hosted QA site. Automated tests are called "automated test runs"; they run with `NODE_ENV=test`. `APP_ENV` (not `NODE_ENV`) identifies the deployed environment, because both hosted environments build with `NODE_ENV=production`.

**Isolation (CONFIRMED — fully separate):** each environment has its own database, Auth.js secret, Google OAuth client (with its own redirect URIs), Cloudinary account or product environment, and Resend API key / sending domain. No secret or database is shared, and test data never touches production.

**Promotion flow (PROPOSED):** feature branch → PR (CI green) → merge to `main` → automatic deploy to **test** → PO verifies → production deploy from a version tag (`vX.Y.Z`) after PO approval. Database migrations run with `prisma migrate deploy` as part of each deploy; never `migrate dev` outside local.

**Environment-specific behaviour:**
- Non-production environments send `X-Robots-Tag: noindex` and show a small "TEST" badge so testers never confuse them with production.
- Seed/import scripts refuse to run against `APP_ENV=production` unless an explicit confirmation flag is passed (PROPOSED).
- Test-only helpers (e.g. E2E sign-in route) are enabled only in automated test runs, never in the hosted test or production environments.

Production readiness note: polling-based messaging (P3) and stateless JWT sessions are both compatible with serverless hosting if chosen later.

## 14. Architecture Decision Records

ADRs live in [`docs/adr/`](adr/README.md). Template: Status · Date · Context · Decision · Alternatives · Consequences.

| ADR | Title | Status |
|---|---|---|
| 0001 | Modular monolith in Next.js | Accepted |
| 0002 | PostgreSQL + Prisma | Accepted |
| 0003 | Auth.js with Credentials + Google, JWT sessions | Accepted (JWT strategy PROPOSED) |
| 0004 | Cloudinary for media with signed direct uploads | Accepted |
| 0005 | PostgreSQL full-text + pg_trgm for search | Accepted |
| 0006 | Tailwind + shadcn/ui | Accepted |
| 0007 | Rules-based feed ranking | Accepted (weights PROPOSED) |
| 0008 | Polling for messaging (P3) | Accepted |
| 0009 | Three environments; hosting deferred | Accepted |
