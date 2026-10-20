# Implementation Plan — dodoi

Phase-wise, dependency-ordered plan from an empty repository to a public MVP and beyond. Each task is sized for **one focused AI coding session** and has acceptance criteria. Task IDs are used in branch names, commit messages and session summaries (AI_DEVELOPMENT_RULES §11).

**Rules**
- A task whose dependencies include an OPEN decision or an unapproved PROPOSED item must not start until it is resolved (AI_DEVELOPMENT_RULES §2).
- Every task follows the feature workflow (AI_DEVELOPMENT_RULES §3), the code standards ([CODE_QUALITY.md](../CODE_QUALITY.md)) and the Definition of Done (AI_DEVELOPMENT_RULES §10).
- One task = one branch = one pull request, merged only with green CI (from P0-09).

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
| OD-29 | Can signed-out visitors browse the feed, explore and post detail (read-only), or only the landing page? | Middleware rules, API permissions (`User*` endpoints), landing page, SEO | P1-07 |
| OD-30 | Full predefined skill list (landing claims "40+ crafts") + each skill's description, `pitch` and `hint` text | Skills seed | P1-02 |
| OD-31 | Minimum seed content per skill (and per post type) for launch | Seed production, launch gate | P1-19 |
| OD-32 | PostgreSQL text-search configuration: `simple` (language-neutral, handles Hindi/mixed names) or `english` (stemming) | Search migration | P1-01 |

**B. PROPOSED items to approve as a batch** (agents may not build on them until approved)

| Group | Items | Needed by |
|---|---|---|
| Libraries | Zod, React Hook Form, TanStack Query, Serwist, argon2, `cloudinary`, `resend`, Prettier + `prettier-plugin-tailwindcss`, `@axe-core/playwright`; optional `eslint-plugin-import` / `madge` (CODE_QUALITY §12) | P0-02 |
| New folders | `src/hooks/`, `src/lib/api-client/`, `src/lib/constants/` (CODE_QUALITY §3.1) | P0-01 |
| Data conventions | cuid ids, snake_case table mapping, text length limits, `Theme` entity, `Post.seedKey`, `PostProgress` shape | P1-01 |
| Auth & security parameters | JWT sessions (required by Credentials), Argon2id, password min length (8 or 10), token expiry 24h/1h, session max age 30 days, rate-limit numbers, CSP baseline, `/admin` → 404 for non-admins | P1-04 |
| Behaviour details | Unsave removes the post from all collections; search suggestions from 2 characters; install prompt after first save / second visit, re-show after 30 days; no offline mutation queue in P1 | P1-24, P1-27 |
| Feed | Ranking weights, 20% discovery quota, diversity rule, suggestion-card rules, feed session expiry 24h | P1-21 (can start; tune later) |
| PWA | Offline matrix (SYSTEM_ARCHITECTURE §9) | P1-27 |
| Retention | Feed sessions 7 days, orphan media 24h, daily cleanup trigger, audit-log retention | P1-28 |
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
| P0-04 | shadcn/ui init; `tokens.css` with all design tokens (UI_UX §2: palette, semantic, patterns, type scale, radii, shadows, motion, focus ring); Tailwind theme mapping; DM Sans via `next/font` | M | AI | P0-01 | `src/styles/*`, `tailwind` config, pattern utilities | Token-driven Button renders; no raw hex outside `tokens.css`; reduced-motion respected | ☐ |
| P0-05 | Server lib: `AppError` hierarchy, `withRouteHandler` wrapper, error format, logger (requestId), cursor pagination helpers, `Actor` type | M | AI | P0-01 | `src/server/lib/*` | Unit tests for error mapping, cursor encode/decode | ☑ |
| P0-06 | Vitest + Testing Library; Playwright + axe; test DB (`app_test`), factories/helpers skeleton; fake providers (email, media) | M | AI | P0-03 | Configs, `tests/helpers/*` | `pnpm test` and `pnpm test:e2e` run sample tests | ☑ |
| P0-07 | `.env.example`; env validation (server + client modules); `server-only` guards | S | AI | P0-01 | `server/lib/env.ts`, `lib/env-client.ts` | App fails fast with a clear message on missing env | ☐ |
| P0-08 | ADR folder with ADRs 0001–0009 (SYSTEM_ARCHITECTURE §14) | S | AI | P0-01 | `docs/adr/*` | Files exist per template | ☑ |
| P0-09 | GitHub Actions: lint, typecheck, format check, unit/integration (Postgres service), build, E2E; branch protection on `main`; secret scanning + push protection | M | AI+PO | P0-06, GitHub repo | `.github/workflows/*` | CI green on `main`; PRs blocked on failing checks | ☐ |
| P0-10 | Design-system primitives in `components/ui/`: Button, Chip (filter/interest/meta/skill/suggestion/dashed-add), SearchField, Tabs, Sheet, Dialog, Toast, Skeleton, EmptyState, ErrorState, FieldError, ErrorBanner, ComingSoonCard, "Soon" pill, PatternTile, Wordmark | L | AI+PO | P0-04 | Components + component tests | Match design `3b`/UI_UX §4; keyboard + focus ring; axe clean on a `/dev/ui` preview page (dev-only) | ☐ |
| P0-11 | ESLint boundary rules (`no-restricted-imports` for server/client and module internals), `no-console`, `no-explicit-any`; optional cycle detection if approved | S | AI | P0-01, P0-02 | `eslint` config | Violations fail `pnpm lint` (verified with a deliberate bad import) | ☑ |

