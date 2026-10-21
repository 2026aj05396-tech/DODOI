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
| Rate-limit store | PostgreSQL table | CONFIRMED |
| Media limits | Images JPEG/PNG/WebP/HEIC ≤ 10 MB, ≥ 600 px, ≤ 10/post; video MP4/MOV/WebM ≤ 60 s, ≤ 50 MB, no feed autoplay | CONFIRMED |
| Collections | ≤ 100 per user, ≤ 1,000 items, unique names | CONFIRMED |
| Reporting in P1 | Custom skills and profiles | CONFIRMED |
| Account deletion | Deactivate now, hard delete after 14 days | CONFIRMED |
| Code hosting / CI | GitHub + GitHub Actions | CONFIRMED |
| Usernames | Auto-generated at sign-up, editable; 3–20 chars `[a-z][a-z0-9_-]`, reserved names blocked, one change per 30 days | CONFIRMED |
| Seeded post creators | Invited creators = real accounts; team/stock/Creative Commons (CC BY, BY-SA only) = "via dodoi editors" + attribution | CONFIRMED |
| Icons | Lucide (`lucide-react`) | CONFIRMED |
| Content Security Policy | Static policy without nonces, keeps pages statically rendered (OD-35) | CONFIRMED |
| Signed-out access | Landing page + published post detail (read-only); everything else requires sign-in (OD-29) | CONFIRMED |
| Auth settings | JWT sessions (30 days rolling), Argon2id, passwords ≥ 10 chars, tokens 24h/1h, rate limits per SECURITY §6, `/admin` → 404 for non-admins | CONFIRMED |
| Google profile data | Name pre-fills display name; photo not imported; users upload their own avatar | CONFIRMED |
| Retention | Feed sessions 7 days after expiry; orphaned uploads 24h | CONFIRMED |
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
| `pnpm db:seed` | Reference data + seed content import |
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
| `AUTH_URL` | Yes | Base URL, e.g. `http://localhost:3000` |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth client secret |
| `RESEND_API_KEY` | Yes | Resend API key |
| `EMAIL_FROM` | Yes | Sender address (must be verified in Resend for non-test sending) |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key (server only) |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret (server only) |
| `APP_ENV` | Yes | `local`, `test` or `production` (SYSTEM_ARCHITECTURE §13) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public base URL used in client code |
| `SEED_ADMIN_EMAIL` | Seed only | Email of the account promoted to ADMIN by the seed script |

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
├── seed-content/          # Seed JSON + local media for import
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
