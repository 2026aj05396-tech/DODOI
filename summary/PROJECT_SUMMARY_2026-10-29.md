# dodoi — Summary (28–29 Oct 2026)

Continues `PROJECT_SUMMARY_2026-10-27.md`. Details: README §2 decision log, `docs/IMPLEMENTATION_ROADMAP.md`. Everything below is committed and pushed to `development` (last commit `25bf9e9`, P2-08).

## Checkpoints

1. **Plan status check.** Phase 0 and the Phase 1 build were essentially done; what remained was PO work (screen reviews, seed content, CI push, Lighthouse) and the pre-launch gate.
2. **Screen review pack.** 78 screenshots of every Phase 1 screen at 390/834/1280 (dev data, review account `po-review@example.test`), given as a local HTML gallery.
3. **CI readiness (P0-09, P1-34).** Lint, format, types and unit tests green. E2E had one random load-timing failure per run → assertion timeout 10 s suite-wide, `reports.spec` 60 s budget, `google.spec` waits for load before submitting. Then two full runs green.
4. **Phase 2 spec (P2-00), approved by the PO.** PRODUCT_REQUIREMENTS §6.1 (CRT, JRN, CMT, LIKE, FLW, NTF, MOD), DATABASE_SCHEMA §9.1, API_SPECIFICATION §9.1, USER_FLOWS §1b (F-17…F-22), SECURITY Phase 2 matrix and limits, UI_UX §8. Decisions: OD-25 one level of comment replies; OD-05 makers keep ownership (legal wording pending); start Phase 2 in parallel with Phase 1 sign-off; first slice Create post.
5. **P2-01 user uploads.** Signed-in users upload post photos/videos and journal photos (`entry`); covers stay admin-only; uploader can edit alt text.
6. **P2-02 Create post.** `/api/me/posts` CRUD + publish, tags, own-work confirmation, verified email to share, 50 drafts / 20 shares a day. **Instagram flow** at `/create` (Pick → Arrange → Details → Share, autosaving drafts, sheets, live preview from 1024px, one confetti). No photo size limit (PO); photo editor (crop / zoom / rotate) on canvas; profile Posts tab with "Your drafts"; step photos.
7. **P2-03 Creative journal.** `/journal`, project pages `/projects/{id}` per design `1g`, "Start as my project", Share → draft post, profile Projects tab.
8. **P2-04 Comments.** Post-page section (below related posts under 1024px, below steps from 1024px); one level of replies; edit ("edited"); delete (keeps "Comment deleted" while replies exist); post author can delete any; 20 at a time; 30 an hour. Count kept in the query cache (it reset when the viewport crossed 1024px — fixed).
9. **P2-05 Likes.** Heart on the post page, optimistic, one per user; "{n} likes" for the post's author only.
10. **P2-06 Follows.** Follow / Following on the creator row and public profiles; owner-only counts and lists (`/profile/followers`, `/profile/following`); feed **Following** chip and a ranking boost (`followBoost` = **+4**, PROPOSED).
11. **P2-07 Notifications.** Live bell with a coral dot (60 s poll), `/notifications` (likes grouped per post per day; opening marks read), `/settings/notifications` (four switches), 90-day purge in the daily jobs.
12. **P2-08 Safety.** Report posts and comments (reasons include "Not my work"); block both ways (profile, posts, comments, feed, search, notifications hidden; follows removed); Settings → Blocked accounts; **MODERATOR** role works `/admin/reports` only; hidden posts/comments show only to their author ("Hidden after a report") and moderators; all audited.
13. **Content moderation (PO question).** Only usernames, display names, custom skill names and post tags are word-checked; nothing checks images or videos. Recorded as **OD-37 (open)** with three options; PO will decide after Phase 2.
14. **Deployment doc.** Phase 2 needs no new env vars; migrations apply on deploy; Phase 2 smoke checks added.

## Done
- **☑:** P2-00, P2-01, P2-09.
- **◐ (built, awaiting PO screen review):** P2-02 … P2-08. Phase 1 ◐ tasks still await review too.
- **Migrations:** `user_posts_tags`, `creative_journal`, `comments`, `post_likes`, `follows`, `notifications`, `safety`, `blocks`.
- **New modules:** `journal`, `comments`, `likes`, `follows`, `notifications`, `blocks` (+ `reports` extended, block reads in `users`).
- **Last runs:** 599 unit/integration tests; E2E-19…25 pass on mobile and desktop; affected E2E specs (reports, admin, comments, post-detail, profile, create-post, accessibility) 56 passed; lint, types, format clean. Not run: the full E2E suite and WebKit/Firefox.

## Verify (PO)
1. Restart `pnpm dev` after pulling (new Prisma client; run `pnpm db:generate` and `pnpm prisma migrate dev`).
2. Review screens at 390/834/1280: Create, Journal, comments, heart, Follow and lists, notifications (bell, list, settings), block / report menus, Blocked accounts, moderator reports queue.
3. Answer the **"PO to confirm"** items in README §2: follow boost +4; bell only on phones and the feed header (none on other tablet/desktop pages); "Not my work" wording; no screen yet to assign Moderators (API only); hidden own post listed with drafts; journal entry title; newest-entry dot still; "Comment deleted" gets no new replies; "A dodoi member" for hidden profiles.
4. Confirm CI is green incl. WebKit/Firefox smoke (closes P0-09, P1-34).
5. After the test site deploys: run the Phase 2 checks in `docs/DEPLOYMENT.md`.
6. Still open: **OD-37** content/image moderation, **MOD-06** email reports (needs terms and support address, OD-26), OD-05 legal wording, Lighthouse re-run on `/feed` (P1-31), seed content (P1-19), pre-launch gate.

## Gotchas
- After a migration, regenerate the client (`pnpm db:generate`) and restart `pnpm dev`.
- Only one `next build` can run at a time: a review server or another E2E run holds the lock.
- Sign-in allows 5 per 15 min per email: clear `rate_limit_bucket` in the dev DB when scripting many sign-ins.
- In Playwright, `name: "Next"` also matches the Next.js dev-tools button; use `exact: true`. Streamed pages answer 200 even when they render not-found: assert on the "We couldn't find that page" heading, not the status.
- E2E reports and notifications share one test database across parallel workers: target your own item (for example the card for your post) instead of `.first()`.
- A toast raised before a full page load is lost (module state); tests that start from `page.goto` should assert the URL instead.

## Next
1. PO reviews and the "PO to confirm" answers above; fix what they find.
2. Possible small follow-ups: a screen for admins to assign Moderators; a bell on tablet/desktop pages other than the feed (needs a designed place).
3. Phase 2 exit once reviews and deploy checks are done; then decide OD-37, and plan Phase 3 (P3-00 spec).