**Exit (M0):** README setup works from a clean clone; CI green; `/dev/ui` shows all primitives matching the design.

---

## 3. Phase 1 — Discovery Foundation (MVP)

### 3.1 Milestone M1 — Data & Identity

**Goal:** schema in place; users can register (with 18+ check), verify, sign in (email or Google), reset passwords; rate limiting active.

| ID | Task | Size | Depends on | Acceptance criteria | Status |
|---|---|---|---|---|---|
| P1-01 | Prisma schema for all Phase 1 models (DATABASE_SCHEMA §3–4.7) + raw SQL migration (`pg_trgm`, `search_vector`, trigram indexes, report partial unique index) | M | P0-03, §0.2-B data conventions, OD-32 | `prisma validate` passes; migration applies on empty DB; schema doc matches | ☐ |
| P1-02 | Skills reference seed: `skills.json` (names, slugs, accents, descriptions, pitch, hint, related pairs) + seed script; admin user promotion via `SEED_ADMIN_EMAIL` | S | P1-01, OD-30 | Idempotent `pnpm db:seed`; `normalizedName` unique | ☐ |
| P1-03 | Media integration: Cloudinary provider behind interface (sign with purpose/folder, verify metadata vs MEDIA-01…05, delete); orphan tracking | M | P0-05, Cloudinary account | Integration tests with fake provider: oversize/wrong type/>60 s rejected and deleted | ☐ |
| P1-04 | Auth.js: Credentials + Google, Prisma adapter, JWT with `sessionVersion` + role, `signIn` callback linking rules (OD-09), `Actor` from session, middleware protection with return URL | M | P1-01, §0.2-B auth params, OD-29, Google OAuth | Sign in/out both providers; tampered/stale JWT rejected; unverified-account linking removes password | ☐ |
| P1-05 | Registration with DOB 18+ check (DOB discarded); `POST /api/account/age` + `AGE_CHECK_REQUIRED` gate for Google sign-ups; username auto-generation; email verification via Resend; unverified-user gating (`EMAIL_NOT_VERIFIED`) | L | P1-04, Resend | AUTH-01/04/11; no enumeration; tokens hashed & single-use; DOB never stored/logged | ☐ |
| P1-06 | Password reset request/confirm; password change; `NO_PASSWORD_SET` | S | P1-05 | AUTH-05; other sessions invalidated after reset | ☐ |
| P1-08 | Rate limiter (interface + PostgreSQL `RateLimitBucket`) on auth, skill creation, search, media signing, reports | S | P1-01 | `429` + `Retry-After` after threshold (integration tests) | ☐ |
| P1-29 | Security headers + CSP; `Origin` check on mutations; open-redirect-safe return URLs | S | P0-05 | Header and origin tests pass | ☐ |

**Exit (M1):** integration tests for every auth rule pass (TESTING_STRATEGY §4).

### 3.2 Milestone M2 — App Shell, Auth UI, Onboarding, Profiles

