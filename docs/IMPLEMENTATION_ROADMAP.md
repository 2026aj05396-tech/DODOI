# Implementation Plan — dodoi

Phase-wise, dependency-ordered plan from an empty repository to a public MVP and beyond. Each task is sized for **one focused AI coding session** and has acceptance criteria. Task IDs are used in branch names, commit messages and session summaries (AI_DEVELOPMENT_RULES §11).

**Rules**
- A task whose dependencies include an OPEN decision or an unapproved PROPOSED item must not start until it is resolved (AI_DEVELOPMENT_RULES §2).
- Every task follows the feature workflow (AI_DEVELOPMENT_RULES §3), the code standards ([CODE_QUALITY.md](../CODE_QUALITY.md)) and the Definition of Done (AI_DEVELOPMENT_RULES §10).
- **Every UI task builds mobile, tablet and desktop together** (PO instruction, 2026-10-24): no screen ships mobile-only. Use the designed web layout when one exists (`2a`–`2c`, `3c`); otherwise build the wider layouts from the design system and include them in the PO review screenshots (390 / 834 / 1280px).
- One task = one branch = one pull request, merged only with green CI (from P0-09). **The product owner does all git operations** (AI_DEVELOPMENT_RULES §11): agents leave changes uncommitted and suggest a commit message.

**Legend**
- Status: ☐ not started · ◐ in progress · ☑ done
- Size: **S** ≈ 1 session · **M** ≈ 2 sessions · **L** ≈ 3+ sessions (split if it grows)
- Owner: **AI** = coding agent · **PO** = product owner (you) · **AI+PO** = agent builds, PO reviews/decides

---

## 0. Readiness Check (Go / No-Go before Phase 0)

### 0.1 Documentation status

| Area | Status |
|---|---|
| Product requirements, flows, UI/UX, architecture, schema, API, security, testing, AI, code quality, agent rules | ☑ Written |
| Design (`docs/design/dodoi-app-v3.dc.html`) | ☑ Imported; DC-01…DC-28 resolved |
| Open decisions needed for Phase 1 build | ☑ Resolved, except items in §0.2 |

### 0.2 Items to settle before / during early implementation

**A. Decisions not yet in the register (found while planning)**

| ID | Decision | Blocks | Needed by |
|---|---|---|---|
| OD-29 | ~~Signed-out browsing~~ — **RESOLVED:** landing + published post detail public; rest requires sign-in | — | — |
| OD-30 | ~~Skill list~~ — **RESOLVED:** `prisma/seed/skills.json` approved | — | — |
| OD-31 | Minimum seed content per skill (and per post type) for launch | Seed production, launch gate | P1-19 |
| OD-32 | ~~Text-search configuration~~ — **RESOLVED: `simple`** | — | — |

**B. PROPOSED items to approve as a batch** (agents may not build on them until approved)

| Group | Items | Needed by |
|---|---|---|
| Libraries | Zod, React Hook Form, TanStack Query, Serwist, argon2, `cloudinary`, `resend`, Prettier + `prettier-plugin-tailwindcss`, `@axe-core/playwright`; optional `eslint-plugin-import` / `madge` (CODE_QUALITY §12) | P0-02 |
| New folders | `src/hooks/`, `src/lib/api-client/`, `src/lib/constants/` (CODE_QUALITY §3.1) | P0-01 |
| Data conventions | ~~cuid ids, snake_case table mapping, text length limits, `Theme` entity, `Post.seedKey`, `PostProgress` shape~~ — **APPROVED** | — |
| Auth & security parameters | ~~JWT, Argon2id, password min 10, tokens 24h/1h, sessions 30 days, rate limits, CSP, `/admin` → 404~~ — **APPROVED** | — |
| Behaviour details | ~~Unsave removes the post from all collections~~ (APPROVED); search suggestions from 2 characters; install prompt after first save / second visit, re-show after 30 days; no offline mutation queue in P1 | P1-24, P1-27 |
| Feed | ~~Ranking weights, 20% discovery quota, diversity rule, suggestion-card rules, feed session expiry 24h~~ — **APPROVED** 2026-10-26 (tunable in `feed/config.ts`) | — |
| PWA | Offline matrix (SYSTEM_ARCHITECTURE §9) | P1-27 |
| Retention | ~~Feed sessions 7 days, orphan media 24h~~ (APPROVED); daily cleanup trigger, audit-log retention | P1-28 |
| Accessibility target | WCAG 2.2 AA | P1-31 |

**C. Accounts and assets (PO)**

| Item | Needed by |
|---|---|
| GitHub repository (private) | P0-09 |
| Google Cloud OAuth client (local redirect URI `http://localhost:3000/api/auth/callback/google`) | P1-04 |
| Resend account (test mode sends only to your own address until a domain is verified) | P1-05 |
| Cloudinary account (dev folder, unsigned uploads disabled) | P1-03 |
| Logo / app icon (PWA 192, 512, maskable) | P1-27 |
| Seed content production started (team originals, invited-creator permissions, stock/CC sourcing) — **longest lead time, start now** | P1-19 |

**D. Design file follow-ups (non-blocking; docs are authoritative)**
DC-21 "Soon" pill on nav items · DC-24 step done/undo + "Next step" · DC-27 no creator row on stock posts · DC-28 no Skip on step 1.

