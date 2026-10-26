# dodoi — Project Summary (up to 2026-10-26)

Continues `PROJECT_SUMMARY_2026-10-23.md`. Covers the build sessions of 23–26 Oct 2026 (P1-04 → P1-17). Source of truth stays in `README.md`, `docs/` and `CODE_QUALITY.md`; this file is a quick-start for the product owner and the next agent session.

## 1. Where we are

- **Phase 0:** 10/11 done. P0-09 (CI) still ◐: **confirm a green GitHub Actions run** after pushing.
- **Phase 1:** auth, onboarding, media, content read models and the admin area are built. **Nothing is committed yet**: all work since commit `807ab9d` is in the working tree (≈150 changed/new paths). The PO does all git operations (see §6).
- **Last full quality run (2026-10-26):** lint ✓ · format ✓ · typecheck ✓ · **385** unit/component/integration tests ✓ · **93** E2E tests ✓ (mobile + desktop) · production build clean.

## 2. Progress checkpoint

| Task | Status | What it delivered |
|---|---|---|
| P1-04 Auth | ☑ | Auth.js v5 (`next-auth@5.0.0-beta.32`, pinned), own minimal adapter, JWT with DB check per request, Google + email/password, OD-09 linking, proxy, `/sign-in`. Real Google sign-in confirmed by PO |
| P1-05 Registration + email | ☑ | Sign-up with DOB 18+ (IST date, DOB never stored), Resend (REST, no SDK), verification + resend, `/confirm-age` for Google, unverified gating. Real email confirmed by PO |
| P1-06 Passwords | ☑ | Forgot/reset (1 h single-use, timing-safe via `after()`), Google accounts can set a password, password change keeps current device. Real reset confirmed by PO |
| P1-07 Auth UI | ☑ | Welcome `1a` (<1024 px) / Landing `2a` (≥1024 px) at `/`, auth screens with desktop split layout, official Google "G", verify-email banner. Reviewed by PO |
| P1-10 User skills + onboarding API | ☑ | `/api/me/skills` (≤ 50), `/api/me/onboarding` (saved step, new `onboarding_step` column), complete (≥ 3 interests) |
| P1-11 Onboarding UI | ☑ | `/onboarding` 3 steps (`1b` + built-from-system steps 2/3), resume, proxy routing. Reviewed by PO |
| P1-03 Media | ☑ | Cloudinary over REST (no SDK): signed direct uploads, re-verification vs MEDIA-01…03, deletes limited to `dodoi/`, orphan cleanup function. Live-checked against the dev account |
| P1-15 Content read models | ☑ | Post detail + related (public), skill posts, themes, search indexing; `collections` module stub |
| P1-16 Admin API | ☑ | Posts/themes/skills admin endpoints, publish rules, audit log (`admin` module) |
| P1-17 Admin UI | ◐ | `/admin` posts/themes/skills screens, uploads with progress, E2E-12. **Waiting for PO screen review** |
| P1-12, P1-13, P1-14, P1-18 … P1-35 | ☐ | See roadmap; P1-19 seed content production should already be running (PO) |

Already done before this period: P0-01…P0-11 (except P0-09), P1-01, P1-02, P1-08, P1-09, P1-26b, P1-29.

## 3. Decisions made in this period (all recorded in the docs)

### Confirmed by the PO
- **Auth stack:** Auth.js v5 beta pinned exactly; own minimal adapter instead of `@auth/prisma-adapter` (Prisma 7 not supported); username auto-generation moved into P1-04.
- **Registration:** new users are signed in straight away; a taken email shows "This email is already registered." + **Sign in instead** (email carried over in session storage, never in the URL), or "Looks like you signed up with Google." + **Continue with Google**. Accepted enumeration risk recorded in SECURITY §2.5.
- **Sign-in:** a password attempt on a Google-only account says "Looks like you signed up with Google … Continue with Google instead."
- **Display name for email sign-ups:** email local-part. Under-18 copy: "dodoi is for adults 18 and over, so we can't create an account for you."
- **Auth UI:** Welcome at `/` (`1a` mobile, `2a` desktop); keep the designed three-button entry (no email-first); official Google "G" logo; dev-only `oauth2-mock-server` 9.3.0 for Google E2E.
- **Responsive rule (new, permanent):** every screen is built for mobile, tablet and desktop **in the same task**, with screenshots at 390 / 834 / 1280 px for review (AI_DEVELOPMENT_RULES §10, roadmap rules, UI_UX §8, agent memory).
- **Onboarding data:** max 50 skills per user; resume step stored per user; skipped familiarity stores no level.
- **Content lists:** related posts = 12, ordered by most shared skills → same primary skill → newest; skill pages newest first; hidden/deactivated creators: post stays, creator row hidden.
- **Admin rules:** up to **10 media per post, images and videos mixed**; any skill (predefined too) can be hidden; published posts editable only if they still meet the publish rules; attribution rules: CC only **CC BY / CC BY-SA** + author + link, stock needs a link, invited creator needs a dodoi account + permission reference, other sources have no author.

