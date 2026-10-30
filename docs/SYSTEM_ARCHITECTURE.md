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
     PostgreSQL (Docker locally)     Resend / SMTP (email)  Cloudinary (media + CDN)
     + pg_trgm, full-text search     Google OAuth
                                     Gemini API (AI companion, server-side only)
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
| Email | Resend; SMTP (Gmail App Password) on the test site until a sending domain is verified (PO, 2026-10-28) | CONFIRMED |
| Media | Cloudinary | CONFIRMED |
| Search | PostgreSQL full-text + `pg_trgm` | CONFIRMED |
| Package manager | pnpm | CONFIRMED |
| Tests | Vitest + Testing Library, Playwright + axe | CONFIRMED |
| Local infra | Docker Compose (PostgreSQL) | CONFIRMED |
| Hosting | Test: Vercel Hobby + Neon (DEPLOYMENT.md) | Test DECIDED 2026-10-27; production OPEN (OD-01) |
| Messaging transport (P3) | Polling | CONFIRMED |
| AI provider (P4) | Google Gemini API over plain REST (no SDK), server-side key, behind `AIProvider` (`src/server/integrations/ai/`); model set by `AI_MODEL`; free tier for local and test only (`AI_TIER=free` is refused in production), paid tier before production (AI_INTEGRATION §9) | CONFIRMED (OD-02, 2026-10-29); adapter built in P4-01 |

## 3. Supporting Libraries (APPROVED before P0-02)

All libraries below were approved by the product owner, including `eslint-plugin-import` for circular-import checks.

Libraries are installed in the task that first uses them, so the project never carries unused packages (CODE_QUALITY §12.3).

| Purpose | Library | Why | Installed in |
|---|---|---|---|
| Runtime validation | Zod | Shared request/response schemas for client + server; integrates with forms | P0-02 ☑ |
| Server-only guard | `server-only` | Build error if server code is imported by client code | P0-02 ☑ |
| Formatting | Prettier + `prettier-plugin-tailwindcss` | Consistent formatting and Tailwind class order (Markdown excluded to keep doc tables readable) | P0-02 ☑ |
| Import rules | `eslint-plugin-import` | Import order and circular-dependency checks | P0-02 ☑ |
| Forms | React Hook Form + `@hookform/resolvers` | Approved, but not installed: forms are built without it (installed only if a task needs it) | not installed |
| Client data fetching/cache | TanStack Query | Infinite feed pagination, optimistic save, retries | P1-22 ☑ (`@tanstack/react-query`, PO approved 2026-10-27) |
| PWA / service worker | `serwist` + `@serwist/turbopack` | Maintained Next.js service-worker tooling, works with Turbopack | P1-27 ☑ |
| Password hashing | `argon2` | Secure password storage | P1-04 ☑ |
| Cloudinary SDK | Not used — Cloudinary's REST APIs are called directly (`src/server/integrations/media/cloudinary.ts`): signing, Admin API lookup/delete (P1-03) | Signed uploads, verification, deletion | P1-03 |
| Gemini SDK | Not used — the Gemini REST API is called directly (`src/server/integrations/ai/gemini.ts`) | Key stays in a request header, no extra dependency | P4-01 |
| Email | Resend REST API (no SDK); `nodemailer` for SMTP | Transactional email | P1-05, P1-35 ☑ |
| Test a11y | `@axe-core/playwright` | Automated accessibility checks | P0-06 ☑ |

## 4. Architectural Rules

1. **Layering:** `app/` (UI + route handlers) → `server/modules/*` (services) → `server/db` / `server/integrations`. Never skip a layer: UI and route handlers never import Prisma directly.
2. **Module ownership:** each module owns its tables and business rules. Other modules call its public service functions (`server/modules/<name>/index.ts`), never its internals or its tables.
3. **Authorization lives in services.** Every service function receives an explicit `actor` (session user or `null`) and checks permissions itself. Route handlers do authentication; services do authorization.
4. **Validation at boundaries:** all route handler inputs parsed with Zod schemas from `src/lib/schemas/`.
5. **Server Components read via services**; mutations go through route handlers (`/api/*`) so one contract serves UI and future clients. Server Actions: **not used** (none in the codebase — keeps a single API contract).
6. **Secrets** only in server code. Files importing secrets start with `import "server-only"`.
7. **No microservices**, no message queues. Background work is the daily jobs (§12b); everything else runs inline in the request.
8. **Provider abstraction** for replaceable integrations (email, media, AI): modules depend on an interface in `server/integrations/<kind>/types.ts`. Tests use a fake AI provider (`tests/helpers/fake-ai.ts`), so no test calls Gemini.