### 0.3 Verdict
- **Phase 0 can start** once §0.2-B *Libraries* and *New folders* are approved and the GitHub repo exists.
- **Phase 1** can proceed task by task; each task lists the item it waits on.

---

## 1. Delivery Overview

| Phase | Goal | Milestones | Exit |
|---|---|---|---|
| **0 — Setup** | Running empty app with DB, tooling, CI, design system primitives | M0 | Clone → README → app, tests, lint, CI all green |
| **1 — Discovery Foundation (MVP)** | Sign up, onboard, discover, save, return — mobile, tablet, desktop, installable | M1–M6 | Phase 1 exit criteria (§3.7) + pre-launch gate (§8) |
| **2 — Creative Expression** | Users publish work and interact safely | M7–M8 | Users can post, journal, comment, like, follow, report, block |
| **3 — Community & Peer Learning** | Communities, messaging, help requests, sessions | M9–M10 | Structured peer collaboration works safely |
| **4 — AI Creative Companion** | Context-aware AI help within cost limits | M11 | Safe, useful AI within quotas |
| **5 — Refinement & Growth** | Better recommendations, push, offline, performance | M12 | Retention and performance targets met |

### Critical path (Phase 1)
```
P0-01 → P0-03 → P1-01 → P1-04 → P1-05 → P1-10 → P1-11 ─┐
                  │                                      ├→ P1-21 → P1-22 → P1-31 → Launch gate
                  └→ P1-15 → P1-16 → P1-18 ──(seed)──────┘
P0-04 → P0-10 → P1-26b (app shell) → all UI tasks
P1-19 seed content production runs in parallel from day one (PO)
```

### Parallel work streams
| Stream | Tasks |
|---|---|
| Platform | P0-*, P1-01, P1-03, P1-08, P1-29, P1-33 |
| Identity | P1-04 → P1-07, P1-12 → P1-14, P1-28 |
| Content | P1-15 → P1-18, P1-28b |
| Discovery | P1-09, P1-10, P1-20 → P1-26 |
| Experience | P0-10, P1-26b, P1-27, P1-30, P1-31 |
| Content production (PO) | P1-19 |

---

## 2. Phase 0 — Project Setup (Milestone M0)

**Goal:** a developer or agent can clone the repo, follow README, and get a running app with database, tests, linting, CI and the design-system foundations.

| ID | Task | Size | Owner | Depends on | Deliverables | Acceptance criteria | Status |
|---|---|---|---|---|---|---|---|
| P0-01 | Scaffold Next.js (App Router, TS strict per CODE_QUALITY §6.1), Tailwind, ESLint, pnpm, `.nvmrc`, folder skeleton per SYSTEM_ARCHITECTURE §5 + approved folders; `@/` alias | S | AI | §0.2-B folders | `package.json`, `tsconfig.json`, `src/**` skeleton | `pnpm dev`, `pnpm lint`, `pnpm typecheck` pass | ☑ |
| P0-02 | Install approved libraries; record each with justification (ADR or README) | S | AI+PO | §0.2-B libraries | Updated `package.json`, ADR note | Only approved deps present; lockfile committed | ☑ |
| P0-03 | `docker-compose.yml` (PostgreSQL), Prisma init, `server/db` client singleton, `db:*` scripts | S | AI | P0-01 | Compose file, `prisma/schema.prisma` (empty), scripts | `docker compose up -d db` + `pnpm db:migrate` succeed | ☑ |
| P0-04 | shadcn/ui init; `tokens.css` with all design tokens (UI_UX §2: palette, semantic, patterns, type scale, radii, shadows, motion, focus ring); Tailwind theme mapping; DM Sans via `next/font` | M | AI | P0-01 | `src/styles/*`, `tailwind` config, pattern utilities | Token-driven Button renders; no raw hex outside `tokens.css`; reduced-motion respected | ☑ |
| P0-05 | Server lib: `AppError` hierarchy, `withRouteHandler` wrapper, error format, logger (requestId), cursor pagination helpers, `Actor` type | M | AI | P0-01 | `src/server/lib/*` | Unit tests for error mapping, cursor encode/decode | ☑ |
| P0-06 | Vitest + Testing Library; Playwright + axe; test DB (`app_test`), factories/helpers skeleton; fake providers (email, media) | M | AI | P0-03 | Configs, `tests/helpers/*` | `pnpm test` and `pnpm test:e2e` run sample tests | ☑ |
| P0-07 | `.env.example`; env validation (server + client modules); `server-only` guards | S | AI | P0-01 | `server/lib/env.ts`, `lib/env-client.ts` | App fails fast with a clear message on missing env | ☑ |
| P0-08 | ADR folder with ADRs 0001–0009 (SYSTEM_ARCHITECTURE §14) | S | AI | P0-01 | `docs/adr/*` | Files exist per template | ☑ |
| P0-09 | GitHub Actions CI (`.github/workflows/ci.yml`): lint, format check, typecheck, unit/component/integration tests with a Postgres service, production build + E2E on mobile and desktop; Playwright report uploaded on failure | M | AI+PO | P0-06, GitHub repo | `.github/workflows/ci.yml` | CI green on `main` after PO pushes the workflow. Branch protection and secret scanning skipped: free GitHub plan (OD-34) | ◐ |
| P0-10 | Design-system primitives in `components/ui/`: Button, Chip (filter/interest/meta/skill/suggestion/dashed-add), SearchField, Tabs, Sheet, Dialog, Toast, Skeleton, EmptyState, ErrorState, FieldError, ErrorBanner, ComingSoonCard, "Soon" pill, PatternTile, Wordmark | L | AI+PO | P0-04, OD-33 | Components + component tests | Match design `3b`/UI_UX §4; keyboard + focus ring; axe clean on a `/dev/ui` preview page (dev-only) | ☑ |
| P0-11 | ESLint boundary rules (`no-restricted-imports` for server/client and module internals), `no-console`, `no-explicit-any`; optional cycle detection if approved | S | AI | P0-01, P0-02 | `eslint` config | Violations fail `pnpm lint` (verified with a deliberate bad import) | ☑ |

