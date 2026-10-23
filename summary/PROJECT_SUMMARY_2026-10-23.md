# dodoi — Project Summary (up to 2026-10-23)

Summary of the planning and build sessions so far. Source of truth stays in `README.md`, `docs/` and `CODE_QUALITY.md`.

## 1. What dodoi is
- Visual-first creative discovery and community **PWA** for hobbyists and makers ("Curiosity over perfection").
- **Launch market:** India first (English UI, INR, IST default, DPDP Act). **Users must be 18+** (date of birth checked, then discarded).
- **MVP = Phase 1 (Discovery Foundation):** auth, onboarding, feed, explore/search, post detail, saves/collections, profiles, PWA, seed content + admin.
- Later phases: P2 creative expression · P3 community/messaging · P4 AI companion · P5 growth.

## 2. Documentation set (all in repo)
| File | Purpose |
|---|---|
| `README.md` | Overview, decision log, setup, env vars |
| `CODE_QUALITY.md` | Naming, structure, architecture, components, TS, testing gates (root) |
| `docs/PRODUCT_REQUIREMENTS.md` | Requirements with IDs + open-decisions register (OD-xx) |
| `docs/USER_FLOWS.md`, `docs/UI_UX_GUIDELINES.md` | Journeys; design tokens/components (from Claude Design) |
| `docs/SYSTEM_ARCHITECTURE.md`, `docs/DATABASE_SCHEMA.md`, `docs/API_SPECIFICATION.md` | Stack, schema, API contracts |
| `docs/SECURITY_AND_PRIVACY.md`, `docs/AI_INTEGRATION.md`, `docs/TESTING_STRATEGY.md` | Security, AI (P4), tests |
| `docs/IMPLEMENTATION_ROADMAP.md` | Phase-wise plan, task IDs, status |
| `docs/AI_DEVELOPMENT_RULES.md` | Rules for AI agents (incl. **no git writes**) |
| `docs/adr/` | ADRs 0001–0009 |
| `docs/design/` | Exported Claude Design file `dodoi-app-v3.dc.html` (visual source of truth) |
| `THIRD_PARTY_NOTICES.md` | LDNOOBW blocklist attribution (CC BY 4.0) |

Markers used everywhere: **CONFIRMED** (decided) · **PROPOSED** (needs approval) · **OPEN** (undecided — agents must ask).

## 3. Key decisions (CONFIRMED)
- **Stack:** Next.js 16.4 (App Router, React 19.3, Turbopack, React Compiler, Cache Components) · TypeScript strict · Tailwind 4 + shadcn/ui (Radix) · **Lucide** icons · **DM Sans** font.
- **Backend:** modular monolith in Next.js (route handlers + `src/server/modules/*`); no Server Actions.
- **Data:** PostgreSQL + **Prisma 7.10.1** (pg adapter); cuid ids, snake_case tables; search = Postgres FTS (`simple`) + `pg_trgm`.
- **Auth:** Auth.js, Credentials + Google, JWT sessions (30 days, `sessionVersion` revocation), Argon2id, passwords ≥ 10 chars, tokens 24h/1h.
- **Services (free tiers):** Cloudinary (media), Resend (email), GitHub + GitHub Actions (CI, free plan; no branch protection — OD-34).
- **Environments:** `APP_ENV` = `local` / `test` (hosted QA) / `production`, fully separate credentials; hosting still OPEN (OD-01).
- **Product rules:** profiles public by default; collections private by default; deleting a collection keeps saves; unsave removes from all collections; single like (P2) with owner-only counts; signed-out users see landing + published post detail only (OD-29); unverified users get private features only; Google name pre-fills display name, Google photo not imported, users upload their own avatar.
- **Content:** seed mix of team originals, invited creators (real accounts), stock and Creative Commons (CC BY / BY-SA); no scraping.
- **Design (Claude Design v3):** all conflicts DC-01…DC-28 resolved (coming-soon nav, filter chips, "New to you" card, tablet layout, error color, plum focus ring, 3-step onboarding with min 3 interests, step progress saved per user, etc.).
- **Security:** static CSP without nonces (OD-35), security headers, cross-site mutation check, safe return paths, rate limits in Postgres.
- **Blocklist (OD-36):** LDNOOBW English + Hinglish minus 23 reviewed craft-safe exceptions (e.g. "fingering" yarn, "swastika" rangoli).
- **Skills list (OD-30):** 51 approved skills in `prisma/seed/skills.json` (PO may edit later; a test validates it).

## 4. Working rules agreed with the PO
- **No assumptions:** agents ask on anything OPEN/PROPOSED.
- **No git writes by agents:** the PO does all `add/commit/push/branch`; agents leave changes uncommitted and suggest commit messages (`AI_DEVELOPMENT_RULES §11`, saved in agent memory).
- New dependencies only with approval; installed in the task that first uses them.
- Real secrets only in `.env.local` (git-ignored). `.env.example` is a template — now guarded by a test.

