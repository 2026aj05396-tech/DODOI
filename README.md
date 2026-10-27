# dodoi

> For the things you love making, and all the things you haven't tried yet.

**dodoi** is a visual-first creative discovery and community Progressive Web App for hobbyists, makers and beginners. Users discover art and craft inspiration, save ideas into collections, explore unfamiliar skills, and (in later phases) share their work, connect with other makers and get help from an AI creative companion.

**Product principle:** Curiosity over perfection. Discovery over comparison. Creativity without pressure.

**Status:** Pre-development. No code exists yet. This repository currently contains only the documentation set that defines what will be built.

---

## 1. Documentation Map

Read the documents in this order before writing any code.

| # | Document | Purpose |
|---|---|---|
| 1 | [README.md](README.md) | Overview, confirmed decisions, setup |
| 2 | [docs/AI_DEVELOPMENT_RULES.md](docs/AI_DEVELOPMENT_RULES.md) | **Mandatory** rules for every AI coding session |
| 3 | [docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md) | Finalized requirements, priorities, acceptance criteria |
| 4 | [docs/USER_FLOWS.md](docs/USER_FLOWS.md) | Step-by-step user journeys and edge cases |
| 5 | [docs/UI_UX_GUIDELINES.md](docs/UI_UX_GUIDELINES.md) | Design system, tokens, components, accessibility |
| 6 | [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) | Stack, module boundaries, folder structure, ADRs |
| 7 | [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Entities, relationships, indexes, lifecycle |
| 8 | [docs/API_SPECIFICATION.md](docs/API_SPECIFICATION.md) | Endpoint contracts, validation, permissions, errors |
| 9 | [docs/SECURITY_AND_PRIVACY.md](docs/SECURITY_AND_PRIVACY.md) | Auth, authorization, moderation, privacy |
| 10 | [docs/AI_INTEGRATION.md](docs/AI_INTEGRATION.md) | AI companion (Phase 4) design and safety |
| 11 | [docs/TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md) | Unit, integration, E2E, accessibility, AI evals |
| 12 | [docs/IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md) | Phased tasks, dependencies, acceptance criteria |

### Marker conventions used across all documents

| Marker | Meaning |
|---|---|
| **CONFIRMED** | Decided by the product owner. Implement as written. |
| **PROPOSED** | Suggested by documentation author, *not yet approved*. Must be confirmed before implementation depends on it. |
| **OPEN** | Undecided. Agents must not implement behavior that depends on it; ask the product owner. |

---

## 2. Confirmed Decisions (Decision Log)

| Area | Decision | Status |
|---|---|---|
| Product name | **dodoi** (design shows domain `dodoi.app`; domain registration not decided) | CONFIRMED |
| Product type | Responsive web app + PWA | CONFIRMED |
| MVP scope | **Phase 1 only** (Discovery Foundation) | CONFIRMED |
| Frontend | Next.js (App Router) + TypeScript (strict) | CONFIRMED |
| Backend | Modular monolith inside the same Next.js app: Route Handlers + server-side service layer | CONFIRMED |
| Database | PostgreSQL | CONFIRMED |
| ORM | Prisma | CONFIRMED |
| Authentication | Auth.js (NextAuth) — email/password + Google | CONFIRMED |
| Transactional email | Resend (free tier) | CONFIRMED |
| Hosting | **Local development only for now** (PostgreSQL via Docker). Deployment target is OPEN. | CONFIRMED / OPEN |
| Cost constraint | No paid services at this stage; free tiers only | CONFIRMED |
| Media storage | Cloudinary (free tier) | CONFIRMED |
| Search | PostgreSQL full-text search (`simple` config) + `pg_trgm` trigram matching | CONFIRMED |
| Data conventions | cuid ids, snake_case tables/columns via `@map`, text limits per DATABASE_SCHEMA | CONFIRMED |
| GitHub plan | Free; no branch protection or secret scanning for now (OD-34) | CONFIRMED |
| Styling | Tailwind CSS + shadcn/ui | CONFIRMED |
| Typeface | DM Sans (Google Fonts, free), via `next/font` | CONFIRMED |
| Package manager | pnpm | CONFIRMED |
| Testing | Vitest (+ Testing Library) and Playwright (+ axe) | CONFIRMED |
| Real-time messaging (Phase 3) | Polling first; realtime service later if needed | CONFIRMED |
| AI provider (Phase 4) | — | OPEN |
| Minimum age | **18+**, checked by date of birth (discarded after the check) | CONFIRMED |
| Launch market | India first: English UI, INR, IST default, DPDP Act applies | CONFIRMED |
| Post types | First attempt · Tutorial · Work in progress · Journal · Finished · Tip | CONFIRMED |
| Onboarding | 3 steps: interests (min 3) → familiarity (optional) → skills you can help with (optional) | CONFIRMED |
| Tutorial progress | Materials checks + step progress saved per user, synced across devices | CONFIRMED |
| Layout | Sidebar everywhere on desktop (icon rail on detail pages with docked companion); tablet 768–1279 = icon rail + 2-col feed | CONFIRMED |
| Unverified email | Private features allowed; public actions need verification; unverified accounts deleted after 30 days | CONFIRMED |
| Google ↔ password accounts | Auto-link; password removed if existing account was unverified | CONFIRMED |
| Auth.js version and adapter | `next-auth@5.0.0-beta.32` pinned exactly (v5 is still beta; upgrades are deliberate); own minimal adapter instead of `@auth/prisma-adapter` (P1-04) | CONFIRMED |
| Google OAuth tokens | Not stored: dodoi does not call Google APIs, so only the account link (provider + Google id) is kept | PROPOSED (P1-04) |
| Sign-in for Google-only accounts | Password attempt shows "Looks like you signed up with Google … Continue with Google instead." (accepted enumeration risk, SECURITY §2.5) | CONFIRMED |
| Registration follow-up | New users are signed in right after registering; a taken email shows "This email is already registered." + "Sign in instead", or "Looks like you signed up with Google." + "Continue with Google" (accepted enumeration risk, SECURITY §2.5) | CONFIRMED |
| Display name for email sign-ups | Email local-part (e.g. `aanya.k`), editable in Edit profile | CONFIRMED |
| Under-18 and sign-up copy | "dodoi is for adults 18 and over, so we can't create an account for you." · "This email is already registered." · "Check your email — we've sent you a link." | CONFIRMED |
| Password reset details | Email sent after the response (timing-safe); reset link verifies an unverified email; password change keeps the current device signed in, 5 attempts / 15 min | PROPOSED (P1-06) |
| Welcome and Google button | `/` shows Welcome `1a` below 1024px and Landing `2a` from 1024px; designed three-button entry kept (no email-first); official Google "G" logo | CONFIRMED |
| Responsive delivery | Every screen is built for mobile, tablet and desktop in the same task (never mobile-only) | CONFIRMED |
| Admin content rules | Up to 10 media per post, images and videos mixed; any skill (predefined too) can be hidden; published posts editable if they still meet the publish rules; attribution rules incl. stock source link | CONFIRMED |
| Seed importer | File is the source of truth (re-run updates the post); per-file `publish` flag; skills by slug; seed content kept outside git (`pnpm seed:content <folder>`) | CONFIRMED (P1-18) |
| Post detail (P1-20) | Save "coming soon" until P1-25; signed-out visitors get a slim bar (Log in / Sign up) instead of the app shell; Share is an icon (Web Share API, copy-link fallback); several media: swipe + dots on mobile, arrows + thumbnails from 768px | CONFIRMED |
| Tutorial progress (P1-20b) | Signed-out visitors see the checklist and steps; tapping sends them to sign-in and back to the post; "Next step" sits in the steps header (hidden when all steps are done) | CONFIRMED |
| Feed ranking (P1-21) | SYSTEM_ARCHITECTURE §7 rules approved as proposed (+3 interest, +1 level fit, freshness +2/+1, +1 saves, −2 not interested, ≥20% discovery, ≤2 same skill in a row, 24h sessions); "recent" = 30 days; no level = Curious; suggestion card first on page 1 of For you only; up to 5 interest chips, newest first | CONFIRMED |
| Saves & collections (P1-24) | Adding a post to a collection saves it first; collections listed most recently changed first, posts most recently added first, cover = newest post | CONFIRMED |
| Feed screen (P1-22) | TanStack Query installed for client data; greeting "What will you make today/tonight, {first name}?" (5 pm India time; first word of the display name, dot/underscore/number tail dropped); search field, bell and avatar "coming soon" until search (P1-26) and profiles (P1-14) | CONFIRMED |
| Saved screens (P1-25) | `/saved`: collections on top, All saved below; collection pages at `/saved/{id}` (public ones open for other signed-in users); unsave Undo restores the save and its collections; profile Collections tab moves to P1-14 | CONFIRMED |
| Profiles (P1-13/P1-12) | Any signed-in user may upload their own avatar (purpose `avatar` only; posts/covers stay admin-only); usernames and display names are checked against the offensive-word list (bios left to reports); unverified users may edit their whole profile; profiles hidden after a report or deactivated are not found for others | CONFIRMED |
| Profile screens (P1-14) | Tabs Projects · Collections · Posts with Projects/Posts coming soon; "Pick your username" dismissal remembered on the account; one "Your skills" screen linked from Edit profile and Settings; the profile shows only public collections, also to its owner | CONFIRMED |
| Search & Explore (P1-23) | Popular skills = most saves in 30 days, topped up by most published posts (never empty); Explore shows 8 popular, 8 new, 8 skills to try (with hint, outside your interests, related first), all themes with idea counts, 12 newest beginner-friendly posts | CONFIRMED |
| Explore & skill pages (P1-26) | Explore adds Popular, New on dodoi and Beginner-friendly below the designed sections; "See all" opens an All skills page; skill pages have "Add to my interests" (removing keeps ≥ 3 interests) | CONFIRMED |
| Reporting (P1-28b) | Admin sees one row per reported target; Hide/Dismiss resolve all its open reports; hidden targets can be shown again from Resolved; owners of hidden profiles see a neutral notice with `SUPPORT_EMAIL` (optional env; "the dodoi team" until set) | CONFIRMED |
| Admin skill create/rename/delete | Requested by PO (2026-10-26), **on hold**: needs delete rule for skills in use, editable fields (name/slug/accent) and type of new skills. Today admin can edit editorial fields, hide/show and set related skills | OPEN |
| Admin onboarding | Admins skip onboarding: `/` and `/onboarding` redirect them to `/admin` (age check still applies) | CONFIRMED |
| Post lists | Related posts: 12, most shared skills → same primary → newest; skill pages newest first; hidden/deactivated creators: post stays, creator row not shown | CONFIRMED |
| Media integration | Cloudinary REST APIs called directly (no `cloudinary` SDK, like Resend); uploads in `dodoi/<APP_ENV>/…`; deletes limited to `dodoi/` | PROPOSED (P1-03) |
| Google sign-in tests | Dev-only `oauth2-mock-server` 9.3.0 as a local stand-in for Google in E2E | CONFIRMED |
| Onboarding data | Up to 50 skills per user; resume step stored per user; skipped familiarity stores no level | CONFIRMED |
| Age check date | Age computed on today's date in India (IST) | PROPOSED (P1-05) |
| Reserved usernames and fallback | Full list in `src/server/modules/users/username.ts` (OD-11 names + every top-level route); usernames fall back to `maker-NNNN` when neither name nor email gives 3 usable characters; the same list applies to username changes | CONFIRMED (2026-10-27) |
| Rate-limit store | PostgreSQL table | CONFIRMED |
| Media limits | Images JPEG/PNG/WebP/HEIC ≤ 10 MB, ≥ 600 px, ≤ 10/post; video MP4/MOV/WebM ≤ 60 s, ≤ 50 MB, no feed autoplay | CONFIRMED |
| Collections | ≤ 100 per user, ≤ 1,000 items, unique names | CONFIRMED |
| Reporting in P1 | Custom skills and profiles | CONFIRMED |
| Account deletion | Deactivate now, hard delete after 14 days | CONFIRMED |
| Account deletion details | Password accounts confirm with their password; Google-only accounts sign in with Google again (fresh login) and confirm within 5 minutes. Signing in during the grace period shows only a blocking "scheduled for deletion" screen (Cancel deletion / Sign out). Invited creators' posts are deleted with their media. Admin accounts can't be deleted from settings | CONFIRMED (2026-10-27) |
| Code hosting / CI | GitHub + GitHub Actions | CONFIRMED |
| Usernames | Auto-generated at sign-up, editable; 3–20 chars `[a-z][a-z0-9_-]`, reserved names blocked, one change per 30 days | CONFIRMED |
| Seeded post creators | Invited creators = real accounts; team/stock/Creative Commons (CC BY, BY-SA only) = "via dodoi editors" + attribution | CONFIRMED |
| Icons | Lucide (`lucide-react`) | CONFIRMED |
| Content Security Policy | Static policy without nonces, keeps pages statically rendered (OD-35) | CONFIRMED |
| Signed-out access | Landing page + published post detail (read-only); everything else requires sign-in (OD-29) | CONFIRMED |
| Auth settings | JWT sessions (30 days rolling), Argon2id, passwords ≥ 10 chars, tokens 24h/1h, rate limits per SECURITY §6, `/admin` → 404 for non-admins | CONFIRMED |
| Google profile data | Name pre-fills display name; photo not imported; users upload their own avatar | CONFIRMED |
| Retention | Feed sessions 7 days after expiry; orphaned uploads 24h | CONFIRMED |
| Custom-interest blocklist | LDNOOBW English + Hinglish (CC BY 4.0) minus reviewed craft-safe exceptions | CONFIRMED |
| Coming-soon nav items | Muted + butter "Soon" pill, tooltip only | CONFIRMED |
| Undesigned Phase 1 screens | Built from the design system (tokens + components); product owner reviews | CONFIRMED |
| Profile default visibility | Public | CONFIRMED |
| Reactions (Phase 2) | Single like/heart | CONFIRMED |
| Like counts | Hidden publicly; visible only to post owner | CONFIRMED |
| Collection default visibility | Private | CONFIRMED |
| Deleting a collection | Items stay saved (removed from that collection only) | CONFIRMED |
| Seed content sources | Mix: team originals + invited creators (core); licensed free stock (filler). Every item stores source, license and attribution. | CONFIRMED |
| Seeding method | Seed script (bulk JSON import) **and** minimal admin UI (create/edit) | CONFIRMED |
| Phase 1 media types | Images + short video | CONFIRMED (limits OPEN) |
| Unbuilt features in UI | Shown as disabled "coming soon" (Create, Community, Messages, Journal, notifications, Ask dodoi, etc.) | CONFIRMED |
| Feed extras in Phase 1 | Filter chips (For you / per-interest / New to you) + "New to you" skill suggestion card | CONFIRMED |
| Theme | Light only in MVP; tokens structured for future dark mode | CONFIRMED |
| Visual design source | Claude Design `dodoi App v3.dc.html`, local copy in `docs/design/`; tokens extracted into UI_UX_GUIDELINES §2. DC-01–05 resolved; remaining conflicts OPEN (UI_UX_GUIDELINES §10) | CONFIRMED |
| Custom interests | Immediately public, normalized to prevent duplicates, reportable | CONFIRMED |
| Experience levels | Curious / Beginner / Intermediate / Experienced | CONFIRMED |

The full list of open decisions lives in [docs/PRODUCT_REQUIREMENTS.md §9](docs/PRODUCT_REQUIREMENTS.md#9-open-decisions-register).

---

## 3. Prerequisites (Local Development)

| Tool | Version | Notes |
|---|---|---|
| Node.js | 24 (LTS) | Pinned in `.nvmrc` and `package.json` `engines` |
| pnpm | Latest stable | `corepack enable` then `corepack prepare pnpm@latest --activate` |
| Docker + Docker Compose | Current stable | Runs local PostgreSQL |
| Git | Any recent | Version control; remote on GitHub |

Free accounts required:

| Service | Used for | Needed from |
|---|---|---|
| Google Cloud Console | OAuth client for Google sign-in | Phase 1 |
| Cloudinary | Image/video storage, transforms, CDN | Phase 1 |
| Resend | Verification and password-reset emails | Phase 1 |

---

## 4. Setup (to be valid once the project is scaffolded)

> These steps describe the **target** setup. Task P0-01 in the roadmap creates the scaffold that makes them work. Update this section if the scaffold differs.

```bash
# 1. Install dependencies
pnpm install

# 2. Create local environment file
cp .env.example .env.local
#    then fill in values (see §5)

# 3. Start PostgreSQL (host port 5433; creates databases dodoi and dodoi_test)
docker compose up -d db

# 4. Apply database migrations (also enables pg_trgm extension)
pnpm db:migrate

# 5. Load reference data (skills/categories) and seed content
pnpm db:seed

# 6. Start the dev server
pnpm dev
#    → http://localhost:3000
```

### Planned scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm format` / `pnpm format:check` | Prettier write / check (Markdown excluded) |
| `pnpm test` | Vitest unit + integration tests |
| `pnpm test:e2e` | Playwright end-to-end + accessibility tests |
| `pnpm db:migrate` | `prisma migrate dev` + `prisma generate` (Prisma 7 no longer regenerates the client after migrating) |
| `pnpm db:seed` | Load predefined skills (idempotent); refuses production without `--confirm-production` |
| `pnpm seed:content [folder]` | Import seed posts from `<folder>/posts/*.json` (default `./seed-content`, outside git); `--check` validates only; refuses production without `--confirm-production` |
| `pnpm jobs:daily` | Daily maintenance (P1-33): delete accounts that are due, purge spent auth tokens, old feed sessions, expired rate-limit buckets and orphaned media. Idempotent; exits 1 if a job failed |
| `pnpm db:studio` | Prisma Studio |
| `pnpm db:reset` | Drop, re-migrate, re-seed (local only) |

---

## 5. Environment Variables

Each environment (local, test, production) has its **own values for every variable** — separate database, OAuth client, Cloudinary and Resend credentials. Hosted environments set them in the host's secret settings, never in files.

`.env.example` must list every variable with a placeholder and comment. Never commit real values.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Auth.js secret (`npx auth secret`) |
| `AUTH_URL` | Yes | Base URL, e.g. `http://localhost:3000`; Google redirect URI is `<AUTH_URL>/api/auth/callback/google` |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth client secret |
| `RESEND_API_KEY` | Yes (may be empty only with `APP_ENV=local`, for automated tests: emails are then skipped) | Resend API key |
| `EMAIL_FROM` | Yes | Sender address (must be verified in Resend for non-test sending) |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key (server only) |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret (server only) |
| `APP_ENV` | Yes | `local`, `test` or `production` (SYSTEM_ARCHITECTURE §13) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public base URL used in client code |
| `CLOUDINARY_API_BASE` | No — automated tests only | Points the Cloudinary Admin API at the local mock in E2E runs; refused unless `APP_ENV=local` |
| `AUTH_GOOGLE_ISSUER` | No — automated tests only | Points Google sign-in at the local mock provider in E2E runs; refused unless `APP_ENV=local` |
| `SEED_ADMIN_EMAIL` | No | Email of the account promoted to ADMIN after it signs in with a verified email (P1-04) |
| `SUPPORT_EMAIL` | No | Support address shown to owners of profiles hidden after a report (P1-28b); set before launch |

Rule: only variables prefixed `NEXT_PUBLIC_` may be read in client code, and none of them may contain secrets.

---

## 6. Planned Repository Structure

See [docs/SYSTEM_ARCHITECTURE.md §5](docs/SYSTEM_ARCHITECTURE.md#5-folder-structure) for the full structure.

```
/
├── README.md
├── docs/                  # This documentation set
│   └── design/            # Exported Claude Design files (visual source of truth)
├── prisma/                # schema.prisma, migrations, seed
├── seed-content/          # Seed JSON + local media for import (git-ignored)
├── public/                # Static assets, PWA icons
├── src/
│   ├── app/               # Next.js routes (UI + /api route handlers)
│   ├── components/        # UI components (ui/ = shadcn primitives)
│   ├── server/            # Modular monolith: modules, db, auth, lib
│   ├── lib/               # Shared client/server utilities, schemas
│   └── styles/            # Tailwind + design tokens
├── tests/                 # Integration + E2E tests
└── docker-compose.yml
```

---

## 7. Product Phases at a Glance

| Phase | Name | Status |
|---|---|---|
| 0 | Setup and definition | **Current** |
| 1 | Discovery Foundation | **MVP** |
| 2 | Creative Expression | Post-MVP |
| 3 | Community and Peer Learning | Post-MVP |
| 4 | AI Creative Companion | Post-MVP |
| 5 | Refinement and Growth | Post-MVP |

Details: [docs/IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md).