**Exit (M0):** README setup works from a clean clone; CI green; `/dev/ui` shows all primitives matching the design.

---

## 3. Phase 1 — Discovery Foundation (MVP)

### 3.1 Milestone M1 — Data & Identity

**Goal:** schema in place; users can register (with 18+ check), verify, sign in (email or Google), reset passwords; rate limiting active.

| ID | Task | Size | Depends on | Acceptance criteria | Status |
|---|---|---|---|---|---|
| P1-01 | Prisma schema for all Phase 1 models (DATABASE_SCHEMA §3–4.7) + raw SQL migration (`pg_trgm`, `search_vector`, trigram indexes, report partial unique index) | M | P0-03 | `prisma validate` passes; migration applies on empty DB; schema doc matches | ☑ |
| P1-02 | Skills reference seed: `prisma/seed/skills.json` (51 approved skills, 32 related pairs) loaded by `seedPredefinedSkills()` in the skills module via `pnpm db:seed` (`tsx --conditions=react-server prisma/seed/index.ts`); refuses production without `--confirm-production`. Admin promotion via `SEED_ADMIN_EMAIL` moves to P1-04 (needs accounts) | S | P1-01 | Idempotent `pnpm db:seed` (second run: 0 created); `normalizedName` unique; custom duplicates promoted; hidden skills stay hidden | ☑ |
| P1-03 | Media integration: Cloudinary over REST (no SDK) behind `server/integrations/media` (signed direct uploads with folder + `allowed_formats`, Admin API lookup/delete, `f_auto,q_auto` delivery); `content` module media service — sign (admin, 30/h), register with re-verification vs MEDIA-01…03 (non-compliant files deleted), alt text, `deleteOrphanedMedia` (24 h, run by P1-33); folders `dodoi/<APP_ENV>/{posts,covers,avatars}`, deletes refused outside `dodoi/` | M | P0-05, Cloudinary account | Integration tests with fake provider: oversize/wrong type/>60 s rejected and deleted; live check against the dev Cloudinary account (upload, lookup, delete, tampered signature refused) | ☑ |
| P1-04 | Auth.js v5 (`next-auth@5.0.0-beta.32`, pinned): Credentials + Google, own minimal adapter on our Prisma 7 client (`src/server/auth/adapter.ts`, instead of `@auth/prisma-adapter`, which supports Prisma ≤ 6), JWT with `sessionVersion` + role (DB check per request), `signIn` callback linking rules (OD-09) in the users module, `getActor()` from session, `withRouteHandler({ auth: "public" \| "user" })`, proxy protection with return URL (`src/proxy.ts`, cookie-only check); sign-in rate limits; promote `SEED_ADMIN_EMAIL` (verified email only) to ADMIN after sign-in, audit-logged; **username auto-generation moved here from P1-05** (Google sign-ups create the profile); minimal `/sign-in` page (P1-07 restyles it) | M | P1-01, Google OAuth client | Sign in/out both providers; tampered/stale JWT rejected; unverified-account linking removes password. Real Google sign-in confirmed by PO on localhost:3000 (2026-10-23) | ☑ |
| P1-05 | Registration with DOB 18+ check (DOB discarded; age by India calendar date); `POST /api/account/register` (201, or 409 `EMAIL_ALREADY_REGISTERED` for a taken email), then automatic sign-in (PO decisions: accepted enumeration risk, SECURITY §2.5); profile with username + display name from the email local-part; `POST /api/account/age` + `AGE_CHECK_REQUIRED` gate in `withRouteHandler` and proxy redirect to `/confirm-age` (every Google sign-in passes through it); email verification via Resend REST (`src/server/integrations/email`, no SDK) + resend; minimal `/sign-up`, `/verify-email`, `/confirm-age` pages (P1-07 restyles); unverified-user gating (`EMAIL_NOT_VERIFIED`) stays per feature (skills already) | L | P1-04, Resend | AUTH-01/04/11; tokens hashed & single-use; DOB never stored/logged. Real registration + verification email confirmed by PO on localhost:3000 (2026-10-24) | ☑ |
| P1-06 | Password reset request (always 204; lookup + email after the response via `after()`; Google-only accounts get "Set your password") / confirm (1h single-use token; all sessions signed out; unverified email becomes verified); password change (`POST /api/account/password`: `INVALID_CURRENT_PASSWORD`, `NO_PASSWORD_SET`, 5/15 min/user; other sessions signed out, current one gets a re-issued cookie); minimal `/forgot-password` and `/reset-password` pages + "Forgot password?" on sign-in (P1-07 restyles; change-password UI comes with Settings, P1-14) | S | P1-05 | AUTH-05; other sessions invalidated after reset (integration + E2E-03). Real reset email confirmed by PO on localhost:3000 (2026-10-24) | ☑ |
| P1-08 | Rate limiter (`src/server/lib/rate-limit.ts`): fixed window, PostgreSQL `RateLimitBucket` store behind an interface, atomic increment, hashed keys, `enforceRateLimit` → 429 + Retry-After, purge helper for P1-33. Each endpoint applies its own rule when it is built (limits per SECURITY §6, still PROPOSED) | S | P1-01 | `429` + `Retry-After` after threshold (integration test); exactly `limit` of concurrent attempts allowed | ☑ |
| P1-29 | Security headers (`src/lib/security-headers.ts` via `next.config.ts`: X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS in production, noindex outside production, no X-Powered-By); cross-site mutation rejection in `withRouteHandler` (`src/server/lib/origin.ts`, 403 `CROSS_ORIGIN_REQUEST`); `toSafeReturnPath()` for return URLs. static Content-Security-Policy (OD-35 option A) | S | P0-05 | Header, CSP, origin and return-path tests pass (unit + E2E); no CSP violations on rendered pages | ☑ |