## 5. Folder Structure

```
src/
├── app/
│   ├── (marketing)/page.tsx            # Landing (signed-out)
│   ├── (auth)/sign-in, sign-up, forgot-password, reset-password, verify-email, confirm-age, account-deletion
│   ├── (app)/                          # Authenticated shell (nav)
│   │   ├── feed/
│   │   ├── explore/ , explore/skills/
│   │   ├── search/
│   │   ├── s/[slug]/                   # Skill page
│   │   ├── t/[slug]/                   # Theme page
│   │   ├── saved/ , saved/[id]/        # Saves and collections
│   │   ├── u/[username]/               # Public profile
│   │   ├── profile/ , profile/followers, profile/following   # Own profile
│   │   ├── journal/                    # Project journal list
│   │   ├── companion/ , new, [id]      # AI companion
│   │   ├── community/ , circles/ (new, [slug]), help/ (new, [id]), sessions/ (new)
│   │   ├── messages/ , [id]            # Direct messages
│   │   ├── notifications/
│   │   ├── settings/                   # account (+ delete), ai, blocked, messages, notifications, privacy, profile, skills
│   │   └── shell-preview/
│   ├── p/[id]/                         # Post detail (full screen, outside the shell group)
│   ├── projects/[id]/                  # Journal project
│   ├── create/ , create/[id]/          # Create and edit a post
│   ├── onboarding/                     # Full screen, outside the shell
│   ├── admin/                          # ADMIN (MODERATOR: reports only): posts, skills, themes, reports, coverage, ai
│   ├── dev/ui/                         # Primitive preview, APP_ENV=local only
│   ├── api/                            # Route handlers (see API_SPECIFICATION.md)
│   │   ├── auth/[...nextauth]/route.ts
│   │   └── account, admin, ai, blocks, collections, comments, communities, community-posts,
│   │       conversations, cron, explore, feed, follows, help-requests, help-responses, me, media,
│   │       messages, notifications, posts, profiles, projects, reports, saves, search, sessions,
│   │       skills, themes
│   ├── offline/page.tsx
│   ├── manifest.ts , robots.ts
│   ├── sw.ts                           # Service worker source (Serwist)
│   └── serwist/[path]/                 # Serves the service worker
├── proxy.ts                            # Optimistic cookie-only route checks (§6)
├── components/
│   ├── ui/                             # shadcn primitives (restyled), voice input
│   └── admin/ auth/ collections/ comments/ community/ companion/ create/ dev/ explore/ feed/
│       journal/ layout/ marketing/ messages/ notifications/ onboarding/ posts/ profile/
│       providers/ pwa/ reports/ safety/ search/ sessions/ settings/ skills/
├── hooks/                              # Domain-free client hooks: use-is-online, use-unsaved-changes, use-voice-typing
├── server/
│   ├── auth/                           # Auth.js config, adapter, callbacks, session helpers, password utils
│   ├── db/                             # Prisma client singleton
│   ├── modules/                        # See §5.1
│   ├── integrations/
│   │   ├── email/   (resend and smtp implementations)
│   │   ├── media/   (cloudinary implementation)
│   │   └── ai/      (Gemini implementation behind AIProvider)
│   └── lib/                            # env, errors, logger, rate-limit, pagination, route-handler, actor, client-ip, origin
├── lib/
│   ├── api-client/                     # Typed browser → /api calls
│   ├── constants/                      # Cross-cutting constants (media, offline, pagination, …)
│   ├── schemas/                        # Zod schemas shared client/server
│   ├── security-headers.ts             # CSP and other response headers
│   ├── types/
│   └── utils/
├── generated/prisma/                   # Prisma client, written by `prisma generate` (git-ignored)
└── styles/
    ├── globals.css
    └── tokens.css
prisma/
├── schema.prisma
├── migrations/
└── seed/                               # reference data + content import
scripts/                                # daily-jobs.ts, generate-icons.ts
seed-content/                           # JSON + media files for import (posts/, media/)
tests/
├── integration/
├── e2e/
├── ai-evals/                           # Real-provider evals, run on demand (`pnpm test:ai-evals`)
└── helpers/                            # incl. the fake AI provider
vercel.json                             # Region, deploy branch, daily cron
```