### Still PROPOSED (need PO approval; marked in README decision log)
1. Google OAuth tokens are not stored (only the account link).
2. Full reserved-username list (`src/server/modules/users/username.ts`) and the `maker-NNNN` fallback.
3. Client IP from `x-forwarded-for` (revisit when hosting, OD-01, is chosen).
4. Age check uses today's date in India (IST).
5. Empty `RESEND_API_KEY` allowed only with `APP_ENV=local` (tests skip email).
6. Password reset: email sent after the response (timing-safe); reset link verifies an unverified email; password change limited to 5 / 15 min and keeps the current device signed in.
7. Media: Cloudinary called over REST instead of the approved `cloudinary` SDK.
8. Avatar uploads for regular users (decide in P1-12).

## 4. Important checkpoints and gotchas (learned the hard way)

**Environment and accounts**
- After a reboot: `docker compose up -d db` (Postgres 16 on port **5433**).
- `.env.local` must contain: `APP_ENV`, `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (all validated at startup). Optional: `SEED_ADMIN_EMAIL` (becomes ADMIN after signing in with a verified email). Test-only, refused outside `APP_ENV=local`: `AUTH_GOOGLE_ISSUER`, `CLOUDINARY_API_BASE`.
- **Resend test mode only delivers to the Resend account's own address** (the PO's Gmail). Other addresses get 403 until a domain is verified (pre-launch item).
- **Cloudinary key has full account access** (free plan can't scope keys to a folder); the app only registers files in `dodoi/<APP_ENV>/{posts,covers,avatars}` and refuses deletes outside `dodoi/`.
- Local accounts were all deleted on 2026-10-24 at the PO's request; the PO re-registered and verified with Gmail. To get admin locally: set `SEED_ADMIN_EMAIL`, restart `pnpm dev`, sign out and in, open `/admin`.

**Next.js 16 / libraries**
- Session reads need `await connection()` (done in `getActor`); with partial prefetching, Auth.js randomness otherwise errors.
- Route handlers must call `unstable_rethrow(error)` before handling errors (done in `withRouteHandler`), or build-time prerender signals become logged 500s.
- Next keeps previous pages mounted but hidden (`display: none`) after navigation; Playwright locators may need `.filter({ visible: true })` or `exact: true`.
- `next-auth` imports `next/server` without extension → Vitest needs `server.deps.inline: ["next-auth"]` (configured).
- The proxy only checks the cookie (role, `ac` age, `oc` onboarding claims); pages and APIs re-check the database. After changing age/onboarding state the client calls `getSession()` so the cookie is refreshed.
- Prisma 7 client is ESM-only: E2E data helpers run through `tsx` (`tests/e2e/helpers/create-account.ts`).

**Testing**
- Integration tests empty the `dodoi_test` database; E2E global setup migrates and **re-seeds skills** before running. Manual screenshot runs need `prisma db seed` against `dodoi_test` first.
- E2E runs start three servers: the app on **3100**, a mock Google provider on **3199**, a mock Cloudinary Admin API on **3198**.
- Only one `next dev` per project; review builds use port **3101**.
- ⚠ Never stop servers with `pkill -f "next…"`: it once killed the PO's dev server. Stop by exact PID only.
- After the agent formats/edits files while `pnpm dev` runs, a one-off hydration mismatch can appear; restart the dev server.

## 5. Key code map (new in this period)

| Area | Where |
|---|---|
| Auth config, callbacks, adapter, session/actor, cookie re-issue | `src/server/auth/*` |
| Route protection | `src/proxy.ts` (sign-in, `/confirm-age`, `/onboarding`, `/admin` → 404) |
| Users module (accounts, registration, passwords, age, onboarding, user skills, creators) | `src/server/modules/users/*` |
| Content module (media, posts, themes, admin, publish rules) | `src/server/modules/content/*` |
| Admin audit log | `src/server/modules/admin/*` |
| Collections stub (`isSaved`) | `src/server/modules/collections/*` |
| Integrations (Resend, Cloudinary) | `src/server/integrations/{email,media}/*` |
| Route-handler wrapper (`auth: "public" | "user"`, age gate, Next signal rethrow) | `src/server/lib/route-handler.ts` |
| Browser API clients | `src/lib/api-client/*` |
| Screens | `src/app/page.tsx`, `src/app/(auth)/*`, `src/app/onboarding`, `src/app/admin/*` |
| Components | `src/components/{auth,onboarding,admin,marketing}/*` |
| E2E helpers and mocks | `tests/e2e/helpers/*` |

New migration: `20261025172541_add_onboarding_step`.

## 6. Working rules (unchanged + new)

- **No assumptions:** anything OPEN/PROPOSED is asked before building.
- **No git writes by agents:** the PO stages, commits and pushes; agents leave changes uncommitted and suggest commit messages.
- **New dependencies only with approval** (added this period: `next-auth`, `argon2`, dev-only `oauth2-mock-server`).
- **Every screen at all three widths in the same task**, reviewed with screenshots; undesigned screens are "built from system, needs PO review".
- Secrets only in `.env.local`; `.env.example` is a guarded template.

## 7. Suggested commits (in order, not yet made)

1. `feat(auth): add Auth.js sign-in with Google and email, sessions and route protection [P1-04]`
2. `feat(auth): add registration, email verification and 18+ age check [P1-05]` (+ sign-up guidance for existing and Google-only accounts)
3. `feat(auth): add password reset, set-password for Google accounts and password change [P1-06]`
4. `feat(auth): designed welcome and auth screens, verify banner, Google E2E with mock provider [P1-07]`
5. `feat(onboarding): user skills replace-set, saved onboarding step and completion [P1-10]`
6. `feat(onboarding): interests, familiarity and can-help steps with resume and routing [P1-11]`
7. `feat(media): Cloudinary signed uploads with re-verification, alt text and orphan cleanup [P1-03]`
8. `feat(content): post detail, related posts, skill and theme listings, search indexing [P1-15]`
9. `feat(admin): admin API for posts, themes and skills with publish rules and audit log [P1-16]`
10. `feat(admin): admin screens for posts, themes and skills with uploads and publish checks [P1-17]`

(Earlier uncommitted work from before 2026-10-23 — P1-09 skills module, P1-02 seed, env guard — should go in first, as noted in the previous summary.)

## 8. Next steps

1. **PO:** review the P1-17 admin screens (`/admin`, or the 390/834/1280 screenshots) → mark P1-17 ☑.
2. **PO:** commit the pending work (§7), push, confirm CI green → P0-09 ☑.
3. **PO:** approve or change the PROPOSED items in §3.
4. **Agent, next on the plan:** **P1-18 seed importer** (JSON + media → Cloudinary, idempotent by `seedKey`), then P1-20 post detail page, P1-21/P1-22 feed, P1-13/P1-12/P1-14 profiles, P1-24/P1-25 saves and collections.
5. **Before PWA work (P1-27):** PO supplies app icons (192, 512, maskable) and approves the offline matrix (SYSTEM_ARCHITECTURE §9).
6. **Before launch (unchanged):** hosting (OD-01), Resend domain, Google consent screen publishing, privacy policy and terms (OD-26), content licensing for uploads (OD-05), DB backups.

## 9. Useful commands

```bash
docker compose up -d db            # Postgres on 5433
pnpm dev                           # http://localhost:3000 (/admin needs an ADMIN account)
pnpm db:migrate                    # migrate + generate client
pnpm db:seed                       # predefined skills
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm test:e2e
```