**Exit (M1):** integration tests for every auth rule pass (TESTING_STRATEGY §4).

### 3.2 Milestone M2 — App Shell, Auth UI, Onboarding, Profiles

**Goal:** a new user goes Welcome → sign up → verify → 3-step onboarding → (empty) feed; profiles viewable and editable.

| ID | Task | Size | Depends on | Acceptance criteria | Status |
|---|---|---|---|---|---|
| P1-26b | App shell (`src/components/layout/`): mobile header + bottom tab bar, tablet 76px icon rail, desktop 232px sidebar, `PageWithRail` (300px right rail ≥ 1280px), coming-soon nav (pill or dot, tooltip, no navigation/requests), Ask dodoi pill/card (coming soon), skip link; root `not-found`, `error` (Next 16 `retry()`), `global-error`, `(app)/loading`; `Toaster` mounted in root layout; `/shell-preview` (local only) | M | P0-10 | Matches `1c`/`2b`/`3c`; coming-soon items make no network requests; axe clean on mobile, tablet and desktop | ☑ |
| P1-07 | Auth UI: Welcome at `/` — `1a` below 1024px, Landing `2a` from 1024px; auth screens split with the `2a` collage from 1024px, sign up (with DOB), sign in, check email, verify, forgot/reset password, DOB step after Google, verify-email banner in the app shell; official Google "G" logo; Google cancel → "Google sign-in was cancelled." | M | P1-04–06, P1-26b | E2E-01 (up to verify; onboarding/feed extend it later), E2E-02 (Google via local mock provider `oauth2-mock-server`), E2E-03, E2E-14; axe clean. Screens (390/834/1280) accepted by PO (2026-10-25) | ☑ |
| P1-09 | Skills module (`src/server/modules/skills/`): list (alphabetical, cursor) and search (prefix + trigram typo tolerance), skill detail with related skills, custom skill create-or-resolve (NFKC normalisation, 2–40 chars incl. Indian scripts, slug, accent, verified email, 10/day rate limit, hidden skills never revived, race-safe). Route handlers `GET/POST /api/skills` and `GET /api/skills/{slug}` wired in P1-04 (`/posts` waits for P1-15); skill `coverMedia` arrives with P1-03; blocklist = LDNOOBW English + Hinglish minus reviewed craft-safe exceptions (OD-36) | S | P1-02, P1-08 | " Crochet " → Crochet; blocked words rejected; unverified → 403 (integration tests) | ☑ |
| P1-10 | `GET/PUT /api/me/skills` (replace-set, ≤ 50, active skills only), `GET/PUT /api/me/onboarding` (saved resume step — new `user.onboarding_step` column), `POST /api/me/onboarding/complete` (min 3 interests); skipped familiarity = no level | S | P1-09 | Ownership enforced; < 3 interests → rejected (integration tests) | ☑ |
| P1-13 | Profile module: own profile get/patch (username rules, 30-day change limit), public profile with explicit projection, private profile view (OD-10), hidden profiles. Built: `users/profile.ts` (own get/patch, `getProfileForView`, skill groups) and `library` views (`/api/me/profile`, `/api/profiles/{username}`); offensive-word check on usernames/display names; hidden/deactivated → 404 (PO decisions 2026-10-27) | M | P1-01, P1-05 | No private fields in public response; `409`/`422` username cases | ☑ |
| P1-12 | Avatar upload (media signing for `avatar` purpose, MEDIA-02). Built: `canUploadMedia` lets any signed-in user sign/register `avatar` uploads; `getOwnAvatar` checks ownership when the profile is saved. Upload UI comes with Edit profile (P1-14) | S | P1-03, P1-13 | IMAGE only, owner-scoped, ≤ 5 MB | ☑ |
| P1-11 | Onboarding UI at `/onboarding` (full screen, outside the app shell): step 1 interests (`1b`: search with typo tolerance, add your own — verified email only, min 3, no Skip), step 2 familiarity, step 3 can-help-with (both skippable, built from system); resume at the saved step; session claim `oc` + proxy send unfinished users to onboarding (also from `/`); mobile, tablet and desktop | M | P1-10, P1-07 | E2E-18 (+ E2E-01 through onboarding); matches `1b`; axe clean. Screens (390/834/1280) reviewed by PO (2026-10-25) | ☑ |
| P1-14 | Profile UI: public profile (`1i` styling, docs skill groups), edit profile (avatar, name, username, bio, skill lists), first-visit username prompt, settings (account, interests, privacy). Built: `/u/{username}` (`1i` header, three skill groups per DC-08, tabs Projects/Posts coming soon + Collections), `/profile` → own profile, `/settings` with Edit profile (avatar upload, name, username with 30-day lock, bio), Your skills (one screen for interests + levels, can help, want to learn; ≥ 3 interests), Privacy, Account (email, change password or set one by email, sign out, delete coming soon until P1-28); username prompt dismissal stored on the account (migration `profile_username_prompt`); unsaved-changes warning (tab close + in-app links); PO decisions 2026-10-27 | M | P1-13, P1-12 | PRF criteria; unsaved-changes warning; E2E-10 (`profile.spec.ts`). **PO: review screens (390/834/1280)** | ◐ |