**Goal:** a new user goes Welcome → sign up → verify → 3-step onboarding → (empty) feed; profiles viewable and editable.

| ID | Task | Size | Depends on | Acceptance criteria | Status |
|---|---|---|---|---|---|
| P1-26b | App shell: mobile header + bottom tab bar (Create/Community coming soon), tablet icon rail, desktop sidebar + right-rail slot; coming-soon nav treatment (DC-21); "Ask dodoi" pill as coming soon; `error.tsx` / `not-found.tsx` / loading boundaries | M | P0-10 | Matches `1c`/`2b`/`3c`; coming-soon items make no network calls; keyboard + screen-reader names | ☐ |
| P1-07 | Auth UI: Welcome (`1a`), sign up (with DOB), sign in, check email, verify, forgot/reset password, DOB step after Google, verify-email banner | M | P1-04–06, P1-26b | E2E-01/02/03/14; axe clean; built-from-system screens flagged for PO review | ☐ |
| P1-09 | Skills module: list/search, custom skill create-or-resolve (normalization, OD-13 rules, blocklist, verified email) | S | P1-02, P1-08 | " Crochet " → Crochet; blocked words rejected; unverified → 403 | ☐ |
| P1-10 | `/api/me/skills` (replace-set) + onboarding complete (min 3 interests) | S | P1-09 | Ownership enforced; < 3 interests → rejected | ☐ |
| P1-13 | Profile module: own profile get/patch (username rules, 30-day change limit), public profile with explicit projection, private profile view (OD-10), hidden profiles | M | P1-01, P1-05 | No private fields in public response; `409`/`422` username cases | ☐ |
| P1-12 | Avatar upload (media signing for `avatar` purpose, MEDIA-02) | S | P1-03, P1-13 | IMAGE only, owner-scoped, ≤ 5 MB | ☐ |
| P1-11 | Onboarding UI: step 1 interests (search, add your own, min 3, no Skip), step 2 familiarity, step 3 can-help-with; resume logic | M | P1-10, P1-07 | E2E-18; matches `1b` | ☐ |
| P1-14 | Profile UI: public profile (`1i` styling, docs skill groups), edit profile (avatar, name, username, bio, skill lists), first-visit username prompt, settings (account, interests, privacy) | M | P1-13, P1-12 | PRF criteria; unsaved-changes warning; E2E-10 | ☐ |

**Exit (M2):** E2E-01, -02, -03, -10, -14, -18 pass on mobile and desktop viewports.

### 3.3 Milestone M3 — Content Pipeline & Admin

**Goal:** admins can create, publish and curate seeded posts and themes; bulk import works; reports can be handled.

| ID | Task | Size | Depends on | Acceptance criteria | Status |
|---|---|---|---|---|---|
| P1-15 | Content module: post read models (card, detail incl. materials, steps, attribution, creator vs "via dodoi editors"), related posts, themes, search-vector update on save | M | P1-01 | Draft/unpublished → 404 for non-admins | ☐ |
| P1-16 | Admin API: posts CRUD, publish/unpublish (requires attribution + alt text), themes, skill edit/hide/related/pitch/hint, audit log | M | P1-15, P1-03 | Every mutation audited; non-admin → 404 | ☐ |
| P1-17 | Admin UI: posts list/editor (image + short video upload, steps, materials, attribution incl. CC BY/BY-SA, invited-creator author), themes, skills | L | P1-16, P1-26b | Admin publishes an image post and a video post end-to-end (E2E-12) | ☐ |
| P1-18 | Seed importer: `seed-content/posts/*.json` + media → Cloudinary, idempotent by `seedKey`, validates attribution and licenses | M | P1-16 | Re-run creates no duplicates; invalid license rejected | ☐ |
| P1-28b | Reporting: `POST /api/reports`, admin reports list + hide/dismiss, `Profile.isHidden`, report UI on custom skills and profiles | M | P1-16, P1-13 | RPT-01…05; actions audited | ☐ |
| P1-19 | **Seed content set** (PO-led): team originals, invited creators (with written permission + accounts), stock/CC filler; every item has attribution | L | OD-31, P1-18 | Meets OD-31 minimums; import passes | ☐ (start now) |

