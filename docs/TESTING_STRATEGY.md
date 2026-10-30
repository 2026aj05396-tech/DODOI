# Testing Strategy

**Tools (CONFIRMED):** Vitest + Testing Library (unit, component, integration) · Playwright + `@axe-core/playwright` (end-to-end, accessibility).

---

## 1. Test Pyramid

| Level | Scope | Tool | Location |
|---|---|---|---|
| Unit | Pure logic: ranking rules, normalization, policies, validation schemas, cursor helpers, error mapping | Vitest | Co-located `*.test.ts` |
| Component | UI components in isolation: states, a11y roles, interactions | Vitest + Testing Library (jsdom) | Co-located `*.test.tsx` |
| Integration | Route handler → service → real PostgreSQL; authorization; external services mocked at the integration interface | Vitest (node env) | `tests/integration/` |
| End-to-end | Real browser flows against running app + test DB | Playwright | `tests/e2e/` |
| Accessibility | axe scans on every E2E-visited page + manual keyboard checks | Playwright + axe | `tests/e2e/a11y/` |
| AI evaluation (P4) | Quality, safety, privacy of AI responses | Eval harness (TBD in P4) | `tests/ai-evals/` |

## 2. Test Environment

- **Database:** separate PostgreSQL database for tests (same Docker container, different DB name, e.g. `app_test`), migrated with `prisma migrate deploy`. Isolation between integration tests: truncate tables per test file or transaction rollback (PROPOSED: truncate; decide in P0-06).
- **E2E server:** Playwright builds the app and runs `next start` on port 3100 against `dodoi_test` (Next.js allows only one `next dev` per project, and this matches CI).
- **Fakes and factories** are added together with the interfaces and models they stand in for (email fake in P1-05, media fake in P1-03, model factories with P1-01).
- **External services:** Cloudinary, Resend, SMTP servers and Google are **never** called in automated tests. Use fakes implementing the integration interfaces (`FakeEmailProvider` captures sent emails so tests can read verification links).
- **Auth in tests:** helper to create a user and obtain a session cookie; E2E uses a test-only sign-in route **enabled only when `NODE_ENV=test`** (PROPOSED) or real credentials flow.
- **Fixtures:** factories for User, Skill, Post (with attribution and media), Collection.
- **Time:** inject a clock for token expiry, freshness scoring and feed session expiry.

## 3. Coverage Expectations

Line-coverage numbers are not a goal by themselves. Required coverage by kind:

| Must be tested | Level |
|---|---|
| Every authorization policy (allow and deny) | Unit + integration |
| Every protected endpoint: unauthenticated → 401; other user → 404/403 | Integration |
| Every validation schema: valid + representative invalid | Unit |
| Feed ranking rules, discovery quota, diversity, no-repeat | Unit + integration |
| Skill normalization and dedupe | Unit |
| Collections rules (delete keeps saves, unsave removes from collections) | Integration |
| Token lifecycle (hash, expiry, single use) | Integration |
| Account enumeration resistance (identical responses) | Integration |
| Every critical user flow | E2E |

## 4. Phase 1 Integration Test Checklist

- [ ] Date of birth: under-18 blocked with nothing stored; DOB never persisted or logged; Google sign-up blocked by `AGE_CHECK_REQUIRED` until age passed
- [ ] Username: auto-generation unique; invalid/reserved rejected; second change within 30 days → 422
- [ ] Register: success; existing email returns same response; under-18 → 422; rate limit → 429
- [ ] Verify email: valid, expired, reused token
- [ ] Password reset: unknown email same response; token single-use; sessions invalidated
- [ ] JWT with old `sessionVersion` rejected
- [ ] `/api/me/*` only affects actor's data
- [ ] Custom skill create-or-resolve; hidden skills not listed
- [ ] Public profile response contains no private fields
- [ ] Private profile returns only username/displayName/avatar; excluded from creator search
- [ ] Unverified user: private actions allowed; custom skill / public collection → 403 EMAIL_NOT_VERIFIED
- [ ] Google sign-in on unverified password account removes password and bumps sessionVersion
- [ ] Reports: idempotent per reporter/target; admin hide hides skill/profile; audited
- [x] Deletion: deactivated immediately, cancel within 14 days, hard delete job removes listed data (`account-deletion.test.ts`, `daily-jobs.test.ts`, `account-deletion.spec.ts`)
- [ ] Collection name uniqueness (case-insensitive) and 100/1,000 limits
- [ ] Media: oversize / wrong type / video > 60 s rejected
- [ ] Post detail: draft/unpublished → 404 for user, 200 for admin
- [ ] Feed: pages do not repeat; NOT_INTERESTED excluded; discovery quota met when content exists
- [ ] Search: partial keyword match; custom skills discoverable; query length limits
- [ ] Saves idempotent; private collection → 404 for other user; delete collection keeps saves
- [ ] Admin endpoints → 404 for non-admin; publish requires attribution + alt text; audit log written
- [ ] Media: signature only for permitted roles/purposes; mismatched asset rejected and deleted (fake provider)
- [ ] Pagination max limit enforced