**Exit (M2):** E2E-01, -02, -03, -10, -14, -18 pass on mobile and desktop viewports.

### 3.3 Milestone M3 — Content Pipeline & Admin

**Goal:** admins can create, publish and curate seeded posts and themes; bulk import works; reports can be handled.

| ID | Task | Size | Depends on | Acceptance criteria | Status |
|---|---|---|---|---|---|
| P1-15 | Content module: post read models (card, detail incl. materials, steps, attribution, creator vs "via dodoi editors"; hidden/deactivated creators shown without creator row), related posts (12, most shared skills → same primary → newest), skill posts (newest first), themes (curated order), `refreshPostSearchIndex` for the admin editor; routes `GET /api/posts/{id}` + `/related` (public), `/api/skills/{slug}/posts`, `/api/themes`, `/api/themes/{slug}`; new `collections` module stub for `isSaved` | M | P1-01 | Draft/unpublished → 404 for non-admins (integration tests) | ☑ |
| P1-16 | Admin API: posts CRUD (drafts; up to 10 mixed images/videos), publish/unpublish with publish rules (active main skill, media, alt text, attribution per source type incl. CC BY/BY-SA only, stock link, invited creator account + permission), live edits re-checked, delete removes unused media; themes CRUD + ordered posts; skill edit/hide (any skill)/related/pitch/hint; `admin` module audit log written in the same transaction. Report actions are P1-28b | M | P1-15, P1-03 | Every mutation audited; non-admin → 404 (integration tests) | ☑ |
| P1-17 | Admin UI at `/admin` (proxy 404 for non-admins + database re-check in the layout): posts list (status filter, load more) and editor (basics, skills + main skill, up to 10 photos/videos with upload progress, alt text and reorder, materials, steps with optional photo, source/licence incl. invited creator; Save / Save and publish / Unpublish / Delete; publish problems on their fields), themes (list, create, edit, cover, publish, ordered posts), skills (all incl. hidden, edit, hide/show, related); `GET /api/admin/skills`; mobile, tablet and desktop | L | P1-16, P1-26b | Admin publishes an image post and a video post end-to-end (E2E-12, local Cloudinary Admin API mock). **PO: review screens (390/834/1280)** | ◐ |
| P1-18 | Seed importer: `seed-content/posts/*.json` + media → Cloudinary, idempotent by `seedKey`, validates attribution and licenses. Built as `importSeedContent()` (content module) + `pnpm seed:content [folder] [--check]`: skills by slug, per-file `publish`, file = source of truth on re-runs, media keyed by content hash (no re-uploads, replaced media deleted), server-side signed Cloudinary upload, `post.seed_import` audit; seed content git-ignored (PO decisions 2026-10-26) | M | P1-16 | Re-run creates no duplicates; invalid license rejected (integration tests) | ☑ |
| P1-28b | Reporting: `POST /api/reports`, admin reports list + hide/dismiss, `Profile.isHidden`, report UI on custom skills and profiles. Built: `reports` module (above admin/skills/users), `POST /api/reports` (username for profiles), admin Reports page grouped by target with Hide/Dismiss and Show again (Resolved), report dialog on profiles and custom skill pages, owner notice on hidden profiles with optional `SUPPORT_EMAIL` (PO decisions 2026-10-27) | M | P1-16, P1-13 | RPT-01…05; actions audited (integration + `reports.spec.ts`). **PO: review screens; set `SUPPORT_EMAIL` before launch** | ◐ |
| P1-19 | **Seed content set** (PO-led): team originals, invited creators (with written permission + accounts), stock/CC filler; every item has attribution | L | OD-31, P1-18 | Meets OD-31 minimums; import passes | ☐ (start now) |