Module folders hold `index.ts` (public API) and, as needed, `service.ts` (business rules and authorization), `repository.ts` (Prisma queries) and `policies.ts` (authorization rules). Larger modules split by feature (`content`, `users`, `skills`). Zod schemas live in `src/lib/schemas/`, not in the modules. Unit tests sit beside the code (`*.test.ts`); database-backed tests are in `tests/integration/`.

### 5.1 Modules (`src/server/modules/`)

| Module | Owns / does |
|---|---|
| `users` | Accounts, registration, tokens, profiles, onboarding, user skills, roles, blocks (reads, incl. `notBlockedWith`), message settings, account deletion |
| `skills` | Skills, custom interests, normalization, blocklist, relations |
| `content` | Posts (seed/admin and member-authored), media assets, themes, post progress, seed import and coverage |
| `feed` | Ranking, feedback, feed sessions and impressions (§7) |
| `collections` | Saves and collections |
| `library` | Saves and collections shown as post cards (sits above `content` and `collections`) |
| `search` | Search and Explore; no tables, combines the owning modules |
| `journal` | Projects, materials and entries (private by default) |
| `comments`, `likes`, `follows` | Comments, post likes, follows |
| `notifications` | Notifications and preferences; called by comments, likes, follows, help and sessions |
| `blocks` | Block, unblock, list (over the block reads in `users`); removes follows and notifications between the two and cancels their open sessions |
| `reports` | Reports and moderation for posts, comments, skills, profiles, communities, help, messages and AI answers; MODERATOR role. No separate moderation module |
| `admin` | Audit log, admin operations |
| `ai` | Conversations, messages, consents, usage, feedback, planning, the AI kill switch (`AppSetting`) (§12d) |
| `help` | Help requests and responses |
| `communities` | Communities, members, discussions, moderation log |
| `messages` | Direct conversations and messages |
| `sessions` | Creative sessions |
| `jobs` | Daily maintenance (§12b) |

