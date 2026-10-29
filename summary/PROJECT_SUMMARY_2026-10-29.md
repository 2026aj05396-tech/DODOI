# dodoi — Summary (28–29 Oct 2026)

Continues `PROJECT_SUMMARY_2026-10-27.md`. Details: README §2 decision log, `docs/IMPLEMENTATION_ROADMAP.md`. Nothing committed yet: one large change set since `29b0d45` (commit message drafted in chat).

## Checkpoints

1. **Plan status check.** Phase 0 and the Phase 1 build were essentially done; what remained was PO work (screen reviews, seed content, CI push, Lighthouse) and the pre-launch gate.
2. **Screen review pack.** 78 screenshots of every Phase 1 screen at 390/834/1280 (dev data, review account `po-review@example.test`), given as a local HTML gallery.
3. **CI readiness (P0-09, P1-34).** Lint, format, types and unit tests green. E2E had one random load-timing failure per run → assertion timeout 10 s suite-wide, `reports.spec` 60 s budget, `google.spec` waits for load before submitting. Then two full runs green.
4. **Phase 2 spec (P2-00), approved by the PO.** PRODUCT_REQUIREMENTS §6.1 (CRT, JRN, CMT, LIKE, FLW, NTF, MOD), DATABASE_SCHEMA §9.1, API_SPECIFICATION §9.1, USER_FLOWS §1b (F-17…F-22), SECURITY Phase 2 matrix and limits, UI_UX §8. Decisions: OD-25 one level of comment replies; OD-05 makers keep ownership (legal wording pending); start Phase 2 in parallel with Phase 1 sign-off; first slice Create post.
5. **P2-01 user uploads.** Signed-in users upload post photos/videos and journal photos (`entry`); covers stay admin-only; uploader can edit alt text.
6. **P2-02 Create post, server.** `/api/me/posts` CRUD + publish, profile posts, tags, own-media and active-skill checks, own-work confirmation, verified email to share, 50 drafts / 20 shares a day. Invited creators' seeded posts stay admin-only.
7. **Create post experience.** PO asked for an interactive, attractive, easy flow and chose the **Instagram flow**: Pick → Arrange → Details → Share at `/create`, uploads start on pick, autosaving drafts, sheets for Type/Crafts/Tags/Materials and steps/Difficulty and time, live feed-card preview from 1024px, one confetti celebration. Create live in tab bar, sidebar, rail. Edit post on your own post page.
8. **No photo size limit (PO).** The 600px minimum was dropped for everyone; small photos get a "Small photo" note. New **photo editor** (crop shape, zoom, drag, rotate) on canvas, no new library; photos over 10 MB are shrunk in the browser.
9. **P2-02 finished.** Profile tabs: Posts (opens first) with "Your drafts", Collections. Step photos with descriptions.
10. **P2-03 Creative journal.** `/journal`, project pages `/projects/{id}` per design `1g` (timeline, entry sheet, ⋯ menu, materials checklist), "Start as my project" on tutorials, Share → draft post, profile Projects tab, Journal in the sidebar.
11. **Deployment doc.** Phase 2 needs no new env vars; migrations apply on deploy; Phase 2 smoke checks and Cloudinary credit note added.

## Done
- **☑:** P2-00, P2-01, P2-09 (Create and Journal live).
- **◐ (built, awaiting PO screen review):** P2-02 Create post, P2-03 journal. Phase 1 ◐ tasks still await review too.
- **Migrations:** `user_posts_tags`, `creative_journal`.
- **New code:** content `own-post-*`, `journal` module, `src/components/create/*`, `src/components/journal/*`, `src/lib/utils/image-edit.ts`, `relative-day.ts`.
- **Also fixed:** `/create`, `/journal`, `/projects` added to the proxy (sign-in/onboarding redirects); orphan cleanup no longer deletes journal photos.
- **Last runs:** 549 unit/integration tests; full E2E 190 passed, then the one outdated post-detail test fixed (15/15 in its spec); E2E-19 (create post) and E2E-20 (journal) pass on mobile and desktop; lint, types, format clean.

## Verify (PO)
1. Restart `pnpm dev` (it holds the pre-journal Prisma client; `/journal` errors until then).
2. Review screens at 390/834/1280: Create post (Pick, Arrange, photo editor, Details, sheets, Posted!), journal list and project page, profile tabs.
3. Confirm: journal entry **title** (design has it, spec didn't); newest-entry dot **still** (no pulse); sheets as centred panels, not side panels, from 1024px.
4. Commit (message drafted; can split into four), push to `main`, confirm CI green incl. WebKit/Firefox smoke (closes P0-09, P1-34).
5. After the test site deploys: run the Phase 2 checks in `docs/DEPLOYMENT.md`.
6. Still open from before: Lighthouse re-run on `/feed` (P1-31), seed content (P1-19), OD-05 legal wording, pre-launch gate.

## Gotchas
- After a migration, regenerate the client (`pnpm db:generate`) and restart `pnpm dev`.
- A `next start` review server on another port shares `.next` with E2E builds: stop it before `pnpm test:e2e`, and set `AUTH_URL` to its port.
- Sign-in allows 5 per 15 min per email: clear `rate_limit_bucket` in the dev DB when scripting many sign-ins.
- In Playwright, `name: "Next"` also matches the Next.js dev-tools button; use `exact: true`.

## Next
1. P2-04 comments (one level of replies), P2-05 likes (owner-only counts), P2-06 follows.
2. P2-07 notifications, P2-08 safety (report posts/comments, block, MODERATOR).