**Exit (M3):** seed content loaded locally; admin and report flows pass integration + E2E-12.

### 3.4 Milestone M4 — Discovery Core

**Goal:** personalised feed with filters and "New to you", post detail with persisted tutorial progress, saves and collections.

| ID | Task | Size | Depends on | Acceptance criteria | Status |
|---|---|---|---|---|---|
| P1-24 | Saves & collections module: idempotent save/unsave, collections CRUD, limits (100 / 1,000), unique names, delete keeps saves, visibility Built: `collections` module (by post id) + `library` module (cards, since content depends on collections), routes under `/api/saves`, `/api/collections`, `/api/posts/{id}/collections`; adding to a collection saves first; most recently changed first (PO decisions 2026-10-26) | M | P1-15 | COLL criteria; private collection → 404 for others | ☑ |
| P1-21 | Feed module: candidate pool, scoring, discovery quota, diversity, feed sessions + impressions (no repeats), filters (FEED-13), skill suggestion (FEED-14), not-interested feedback, `/api/feed/filters`, `/api/feed/suggestion` Built as the `feed` module (rules in `ranking.ts`, numbers in `config.ts`); interests keep their added date across edits (chip order) | L | P1-15, P1-10 | Unit test per rule; no repeats across pages; hidden posts excluded | ☑ |
| P1-20 | Post detail UI (`1e`/`2c`, full sidebar in P1): gallery, video (tap to play), tags/level/time, creator row or "via dodoi editors", attribution block, share, related posts, coming-soon Follow/Ask about this/Start as my project. Built: `/p/[id]` (outside the proxy; app shell for signed-in, slim bar for signed-out), `PostCard` for related posts (feed reuses it), Save coming soon until P1-25 (PO decisions 2026-10-26) | M | P1-15, P1-26b | POST criteria; no empty sections; no CLS from media; E2E `post-detail.spec.ts` (E2E-07 minus skill page, P1-26). **PO: review screens (390/834/1280)** | ◐ |
| P1-20b | Tutorial progress: `PostProgress` API; materials checklist + step done/undo + "Next step" UI. Built: `GET/PUT /api/posts/{postId}/progress` (content module), optimistic ticks saved one request at a time (revert + toast on failure), "Next step" in the steps header, signed-out taps → sign-in and back (PO decisions 2026-10-26); admin edits and seed re-imports keep a material's id when its name is unchanged, so ticks survive | M | P1-20 | E2E-17; other users cannot read/write progress (integration tests). **PO: review screens (390/834/1280)** | ◐ |
| P1-22 | Feed UI: masonry (2/2/3 columns), greeting, filter chips, "New to you" card (feed + right rail), "Help other makers" + "Live sessions" coming-soon cards, PostCard with save, not interested + undo, infinite scroll + Load more, all states Built at `/feed` with TanStack Query (installed in this task): masonry by shortest column (2/2/3), greeting "today/tonight, first name", coming-soon search/bell/avatar, cards with working save, video tap-to-play, "⋯" Not interested / More like this, "Hidden. Undo", infinite scroll + Load more, all states; `/` and finished onboarding go to `/feed`; feed pages are repeatable (impressions keep page and position) | L | P1-21, P1-24, P1-26b | FEED criteria; E2E-06, E2E-15 (`feed.spec.ts`; the skill-page step of E2E-15 waits for P1-26). **PO: review screens (390/834/1280)** | ◐ |
| P1-25 | Saved & collections UI: All saved, collection pages, collection picker sheet, rename/visibility/delete, profile Collections tab (**moved to P1-14**, PO decision). Built: `/saved` (collections row with `1i` mosaic tiles, then All saved), `/saved/{id}` (rename, Private/Public, delete with confirm, remove with Undo; read-only for others when public), collection picker sheet (post page "Save to collection", "Add to collection" toast after saving), unsave toast Undo restores the save and its collections, shared saved state across cards; app-shell navs wrapped in Suspense for dynamic routes | M | P1-24, P1-26b | E2E-08, E2E-11 (`collections.spec.ts`). **PO: review screens (390/834/1280)** | ◐ |

**Exit (M4):** E2E-06, -07, -08, -11, -15, -17 pass.

### 3.5 Milestone M5 — Search & Explore

| ID | Task | Size | Depends on | Acceptance criteria | Status |
|---|---|---|---|---|---|
| P1-23 | Search module (FTS + trigram; posts, skills, creators; private/hidden excluded) + explore endpoint (themes, skills to try with hints, popular/new, beginner-friendly). Built: `search` module (no tables; queries in content/users/skills/collections), `GET /api/search`, `GET /api/explore` (`skillsToTry`, theme `postCount`); popular = saves topped up by post counts; 8/8/8/all/12 (PO decisions 2026-10-27) | M | P1-15, P1-09 | "croch" finds Crochet; custom skills findable; query limits enforced | ☑ |
| P1-26 | Explore (`1d`, "Use what you have" coming soon), search results (tabs), skill page, theme page. Built: `/explore` (1d sections, then Popular, New on dodoi, Beginner-friendly), `/explore/skills` (all skills A–Z with filter, from "See all"), `/search?q=&type=` (tabs All · Posts · Skills · Makers, "See all", no-results and empty states, skill suggestions from 2 characters), `/s/{slug}` (hint, description, "Add to my interests" via `PUT/DELETE /api/me/interests/{skillId}`, related skills, posts), `/t/{slug}`; skill chips, "Try it →" and the feed search field now link through; `SkillSummary.hint` (PO decisions 2026-10-27) | M | P1-23, P1-26b | SRCH criteria; no-result state; E2E-05, E2E-09, E2E-15 skill step (`search.spec.ts`). **PO: review screens (390/834/1280)** | ◐ |