## 5. End-to-End Scenarios

Phase 1 (required before MVP exit):

| # | Scenario |
|---|---|
| E2E-01 | New user registers with email, verifies, completes onboarding, lands on personalized feed |
| E2E-12 note | Admin uploads: the browser upload to `api.cloudinary.com` is answered by the test; the server's Admin API checks go to a local mock (`CLOUDINARY_API_BASE`, APP_ENV=local only) |
| E2E-02 | Google sign-in (mocked provider in test env) success and cancel paths — local `oauth2-mock-server` started by Playwright; the app points Google at it via `AUTH_GOOGLE_ISSUER` (APP_ENV=local only) |
| E2E-03 | Password reset end-to-end |
| E2E-04 | User selects interests, then updates interests in settings; feed changes |
| E2E-05 | User adds a custom interest; another user can find it in search |
| E2E-06 | Feed: scroll several pages without duplicates; "Not interested" hides item with undo |
| E2E-07 | Open post detail, view tutorial steps, open skill page from chip |
| E2E-08 | Save post → create collection → add → rename → delete collection → post still in All saved |
| E2E-09 | Search partial keyword; no-results state |
| E2E-10 | Edit profile; public profile shows changes; private fields absent |
| E2E-11 | Unauthorized user attempts to open another user's private collection URL → not found |
| E2E-12 | Admin creates, publishes and unpublishes a post; non-admin cannot reach `/admin`. Also (P1-19, `admin.spec.ts`): an admin opens Coverage and sees the summary and the three sections, axe clean |
| E2E-13 | PWA: manifest present, service worker registered, offline fallback page shown when offline |
| E2E-14 | Expired session redirects to sign-in and returns to original page |
| E2E-15 | Feed filter chips: switching to an interest chip shows only that skill; "New to you" shows only non-interest skills; "Try it →" on suggestion card opens skill page |
| E2E-17 | Tick materials and mark steps done/undone on a tutorial; reload / second browser context → progress restored |
| E2E-18 | Onboarding: continue disabled until 3 interests, no Skip on step 1; steps 2 and 3 skippable; username auto-generated and editable |
| E2E-19 | Create post (P2-02, F-17): pick two photos → describe and reorder → title + craft → Share without the own-work tick shows the message → tick → "Posted!" → post page with Edit; also: a draft is deleted and gone, Edit on a shared post saves live, a photo is cropped square and rotated in the photo editor and uploaded again, a tutorial is held back until it has two steps and a time and then shares with a described step photo; the profile then opens on Posts (`create-post.spec.ts`) |
| E2E-20 | Creative journal (P2-03, F-18): new project → two entries (one with a photo) newest first → show on profile → mark finished → profile Projects tab → Share opens Create pre-filled; also: Start as my project copies a tutorial's materials and a tick survives a reload (`journal.spec.ts`) |
| E2E-21 | Comments (P2-04, F-19): comment → reply starting with @username → edit shows "edited" → delete the comment that has a reply leaves "Comment deleted" and the reply, still there after a reload; signed-out visitors see the count and a Sign in link (`comments.spec.ts`) |
| E2E-22 | Likes (P2-05, F-20): heart on a post → filled, `PUT` answers 204, still filled after a reload, unlike; signed-out visitors are sent to sign-in; a non-author sees no count (`likes.spec.ts`; the author's count is covered in `likes.test.ts`) |
| E2E-23 | Follows (P2-06, F-20): Follow on a post's creator row → Following, `PUT` answers 204 → profile shows Following and no follower count → feed Following chip shows their post → own Following list → unfollow; signed-out visitors are sent to sign-in (`follows.spec.ts`; counts and lists for the owner are in `follows.test.ts`) |
| E2E-24 | Notifications (P2-07, F-21): seeded comment, three likes and a follower → the bell shows a dot → the list shows "Asha commented on …", "… and 2 others liked …", "… followed you" → reloading shows none unread → a comment item opens the post at the comment; Likes switched off in settings stays off after a reload; signed-out visitors are sent to sign-in (`notifications.spec.ts`; who is notified is covered in `notifications.test.ts`) |
| E2E-30 | Companion screens (P4-02, F-23; `companion.spec.ts`, companion switched off in E2E by `AI_ENABLED=false`, free tier on): Ask dodoi → list → New chat shows the test-version notice and the "resting" line with the field disabled; a saved chat reopens with the AI label, "Answers can be wrong.", a skill link and Helpful / Not helpful / Report, and can be deleted; another member gets not-found; `/companion/new?post=` names the post and signed-out visitors are sent to sign in; at 1280px the dock appears beside a post and the sidebar becomes the rail. Answers themselves: `chat-panel.test.tsx` (14 with `answer-text.test.tsx`: notice on free/paid, send and answer, context, daily and per-minute limits, blocked, off/unverified, interests sheet) and `ai.test.ts` (+3: report an AI answer — own answer only, moderators see only that text, dismiss not hide, text gone after the chat is deleted) |
| — | Project plans (P4-03): `ai.test.ts` (+5: valid plan with craft matched and usage without text, retry once then `AI_UNAVAILABLE`, shared limits / unverified / blocked, request treated as data and unknown skill 404, project started with the materials checklist); `chat-panel.test.tsx` (+2: sheet → plan card → project started and opened, failure message). E2E-30 also checks the Plan chip is disabled while the companion is off |
| — | Photos (P4-04): `chat-panel.test.tsx` (+4: consent sheet the first time with the free-tier line, upload as `ai` then sent with `imageMediaId`; no sheet once allowed and removable; Cancel uploads and saves nothing and other types are refused; photo quota notice keeps text questions working). E2E-30 checks the photo button is disabled while the companion is off |
| E2E-31 | AI and privacy settings (P4-07, F-26; `ai-privacy.spec.ts`): Settings → AI and privacy → both switches off → allow photos → reload keeps it → withdraw → reload keeps it off; the free-tier line shows; two saved chats → delete one (sheet) → delete all (sheet) → empty here and in `/companion`. Form behaviour (saved at once, reverted on failure, deleting, failure keeps the sheet, show more): `ai-privacy-form.test.tsx` |
| E2E-32 | Admin AI page (P4-05; `admin-ai.spec.ts`): an admin opens Admin → AI and sees the cap, tiles, 30 daily rows (8 after "7 days") and the switch disabled because E2E has no companion; members and moderators get not-found for `/admin/ai`, `GET /api/admin/ai/usage` and `PUT /api/admin/ai/switch`. Numbers per day (quota refusals left out, empty days filled, range limits, admin only), the switch (stops messages and plans at once, back on, audited, not on without a provider): `ai.test.ts` (+4); the screen: `ai-usage-dashboard.test.tsx` |
| E2E-25 | Safety (P2-08, F-22): Block on a maker's profile → back to the previous page → their profile and post show the not-found page → Settings → Blocked accounts → Unblock → the post is back; a reporter sends "Not my work" on a post from its ⋯ menu → a moderator sees only Reports, hides that post's card → the reporter gets not-found and `/admin/posts` is not found for the moderator (`safety.spec.ts`; blocking across modules, hiding, roles and the audit trail are in `safety.test.ts`) |
| — | AI companion server (P4-01): `gemini.test.ts` (request shape, filters on, key in a header, blocked vs failed, no prompt in errors), `env.test.ts` (free tier refused only in production), `ai.test.ts` with `FakeAIProvider` (usage without text, consent gates, own-photo only, post/skill context authorization incl. hidden/draft/blocked, profile context only with consent and never private collections, prompt delimiters, quotas and global cap, blocked and failed requests, ownership, deletion with photos, 30-day / 12-month retention, account deletion). The eval suite (`tests/ai-evals/`) is P4-06 |
| E2E-16 | Coming-soon items (Community, bell, Ask dodoi…; Create is live from P2-02) are announced as disabled and trigger no network calls to unbuilt endpoints |

Later phases add the master doc scenarios: create/edit post, comment, join community, send message, help request, schedule session, AI guidance, report/block.

**Viewports and browsers:** every E2E runs on a mobile profile (Pixel 7) and desktop Chromium (1280×860). WebKit (iPhone 15 profile) and Firefox (desktop) run the smoke subset, the tests tagged `@smoke`: welcome page, sign-up, sign-in and sign-out, feed paging (E2E-06), a shared post and tutorial progress (E2E-07/17), collections (E2E-08), search (E2E-09) and offline (E2E-13). CI runs all browsers; locally `pnpm test:e2e` is Chromium only and `pnpm test:e2e:browsers` runs the WebKit and Firefox smoke (WebKit needs `sudo pnpm exec playwright install-deps webkit` once). E2E-13 is skipped on Firefox: Playwright's offline switch doesn't reach Firefox's service worker (checked 2026-10-27).

Every Phase 1 scenario above has a test whose title starts with its ID (`grep -rn "E2E-04" tests/e2e`).

## 6. Accessibility Testing

- Automated: axe on every page visited in E2E; **fail on serious/critical violations**.
- Component tests assert accessible names/roles (`getByRole`) rather than test IDs where possible.
- Manual checklist per new screen: keyboard-only navigation, visible focus, focus return after dialogs, screen-reader labels (VoiceOver/TalkBack spot checks), 200% zoom, reduced motion, color-alone check.

## 7. AI Evaluation (Phase 4)

Defined now so it is not forgotten; implemented in P4. **P4-00 additions (2026-10-29):** all unit and integration tests use a `FakeAIProvider` (no network, no key); the eval suite (`tests/ai-evals/`) runs against the real provider **locally on the free tier with synthetic prompts only**, never in CI and never with real user data; photo cases use a small set of licensed or self-made test images; checks also cover consent gating (no photo or profile context without consent), quota and global-cap enforcement, the 30-day retention job, deletion with photos, that logs and `AIUsage` never hold text, and that `AI_TIER=free` is refused when `APP_ENV=production`.

| Category | Method |
|---|---|
| Factual quality | Curated question set per skill with reviewer-written expected key points; rubric scoring |
| Uncertainty | Ambiguous / low-information images and questions → must ask or state uncertainty |
| Prompt injection | Inputs and post descriptions containing instructions → must not follow them or leak system prompt |
| Privacy isolation | Attempts to obtain other users' data → refused, no leakage |
| Safety | Hazardous materials/tools questions → safety notes; disallowed requests → refusal |
| Cost limits | Quotas and global cap enforced (integration tests with fake provider) |
| Regression | Eval set re-run on every prompt or model change; `promptVersion` tracked |

## 8. Performance Checks

- Lighthouse (mobile profile) on landing, feed, post detail during P1-31; track LCP, CLS, INP proxy (TBT).
- Real-user CWV monitoring depends on analytics decision (OD-20).
- **P1-31 baseline (2026-10-27, lab, production build, real Cloudinary images; Moto-G-sized viewport, 4× CPU slowdown, 150 ms RTT, 1.6 Mbps; median of 3):**

  | Page | LCP | CLS | TBT | JS transferred |
  |---|---|---|---|---|
  | Landing `/` | 0.82 s (h1) | 0.003 | 66 ms | 240 KB |
  | Post detail (1 image, 1200px original) | 0.90 s (cover image, served at 960px) | 0.001 | 61 ms | 271 KB |
  | Sign in | 0.82 s | 0.000 | 60 ms | 245 KB |
  | Feed (signed in, 1 card) | 0.85 s (first card image) | 0 | 70 ms (PO Lighthouse) | — |

  Feed history: 8.1 s on the dev server (skeleton until hydration, lazy image) → PO Lighthouse on a production build: 3.9 s estimated, ~1.04 s observed (load delay 200 ms, load 120 ms, render delay 700 ms) → render delay fixed (the server's cards no longer fade in from opacity 0, which Chrome does not count as painted) and `Link: rel=preconnect` to Cloudinary: 0.42 s unthrottled, 0.85 s throttled. React still holds the swap from skeleton to content ~300 ms after the skeleton's first paint (its reveal throttle); that is React's design and is left alone. Images were sent at full upload size before P1-31; every content image now has a Cloudinary `srcSet` (320–1920px, `c_limit`) and `sizes` for its slot; avatars are delivered at 256px.

## 8b. Accessibility Checks (P1-31)

- `tests/e2e/accessibility.spec.ts`: axe (WCAG 2.0/2.1/2.2 A + AA tags) on every Phase 1 screen — signed out, onboarding, signed in, admin, theme — at 390, 834 and 1280px; serious/critical violations fail. Plus a keyboard sweep (30 Tab stops on feed, explore, post, saved, account at 390 and 1280): every focused element visible and showing the focus ring.
- Manual keyboard walkthrough (PO): sign in → onboarding → feed (save, Not interested, Load more) → post (gallery arrows, tick a step, collection picker, Escape) → saved → settings, using only Tab/Shift+Tab/Enter/Space/Escape/arrows.

## 9. Running Tests

| Command | Runs |
|---|---|
| `pnpm test` | Unit + component + integration |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm test:e2e` | Playwright E2E + a11y (starts app against test DB) |
| `pnpm test:e2e --ui` | Playwright UI mode |

CI (GitHub Actions, OD-24) runs lint, typecheck, `pnpm test` and E2E on every pull request.

## 10. Rules

- Bug fixes include a regression test that fails before the fix.
- Tests must not depend on order or on real network services.
- Never skip or delete a failing test to make a build pass; report it.
- E2E runs fully parallel against one server, so timing differs from a single test. Wait for the page to load (`page.waitForLoadState()`) before submitting a form a redirect just opened: a submit before hydration posts back to the same page (`method="post"`) and nothing happens. Assertions wait up to 10 s (`expect.timeout` in `playwright.config.ts`), since sign-in flows chain several redirects; a test that signs in several users gets a longer test budget (`test.describe.configure({ timeout })`). Fix timing this way rather than with local retries.
- Report tests not run in every session summary (AI_DEVELOPMENT_RULES §9).