## 5. Progress checkpoint
### Phase 0 — Setup (10/11 done)
| Task | Status | Notes |
|---|---|---|
| P0-01 Scaffold | ☑ | Next 16, Node 24 (`.nvmrc`), folder skeleton |
| P0-02 Libraries | ☑ | zod, server-only, prettier(+tailwind), eslint-plugin-import |
| P0-03 Database | ☑ | Docker Postgres 16 on **port 5433** (`dodoi`, `dodoi_test`) |
| P0-04 Design tokens | ☑ | `tokens.css`, Tailwind theme, patterns, DM Sans, `cn()` |
| P0-05 Server foundations | ☑ | AppError, `withRouteHandler`, logger with redaction, cursors |
| P0-06 Testing | ☑ | Vitest (unit/component/integration) + Playwright + axe |
| P0-07 Env validation | ☑ | fails fast at startup (`instrumentation.ts`) |
| P0-08 ADRs | ☑ | 0001–0009 |
| P0-09 CI | ◐ | `.github/workflows/ci.yml` written; **confirm green run on GitHub** |
| P0-10 UI primitives | ☑ | Button, chips, inputs, dialog/sheet, toast, states, coming-soon… (`/dev/ui`) |
| P0-11 Lint boundaries | ☑ | layer/import rules, no `any`/`!`/`console` |

### Phase 1 — MVP (in progress)
| Task | Status | Notes |
|---|---|---|
| P1-01 Prisma schema + init migration | ☑ | 24 models, no drift |
| P1-02 Skills seed | ☑ | `pnpm db:seed` idempotent (51 skills, 64 relations) |
| P1-08 Rate limiter | ☑ | atomic Postgres buckets, hashed keys, 429 + Retry-After |
| P1-09 Skills module | ☑ | search (prefix + typo), custom interests, blocklist; **API routes wired in P1-04** |
| P1-26b App shell | ☑ | mobile tabs / tablet rail / desktop sidebar + right rail, error/404/loading (`/shell-preview`) |
| P1-29 Security headers + CSP | ☑ | headers, CSP, origin check, safe return paths |
| **P1-04 Auth** | ☐ **next** | Google + email sign-in, sessions, linking, route protection, admin promotion |
| P1-03 Media (Cloudinary) | ☐ | unblocked; delete/modify limited to `dodoi/` folder |
| P1-05 Registration + email | ☐ | unblocked (Resend ready) |
| P1-15 Content module | ☐ | after P1-03 (needs image URLs) |
| Others (P1-06…P1-35) | ☐ | see roadmap |

**Quality checkpoint (last run):** 200 unit/component/integration tests + E2E (shell, headers/CSP, UI primitives, smoke, a11y on mobile/tablet/desktop) passing; lint, typecheck, formatting and build clean.

## 6. Accounts and local setup (done)
- **Google OAuth:** project `dodoi-local`, consent screen (Testing), web client with redirect `http://localhost:3000/api/auth/callback/google`; 2-Step Verification enabled.
- **Cloudinary:** existing account (cloud `dmrcq0yhl`), new key `dodoi-local` (Master Admin for now; try folder-scoped Media Library User role in P1-03).
- **Resend:** key `dodoi-local` (Sending access); sender `onboarding@resend.dev` → can only email the Resend account address until a domain is verified.
- **`.env.local`** contains: APP_ENV, DATABASE_URL, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, AUTH_SECRET (generated locally), AUTH_URL, RESEND_API_KEY, EMAIL_FROM.

## 7. Important checkpoints / gotchas
- **After a reboot run `docker compose up -d db`** — snap Docker does not restart the container (tests fail with "Can't reach database server").
- **Docker cannot stop containers** (snap + AppArmor). Fix needs `sudo aa-remove-unknown`; until then DB stays on **Postgres 16** (switch to 18 pending).
- **Prisma 7 does not regenerate the client after migrate** → `pnpm db:migrate` now runs `prisma generate` too.
- **Next.js 16 differences:** error boundaries use `retry()`; "middleware" is now "proxy"; `next dev` writes `AGENTS.md` (commit it).
- **Only one `next dev` per project** → E2E runs against a production build on port 3100.
- **Secrets were twice typed into `.env.example`** (never committed) → moved to `.env.local`; header + test now prevent it.
- `prisma init` tried to add third-party AI "skills" (`.claude/`, `.agents/`, `.windsurf/`) → kept out of the repo (in scratchpad).
- Router DNS is flaky (npm/Docker Hub timeouts) → retries; installs now check exit codes (an earlier hidden failure was fixed).

## 8. Still OPEN (not blocking the next tasks)
- **Before first deploy / launch:** OD-01 hosting (test + production), OD-05 content licensing for uploads, OD-26 privacy policy & terms, Resend domain, Google consent screen publishing, DB backups.
- **Optional / later:** OD-19 North Star metric, OD-20 analytics, OD-21 error monitoring, OD-25 comment threading (P2), OD-03 video calls & OD-06 communities (P3), OD-02 AI provider (P4), OD-04 monetization.
- Remaining PROPOSED items: feed ranking weights, offline matrix (needed for P1-27), install-prompt timing, search suggestion threshold, audit-log retention.

## 9. Next steps
1. PO: commit pending work (P1-09, P1-02, env guard, docs) and confirm CI is green → mark P0-09 ☑.
2. Agent: **P1-04 Auth** (then PO tests a real Google sign-in on `localhost:3000`).
3. Then P1-05 (registration/email), P1-03 (media), P1-15 (content), and the rest of Phase 1 per `docs/IMPLEMENTATION_ROADMAP.md`.

## 10. Useful commands
```bash
docker compose up -d db     # start Postgres (port 5433)
pnpm dev                    # http://localhost:3000 (/dev/ui, /shell-preview — local only)
pnpm db:migrate             # migrate + generate client
pnpm db:seed                # load predefined skills
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```