**Exit (M5):** E2E-04, -05, -09 pass.

### 3.6 Milestone M6 — PWA, Lifecycle, Landing, Hardening

| ID | Task | Size | Depends on | Acceptance criteria | Status |
|---|---|---|---|---|---|
| P1-30 | Landing page hardening: `2a` (desktop) and `1a` (mobile) were built in P1-07 at `/`; P1-30 adds metadata/Open Graph, turns the header labels into links as features ship, Lighthouse pass. Built: landing moved to `src/app/(marketing)/page.tsx` (so its share image applies to `/` only); `metadataBase` from `AUTH_URL`; Open Graph + Twitter (`summary_large_image`) on landing and posts with shared defaults (`src/lib/constants/share-metadata.ts`); build-time share image `(marketing)/opengraph-image.tsx` (DM Sans TTFs in `assets/fonts`); canonical URLs; `robots.txt` (production: landing + `/p/` only; elsewhere disallow all); header "Discover" → `/explore` (Learn, Community, Companion stay labels) | S | P1-26b, OD-29 | axe: no serious/critical at 390/834/1280 (`smoke.spec.ts`); share metadata E2E. Lighthouse (PO, 2026-10-27, mobile, local): Accessibility 100, Best Practices 100, Performance 84 (dev server); SEO 66 locally because non-production sends `noindex` on purpose | ☑ |
| P1-27 | PWA: manifest, icons, service worker (Serwist) per approved offline matrix, offline page, offline banner, install guidance (Chromium + iOS) | M | Offline matrix approval, icons | Installable; offline fallback for uncached routes; E2E-13 | ☐ |
| P1-28 | Account deletion: deactivate, 14-day grace, cancel, hard-delete job; unverified-account (30-day) cleanup. Built: `DELETE /api/account` (password, or Google sign-in within 5 min), `POST /api/account/deletion/cancel`, `403 ACCOUNT_DELETION_SCHEDULED` gate, session claims `dl`/`at`, `/settings/account/delete`, blocking `/account-deletion` screen, hard delete in `jobs/account-cleanup.ts` (creator posts deleted, avatar + uploads deleted from Cloudinary); PO decisions 2026-10-27 | M | P1-05, P1-33 | SECURITY §7.3 rules (`account-deletion.test.ts`); Cloudinary avatar deleted; E2E `account-deletion.spec.ts`. **PO: review screens (390/834/1280)** | ◐ |
| P1-33 | Daily jobs runner (`pnpm jobs:daily`): purge tokens, feed sessions, rate-limit buckets, orphan media; run deletion jobs. Built in `src/server/modules/jobs` (each job independent; exit 1 on failure). Trigger on hosted environments set up with P1-35 (OD-01) | S | P1-01 | Each job idempotent and tested (`daily-jobs.test.ts`) | ☑ |
| P1-31 | Accessibility + performance pass on all P1 screens (mobile, tablet, desktop). Built: `accessibility.spec.ts` (axe on every P1 screen at 390/834/1280 + keyboard focus sweep); fixed the Explore "Use what you have" row (scrollable but not keyboard-reachable); responsive images (Cloudinary `srcSet` 320–1920px + `sizes` per slot, avatars at 256px — before, every image was sent at full upload size); masonry renders both layouts on the server (CSS picks one until hydration) so the first cards and their eager, high-priority images are in the HTML — before, the feed showed a skeleton until the JavaScript ran (PO Lighthouse on `/feed`: LCP 8.1 s on the dev server); the server's feed cards no longer fade in (an image at opacity 0 isn't counted as painted, ~550 ms of LCP render delay) and signed-in and post pages send `Link: rel=preconnect` to Cloudinary (feed LCP 0.42 s, 0.85 s throttled); hidden `h2` on the feed for heading order at 1280px; lab CWV baseline in TESTING_STRATEGY §8 (landing, post, sign-in all LCP < 1 s, CLS ≈ 0) | M | All UI tasks | axe: no serious/critical (automated, all screens, 3 widths); keyboard walkthrough; CWV targets measured on mobile profile. PO Lighthouse on `/feed` (production build): Accessibility 100, Best Practices 100, LCP 3.9 s estimated / ~1.0 s observed before the fade-in and preconnect fixes. **PO: re-run Lighthouse on `/feed` after those fixes; manual keyboard walkthrough (TESTING_STRATEGY §8b)** | ◐ |
| P1-35 | Test environment: provision hosting (OD-01), separate DB/OAuth/Cloudinary/Resend credentials, `APP_ENV=test`, auto-deploy from `main`, `migrate deploy`, noindex + TEST badge, scheduled jobs | S | OD-01, P0-09 | PO can sign up and use every Phase 1 feature on the hosted test site | ☐ |
| P1-34 | Full E2E suite (E2E-01…18) green in CI across mobile + desktop; WebKit/Firefox smoke subset | S | All above | CI green | ☐ |
| P1-32 | Analytics events (only if OD-19/OD-20 decided) | S | OD-19, OD-20 | Events documented; no sensitive data | ☐ (optional) |