**Exit (M3):** seed content loaded locally; admin and report flows pass integration + E2E-12.

### 3.4 Milestone M4 — Discovery Core

**Goal:** personalised feed with filters and "New to you", post detail with persisted tutorial progress, saves and collections.

| ID | Task | Size | Depends on | Acceptance criteria | Status |
|---|---|---|---|---|---|
| P1-24 | Saves & collections module: idempotent save/unsave, collections CRUD, limits (100 / 1,000), unique names, delete keeps saves, visibility | M | P1-15 | COLL criteria; private collection → 404 for others | ☐ |
| P1-21 | Feed module: candidate pool, scoring, discovery quota, diversity, feed sessions + impressions (no repeats), filters (FEED-13), skill suggestion (FEED-14), not-interested feedback, `/api/feed/filters`, `/api/feed/suggestion` | L | P1-15, P1-10 | Unit test per rule; no repeats across pages; hidden posts excluded | ☐ |
| P1-20 | Post detail UI (`1e`/`2c`, full sidebar in P1): gallery, video (tap to play), tags/level/time, creator row or "via dodoi editors", attribution block, share, related posts, coming-soon Follow/Ask about this/Start as my project | M | P1-15, P1-26b | POST criteria; no empty sections; no CLS from media | ☐ |
| P1-20b | Tutorial progress: `PostProgress` API; materials checklist + step done/undo + "Next step" UI | M | P1-20 | E2E-17; other users cannot read/write progress | ☐ |
| P1-22 | Feed UI: masonry (2/2/3 columns), greeting, filter chips, "New to you" card (feed + right rail), "Help other makers" + "Live sessions" coming-soon cards, PostCard with save, not interested + undo, infinite scroll + Load more, all states | L | P1-21, P1-24, P1-26b | FEED criteria; E2E-06, E2E-15 | ☐ |
| P1-25 | Saved & collections UI: All saved, collection pages, collection picker sheet, rename/visibility/delete, profile Collections tab | M | P1-24, P1-26b | E2E-08, E2E-11 | ☐ |

**Exit (M4):** E2E-06, -07, -08, -11, -15, -17 pass.

### 3.5 Milestone M5 — Search & Explore

| ID | Task | Size | Depends on | Acceptance criteria | Status |
|---|---|---|---|---|---|
| P1-23 | Search module (FTS + trigram; posts, skills, creators; private/hidden excluded) + explore endpoint (themes, skills to try with hints, popular/new, beginner-friendly) | M | P1-15, P1-09, OD-32 | "croch" finds Crochet; custom skills findable; query limits enforced | ☐ |
| P1-26 | Explore (`1d`, "Use what you have" coming soon), search results (tabs), skill page, theme page | M | P1-23, P1-26b | SRCH criteria; no-result state; E2E-05, E2E-09 | ☐ |

**Exit (M5):** E2E-04, -05, -09 pass.

### 3.6 Milestone M6 — PWA, Lifecycle, Landing, Hardening

| ID | Task | Size | Depends on | Acceptance criteria | Status |
|---|---|---|---|---|---|
| P1-30 | Landing page (`2a`) incl. mobile welcome variant | S | P1-26b, OD-29 | Lighthouse accessibility ≥ 95 | ☐ |
| P1-27 | PWA: manifest, icons, service worker (Serwist) per approved offline matrix, offline page, offline banner, install guidance (Chromium + iOS) | M | Offline matrix approval, icons | Installable; offline fallback for uncached routes; E2E-13 | ☐ |
| P1-28 | Account deletion: deactivate, 14-day grace, cancel, hard-delete job; unverified-account (30-day) cleanup | M | P1-05, P1-33 | SECURITY §7.3 rules (integration tests); Cloudinary avatar deleted | ☐ |
| P1-33 | Daily jobs runner (`pnpm jobs:daily`): purge tokens, feed sessions, rate-limit buckets, orphan media; run deletion jobs. Trigger mechanism per deployment (OD-01) | S | P1-01 | Each job idempotent and tested | ☐ |
| P1-31 | Accessibility + performance pass on all P1 screens (mobile, tablet, desktop) | M | All UI tasks | axe: no serious/critical; keyboard walkthrough; CWV targets measured on mobile profile | ☐ |
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