**Dependencies as built** (each module calls the others' public `index.ts` only; no cycles):

| Module | Uses |
|---|---|
| `skills` | admin |
| `users` | skills |
| `collections` | users |
| `content` | admin, collections, skills, users |
| `search` | collections, content, skills, users |
| `journal` | content, skills, users |
| `notifications` | content, users |
| `comments`, `likes`, `follows` | content, notifications, users |
| `blocks` | follows, notifications, sessions, users |
| `help` | content, notifications, skills, users |
| `communities` | content, skills, users |
| `messages` | content, follows, users |
| `sessions` | content, help, notifications, users |
| `library` | collections, content, follows, messages, users |
| `feed` | collections, content, follows, help, skills, users |
| `ai` | admin, content, skills, users |
| `reports` | admin, ai, comments, communities, content, help, messages, skills, users |
| `jobs` | ai, comments, communities, content, feed, notifications, sessions, users |

## 6. Authentication Architecture

- **Auth.js** v5 with an own minimal adapter (`src/server/auth/adapter.ts`: `getUser`, `getUserByAccount`) — `@auth/prisma-adapter` only supports Prisma ≤ 6. The `signIn` callback creates or links Google users in the users module (OD-09) before Auth.js looks the account up, so Auth.js never creates users itself. Providers: **Credentials** (email/password) and **Google**.
- **Route protection:** `src/proxy.ts` does an optimistic cookie-only check (it reads the JWT claims, never the database) and redirects to `/sign-in?returnTo=…`. It also sends signed-in users to `/confirm-age` until their age is confirmed, to onboarding until it is complete (admins skip it), and, for an account scheduled for deletion, to the deletion screen only. `/admin` shows 404 to everyone but ADMIN; MODERATOR may open `/admin/reports` only. Every page and route handler validates the session against the database through `getActor()` (`src/server/auth/session.ts`). Route handlers declare `auth: "public" | "user"` in `withRouteHandler`.
- **Session strategy: JWT** (CONFIRMED, required): Auth.js Credentials provider does not support database sessions. Immediate server-side revocation uses `User.sessionVersion` (claim `sv`): `getActor()` rejects a token whose `sv` no longer matches, and it is incremented on password reset, sign-out-everywhere and a link that removed a password. The cookie also carries `role`, `ev` (email verified), `ac` (age confirmed), `oc` (onboarding complete) and `dl` (deletion scheduled).
- Registration, email verification and password reset are **custom route handlers** (Auth.js does not provide password registration/reset). Tokens: random, stored **hashed**, single-use, expiring.
- Role on User: `USER` | `MODERATOR` | `ADMIN`. Services re-check authorization after the proxy.
- Account linking (Google ↔ password, same email): automatic in the `signIn` callback; password removed if the existing account was unverified (CONFIRMED, OD-09; SECURITY §2.6).

## 7. Feed Ranking (Phase 1)

Rules-based, computed per request in `server/modules/feed`. **CONFIRMED by the PO (2026-10-26, P1-21)**; every number is a constant in `src/server/modules/feed/config.ts` for tuning.

**Candidate pool:** published posts, excluding: posts the user hid ("not interested"), posts already served in this feed session, and posts by users blocked either way.

**Score** = `interestMatch` + `levelFit` + `freshness` + `saveAffinity` + `followBoost` − `negativeFeedbackPenalty`, then **diversity re-ranking**.

| Signal | Rule (CONFIRMED) |
|---|---|
| interestMatch | +3 per post skill in user's interests |
| levelFit | +1 if post difficulty ≤ one step above user's level for the post's main skill; no level given = Curious; posts without difficulty get 0 |
| freshness | decays with post age (e.g. +2 if < 7 days, +1 if < 30 days) |
| saveAffinity | +1 per post skill that appears in user's saves from the last 30 days (0 until saving exists, P1-24) |
| negativeFeedbackPenalty | −2 per post skill of posts the user marked "not interested" in the last 30 days (those posts are hidden for good) |
| followBoost | +4 per post by a maker the user follows (P2-06, FLW-04; PROPOSED size, PO to confirm; `FEED_CONFIG.followBoost`). The **Following** filter shows only followed makers' posts, with no discovery quota |
| Discovery quota | ≥ 20% of each For you page drawn from posts with no skill among the user's interests (when such posts exist), replacing the lowest-ranked interest posts |
| Diversity | no more than 2 consecutive items with the same primary skill |

**Filters (FEED-13):** `for-you` = full ranking above · `skill:<slug>` = candidates restricted to that skill, same ranking without discovery quota · `new-to-you` = candidates restricted to skills outside the user's interests, ranked by freshness + level fit.

**Help request card (HLP-03):** one help request per For you page, for skills the member can help with, inserted at position 4 (or last if the page is shorter); page *n* shows the *n*-th newest match, so a request never repeats within a session (`getMatchingHelpRequests` in `help`).

**Skill suggestion (FEED-14, CONFIRMED):** pick an ACTIVE skill not in the user's interests, with `Skill.pitch` and ≥ 1 published beginner (Curious/Beginner) post; skills related (SkillRelation) to the user's interests first, then most beginner projects under an hour, then name. Inserted as the first item of page 1 of a **For you** session only (not on skill chips or New to you); desktop shows it in the right rail (`/api/feed/suggestion`). No dismiss in P1. Candidate pool: the newest 1,000 published posts with media.

**Pagination & no-repeat (FEED-09):** a `feedSessionId` is created on first page load (returned to client); served post IDs are recorded server-side (FeedImpression table, with the page and position each was served on) and excluded on subsequent pages; asking for the same page again (a retry) returns the same posts (P1-22). Cursor encodes session ID + page index. Session expiry CONFIRMED: 24h; an expired or foreign session answers `400 FEED_SESSION_EXPIRED` and the client starts again.

## 8. Media Architecture

- Storage and delivery: **Cloudinary** (CONFIRMED). Database stores only metadata (`MediaAsset`), never binary data.
- **Upload flow (signed direct upload):**
  1. Client requests a signature: `POST /api/media/sign` with a `purpose`: `post`, `cover`, `avatar`, `entry`, `ai`, `help` or `community`. Any signed-in user may upload every purpose except `cover` (admin only); a non-permitted caller gets 404. Rate-limited per user (`media-sign-user`).
  2. Server validates intended type/size against limits (PRODUCT_REQUIREMENTS §5.8b; `media-rules.ts`), returns a signed, short-lived upload signature restricted to the folder `dodoi/<APP_ENV>/<purpose folder>` and a resource type.
  3. Client uploads directly to Cloudinary (progress shown).
  4. Client calls `POST /api/media` with the returned `public_id`; server verifies the asset via Cloudinary Admin API (type, size, dimensions, duration) before creating `MediaAsset`.
- Delivery: Cloudinary URLs with `f_auto,q_auto` and width variants; `width`/`height` stored to prevent layout shift.
- Limits (`src/server/modules/content/media-rules.ts`): images jpg / png / webp / heic, 10 MB (avatars 5 MB); video mp4 / mov / webm, 50 MB and 60 s, for `post` only (MEDIA-03). Poster generated by Cloudinary; no feed autoplay, no preload (FEED-12).
- Deletion: deleting a `MediaAsset` deletes the Cloudinary asset (via service). Media never attached to anything is deleted after 24 hours by the `delete-orphaned-media` daily job (§12b).
- Free-tier quotas must be checked in the Cloudinary dashboard; usage monitored manually in MVP.

## 9. PWA and Offline Strategy

- Manifest via `app/manifest.ts`; icons 192, 512 and maskable, plus favicon and Apple touch icon, from design `1a` "Coral" (PO choice 2026-10-27), generated by `pnpm icons`.
- Service worker via Serwist (`src/app/sw.ts`, `@serwist/turbopack`), served at `/serwist/sw.js` with `Cache-Control: no-cache`; not registered in `next dev`.

**Offline matrix (APPROVED by the PO 2026-10-27; built in P1-27):**

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

**Sign-out and account deletion** first delete the cached pages and images (`clearOfflineData()`, `src/lib/utils/clear-offline-data.ts`), so the next person on the device can't open them. Every log-out entry point (sidebar, profile card, Settings → Account, account-deletion screens) goes through `useSignOut()` in `src/components/auth/sign-out-button.tsx`.

As built: "previously visited pages" are the feed, posts, saved and collections, Explore, skill and theme pages (`src/lib/constants/offline.ts`), at most 50 for 7 days; a redirect is never kept as a page. "Marked stale" is the offline banner, which stays while offline. Images are fetched with CORS (Cloudinary allows it) so cached copies aren't opaque; the CSP's `connect-src` therefore includes `res.cloudinary.com`, or the service worker's fetch is blocked and images break. Signing out or deleting the account deletes both caches, so the next person on a shared device can't open them.

## 10. Search Architecture

- `pg_trgm` extension enabled in the first migration.
- Posts: generated `tsvector` column (title A, description B, skills C) with GIN index; plus trigram GIN index on title for partial/typo matches.
- Skills: trigram index on `name`; profiles: trigram on `username` and `displayName`.
- Prisma does not model `tsvector` natively: columns/indexes created in raw SQL migrations; queries via `prisma.$queryRaw` with tagged templates (parameterized — never string-concatenated).
- Query ranking: `ts_rank` combined with trigram `similarity`, thresholds as PROPOSED constants.

## 11. Error Handling and Observability

- Services throw typed `AppError` subclasses (`ValidationError`, `UnauthenticatedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `PayloadTooLargeError`, `UnprocessableError`, `ServiceUnavailableError`, `RateLimitError`). A single route-handler wrapper maps them to the API error format.
- Unexpected errors → 500 with generic message + `requestId`; full details logged server-side.
- Logger: structured JSON to stdout with `requestId`, `userId` (when authenticated), route, latency. **Never log** passwords, tokens, email bodies, private content.
- Error monitoring / analytics services: OPEN (OD-20, OD-21).
- Admin actions → `AuditLog` table.

## 12. Rate Limiting

Applied per user or IP, by named rule, on: register, sign-in, password reset, password change, resend verification, account deletion, media sign, search, custom skill creation, reports, comments, likes, follows, publishing a member post, AI messages (per minute and per day) and AI photos, help requests and responses, community and community-post creation, starting a conversation and sending a message. Storage: PostgreSQL `RateLimitBucket` table, fixed window (CONFIRMED, OD-27). The limiter must sit behind an interface so the backing store can change.

## 12b. Scheduled Jobs

Daily maintenance, `pnpm jobs:daily` (`scripts/daily-jobs.ts`, `src/server/modules/jobs`). Jobs run in this order: `delete-accounts` (past the 14-day grace period, and unverified accounts older than 30 days), `purge-auth-tokens` (spent tokens), `purge-feed-sessions` (7 days after expiry), `purge-ai-conversations` (chats after 30 days, with their photos), `purge-ai-usage` (after 12 months), `purge-notifications` (after 90 days), `settle-sessions` (saves Completed and lapsed creative sessions, erases meeting links 24 hours after they end), `purge-rate-limit-buckets` (older than the longest window) and `delete-orphaned-media` (unattached for 24 hours). Session reminders are not a job: they are created when a member reads their sessions or notifications (no hourly cron on Hobby). Every job is idempotent and runs even if an earlier one failed; the command exits 1 if any failed. On hosted environments Vercel Cron calls `GET /api/cron/daily` once a day (21:00 UTC, `vercel.json`) with `Authorization: Bearer <CRON_SECRET>`; without the secret the route answers 404. `CRON_SECRET` is required outside local.

## 12c. Voice typing (P2-10, approved and built 2026-10-30)

A client-only capability: `useVoiceTyping` (`src/hooks/use-voice-typing.ts`) wraps the browser's `SpeechRecognition` / `webkitSpeechRecognition`, and `VoiceInputButton` (`components/ui/`) is placed in text boxes by the features that own them (AI chat and Plan a project, messages, create post, journal entries, comments, help requests). No server module, route, table, env variable or dependency is added; no audio leaves the browser towards dodoi. The service worker needs no change (nothing to cache). The only platform change is `Permissions-Policy: microphone=(self)` (SECURITY §11). The feature module imports the shared component; modules do not import each other's internals (§4).

## 12d. AI companion (P4)

- **Layers:** route handlers `/api/ai/*` (`/api/ai/messages` and `/api/ai/plan` set `maxDuration = 60`) → `ai` module → `AIProvider` (`src/server/integrations/ai/types.ts`) → Gemini adapter (`gemini.ts`, plain REST, key in the `x-goog-api-key` header, safety filters at block-medium-and-above on every request, one retry on 500 / 503, 25 s per try). Prompts are versioned in `src/server/modules/ai/prompts/` (companion, plan). The `ai` module reads `content` for the post or skill in view, `users` for interests and `skills`; it stores its own tables only.
- **Gates before any model call:** `AI_ENABLED`, the admin kill switch (`AppSetting`, `PUT /api/admin/ai/switch`, audited), verified account, consent (photos need their own), own-photo and context authorization, per-user quotas (10 a minute, 30 a day, 5 photos a day → `429 AI_QUOTA` with the reset time) and the global daily cap `AI_DAILY_REQUEST_CAP`. Provider failure answers `AI_UNAVAILABLE`, a blocked answer `AI_BLOCKED`.
- **Data:** usage rows hold no text (admin dashboard `/admin/ai`); conversations and their photos are purged after 30 days, usage after 12 months (§12b). A project plan is not stored; "Start as my project" creates a private journal project through `journal`.
- **Environment:** `AI_TIER=free` lets Google use submitted content, so it is refused in production (`src/server/lib/env.ts`). Tests use the fake provider (`tests/helpers/fake-ai.ts`); real-provider evals run on demand from `tests/ai-evals/`.
- Spec: [AI_INTEGRATION.md](AI_INTEGRATION.md).

## 12e. Community features (P3)

- **Modules:** `help`, `communities`, `messages` and `sessions` each own their tables and call `content`, `users`, `skills`, `notifications` or `follows` only through public `index.ts` (§5.1). `reports` hides and restores their content; `blocks` ends follows and cancels sessions between two users, and `messages` refuses blocked pairs.
- **Messaging uses polling, not sockets** (ADR 0008): an open conversation polls for new messages every 10 s (`after` cursor); the conversation list, the unread dot and the notification bell poll every 60 s and stop in a background tab.
- **Creative sessions:** Completed and lapsed states are worked out when read and saved by the daily `settle-sessions` job; the one-hour reminder notification is created when the member reads their sessions or notifications.
- **Media:** purposes `help` and `community` (§8).

## 13. Environments

Three application environments (CONFIRMED) plus automated test runs:

| Environment | `APP_ENV` | Purpose | Where | Data |
|---|---|---|---|---|
| **Local development** | `local` | Developers run the app on their machine | Docker PostgreSQL (`dodoi`), `pnpm dev` | Disposable dev data |
| **Test** (hosted QA) | `test` | PO and testers try features before production | Vercel Hobby (`sin1`) + Neon Postgres (Singapore), OD-01 decided for test 2026-10-27; setup in [DEPLOYMENT.md](DEPLOYMENT.md) | Own database; seed + test accounts only, never real user data |
| **Production** | `production` | Real users | Hosting OPEN (OD-01) | Real user data |
| *Automated test runs* | *(not an app environment)* | Vitest / Playwright locally and in CI | Local `dodoi_test` DB; CI Postgres service container (OD-24) | Created and wiped by the tests |

**Naming:** "Test environment" always means the hosted QA site. Automated tests are called "automated test runs"; they run with `NODE_ENV=test`. `APP_ENV` (not `NODE_ENV`) identifies the deployed environment, because both hosted environments build with `NODE_ENV=production`.

**Isolation (CONFIRMED — fully separate):** each environment has its own database, Auth.js secret, Google OAuth client (with its own redirect URIs), Cloudinary account or product environment, and email credentials (Resend API key / sending domain, or the test site's own SMTP account). No secret or database is shared, and test data never touches production.

**Promotion flow (PROPOSED):** feature branch → PR (CI green) → merge to `main` → automatic deploy to **test** → PO verifies → production deploy from a version tag (`vX.Y.Z`) after PO approval. Database migrations run with `prisma migrate deploy` as part of each deploy; never `migrate dev` outside local.

**Environment-specific behaviour:**
- Non-production environments send `X-Robots-Tag: noindex` and disallow all crawling in `robots.txt`. No on-screen badge (removed at PO request, 2026-10-28).
- Seed/import scripts refuse to run against `APP_ENV=production` unless an explicit confirmation flag is passed (PROPOSED).
- `/dev/ui` (primitive preview) answers 404 unless `APP_ENV=local`.
- Test-only helpers (e.g. E2E sign-in route) are enabled only in automated test runs, never in the hosted test or production environments.

Production readiness note: polling-based messaging and stateless JWT sessions are both compatible with serverless hosting if chosen later.

## 14. Architecture Decision Records

ADRs live in [`docs/adr/`](adr/README.md). Template: Status · Date · Context · Decision · Alternatives · Consequences.

| ADR | Title | Status |
|---|---|---|
| 0001 | Modular monolith in Next.js | Accepted |
| 0002 | PostgreSQL + Prisma | Accepted |
| 0003 | Auth.js with Credentials + Google, JWT sessions | Accepted |
| 0004 | Cloudinary for media with signed direct uploads | Accepted |
| 0005 | PostgreSQL full-text + pg_trgm for search | Accepted |
| 0006 | Tailwind + shadcn/ui | Accepted |
| 0007 | Rules-based feed ranking | Accepted |
| 0008 | Polling for messaging | Accepted |
| 0009 | Three environments; hosting deferred | Accepted |