### 3.7 Phase 1 Exit Criteria
- A new user can sign up, complete onboarding, discover content, save ideas, track tutorial progress and return to them, on mobile, tablet and desktop, installed or in the browser.
- All Phase 1 acceptance criteria in PRODUCT_REQUIREMENTS are met.
- Security checklist (SECURITY §10) passes for every endpoint; TESTING_STRATEGY §4 integration checklist and E2E-01…18 green.
- All built-from-system screens reviewed and approved by PO.
- Then: **pre-launch gate (§8)** before any public release.

---

## 4. Phase 2 — Creative Expression (Milestones M7–M8)

**Before starting:** write the Phase 2 specs (schema for Follow, Project, ProjectEntry, Comment, Reaction, Notification, Block, Tag; API contracts; flows) and decide **OD-25** (comment threading) and **OD-05** (content licensing for user uploads).

| ID | Task | Depends on |
|---|---|---|
| P2-00 | Phase 2 spec update (schema, API, flows, UI for create post / journal) — PO approval | Phase 1 done |
| P2-01 | User media uploads (MEDIA rules for all users) | P2-00 |
| P2-02 | Post create / preview / edit / delete (all post types, materials, steps, skills, tags) | P2-01 |
| P2-03 | Creative journal: projects + progress entries; "Start as my project" from a tutorial | P2-02 |
| P2-04 | Comments (threading per OD-25) | P2-02 |
| P2-05 | Single like with owner-only counts | P2-02 |
| P2-06 | Follow / unfollow; activate Follow buttons | P2-00 |
| P2-07 | In-app notifications + preferences | P2-04–06 |
| P2-08 | Reporting for posts/comments; blocking; moderation queue; MODERATOR role | P2-02 |
| P2-09 | Activate Create tab and Journal; remove their coming-soon states | P2-02, P2-03 |

**Exit:** users can publish work, document projects and interact safely.

## 5. Phase 3 — Community & Peer Learning (Milestones M9–M10)

**Before starting:** decide **OD-03** (video calls) and **OD-06** (community creation); write the Phase 3 specs.

| ID | Task |
|---|---|
| P3-00 | Phase 3 spec update |
| P3-01 | Communities: discover, join/leave, rules, discussions, moderation audit |
| P3-02 | Direct messaging via polling (participants-only, rate limits, report/block) |
| P3-03 | Help requests (open / in progress / resolved) + responses; activate "Help other makers" and the "Help request" feed card |
| P3-04 | Creative sessions: propose / accept / decline / reschedule / cancel, IST + user time zones; activate "Live sessions" |
| P3-05 | "Use what you have" (materials-based ideas, Phase 2/3 per DC-09) |

**Exit:** users can find relevant people and collaborate in a structured way.

## 6. Phase 4 — AI Creative Companion (Milestone M11)

**Before starting:** resolve AI_INTEGRATION §9 (provider **OD-02**, moderation, retention, quotas, streaming).

| ID | Task |
|---|---|
| P4-00 | AI spec finalisation + provider adapter |
| P4-01 | Companion chat endpoint with consent, quotas, moderation, usage logging |
| P4-02 | "Ask about this" docked companion (`2c`, sidebar → icon rail) and mobile companion (`1f`) |
| P4-03 | Project planning: materials checklist and steps generation |
| P4-04 | Image-aware troubleshooting (if model and cost allow) |
| P4-05 | Admin usage dashboard, global spend cap and kill switch |
| P4-06 | AI evaluation suite (TESTING_STRATEGY §7) |

**Exit:** safe, useful AI assistance within cost limits.

## 7. Phase 5 — Refinement & Growth (Milestone M12)

Recommendation improvements, cross-interest discovery, offline mutation queue, push notifications, performance work, advanced community tools, possible monetization (OD-04). Specced from measured data.

---

## 8. Pre-launch Gate (before any public release)

- [ ] Production environment provisioned (OD-01): own database, OAuth client, Cloudinary, Resend, secrets, HTTPS, scheduled jobs; deploy from version tag after PO sign-off on the test environment
- [ ] OD-26 privacy policy and terms of service published (DPDP notice, grievance contact, 18+ eligibility)
- [ ] OD-05 content licensing and takedown process documented
- [ ] Legal review of DPDP compliance and age-gate approach
- [ ] Resend sending domain verified; `EMAIL_FROM` on that domain
- [ ] Google OAuth consent screen published with production redirect URIs
- [ ] Database backups configured
- [ ] Free-tier quotas reviewed (Cloudinary, Resend, DB, host)
- [ ] OD-31 seed content minimums met
- [ ] Error monitoring decided (OD-21) or explicitly deferred

## 9. Tracking

- Update the **Status** column when a task starts (◐) and when it meets the Definition of Done (☑).
- New tasks get the next free ID in their phase; never reuse an ID.
- If scope changes, update this plan and the affected docs in the same change.
