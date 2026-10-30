# dodoi — Summary (29–30 Oct 2026)

Continues `PROJECT_SUMMARY_2026-10-29.md`. Details: README §2 decision log, `docs/IMPLEMENTATION_ROADMAP.md`. Everything below is committed to `development` (last commit `02d2d2e`, P3-03); the working tree was clean at the end of the session. Not merged to `main` yet.

## Rules to carry into the next window

- Read `AGENTS.md` and `docs/AI_DEVELOPMENT_RULES.md` first. Key rules: **no git writes** (the PO does every add, commit and push); **docs in the same change** as the code (README §2, then the §13 map); **mobile, tablet and desktop together**, checked at 390, 834 and 1280px; **ask, don't assume** for anything undocumented; never call a task done without the gates (lint, typecheck, test, and E2E when UI flows change).
- This Next.js has breaking changes: check `node_modules/next/dist/docs/` before writing framework code.
- **Test database:** unit, integration and E2E all use `dodoi_test`. Never run two of them at once (it caused mass failures once). Also check `pgrep -f "next build"` before an E2E run; a stray build holds the lock and the run will not start.
- **AI evals** (`pnpm test:ai-evals`) are run by hand only: they need `AI_TIER=free` and a local environment, send synthetic prompts to Google, and never run in CI.

## State at the end of the session

- Branch `development`, clean. Recent commits: `02d2d2e` P3-03 help requests · `6da1ce5` P3-00 spec · `2592f8b` P4-08 scope · `5a7f542` build fix · `1fbc9eb` P4-06 evals · `9cc80ad` P4-05 · `731d8d2` P4-07.
- Last full gates: lint, typecheck and prettier clean · **696 unit and integration tests** pass · **E2E 235 passed, 19 skipped, 0 failed** on a production build · **AI evals 41 of 41** on the final prompts.

## Checkpoints

### Phase 4 — AI companion (all tasks built)

1. **P4-02 chat screens.** Routes `/companion`, `/companion/new`, `/companion/{id}`. Phones: full-screen chat (`1f`). Tablet: rail + page. 1280px+: list and chat side by side. Docked panel on post and skill pages at 1280px with the sidebar becoming the icon rail (CSS `group-has-[[data-companion-dock]]`; the post keeps a single column when docked). Ask dodoi pill and card go live; "Ask about this" on posts; "What is this and how do I start?" on skill pages (puts the question in the field, does not send). "Test version" free-tier notice under the header while `AI_TIER=free`. Typing indicator, AI label, "Answers can be wrong.", Helpful / Not helpful, Report, exact skill names become links, interests consent sheet for "What should I try next?", limit, resting, blocked, offline and unverified states. Reporting an AI answer uses new target `AI_MESSAGE` (migration `report_ai_message`); moderators see only that answer's text and can only Dismiss.
2. **P4-03 project plans.** `POST /api/ai/plan` (same gates and limits as a message; JSON-schema answer validated, one retry); plan card with **Start as my project** (private journal project; `POST /api/me/projects` gained `materials`). Plans are not saved after a reload; steps are not copied into the project. Verified on the real API.
3. **P4-04 photos.** Camera button, first-time consent sheet (with the free-tier line), upload as purpose `ai` (browser shrink over 10 MB; the server already scales to 1,568 px), thumbnail with remove, daily-photo limit message. Question text is still required with a photo.
4. **P4-07 Settings → AI and privacy.** `/settings/ai`: the two consent switches (saved at once), conversation list, delete one, delete all (confirmation sheets). The chat consent sheets point to it.
5. **P4-05 admin.** `/admin/ai` (admins only): kill switch stored in the new `app_setting` table (audited as `ai.switch_on` / `ai.switch_off`; cannot turn on a server with no key or model), today's cap with a warning, 7/30/90-day usage (requests, tokens, estimated cost, error rate, blocked), per-day table. `GET /api/admin/ai/usage` and `PUT /api/admin/ai/switch`.
6. **P4-06 eval suite.** `vitest.ai-evals.config.mts`, `tests/ai-evals/` (41 cases: quality, uncertainty, injection, privacy, scope, safety, plans, photos). Guarded to local + free tier. Run 1 found a **real injection gap** (an instruction planted in profile text was obeyed) → prompt hardened. Results and history: `docs/AI_INTEGRATION.md` §14b and §14c.
7. **P4-08 scope restriction (PO request, Option A).** The companion talks only about making, creating and learning those skills; anything else gets a short warm redirect; mixed questions get the making part; "ignore your rules" does not change it. Prompts `companion-2026-3` and `plan-2026-2`. The first wording over-restricted (resin, candles, mixed questions) and was widened after the evals. **Option B** (a server-side topic check before answering) is not built: only add it if the evals or real use show leaks.

### Phase 3 — community (in progress)

8. **P3-00 spec approved by the PO as written (2026-10-30).** PO decisions: **OD-06** any verified member can create a community, public only; **OD-03** sessions use an external meeting link (no video inside dodoi); **P3-03 first**. The spec is in PRODUCT_REQUIREMENTS §6.3 (COM, MSG, HLP, SES, USE), USER_FLOWS F-27…F-30, DATABASE_SCHEMA §9.3, API_SPECIFICATION §9.3, UI_UX §8.3, SECURITY §8, TESTING_STRATEGY and the roadmap.
9. **P3-03 help requests (built).** Migration `help_requests` (`help_request`, `help_request_media`, `help_response`; notification `help_request_id` and `subject`; media purpose `help`; report targets `HELP_REQUEST` / `HELP_RESPONSE`). `help` module: 5 requests and 30 replies a day, verified members only, own photos only, statuses Open / In progress / Resolved (asker only), "This helped" mark with no scores, 90-day list rule, blocks both ways, hidden requests 404 for others, delete with photos. Routes `/api/help-requests` and `/api/help-responses/{id}/helpful`. Notifications `HELP_RESPONSE`, `HELP_HELPFUL`, `HELP_RESOLVED` with three new switches. UI: Community live in tab bar, sidebar and rail; `/community` (tabs, banner, filter chips, list), `/community/help/new`, `/community/help/{id}`; right-rail "Help other makers" and a feed "Help request" card (after the third post of each For you page; in the right rail from 1280px); **Ask the community** under AI answers opens a request with the question filled in. E2E-33 (two journeys); E2E-16 (coming-soon tooltip) moved to the Sessions tab.

### Other

10. **Docs sync audit** before the merge: fixed README (provider no longer OPEN, phase status) and DEPLOYMENT (both AI routes need the 60 s limit).

## Next steps (in order)

1. **P3-01 communities** (migration, service, routes, UI at three widths, tests, E2E-34, docs). Spec: COM-01…08, F-28, DATABASE_SCHEMA §9.3, API §9.3. Then **P3-02 messages**, **P3-04 sessions**, **P3-05 "Use what you have"** (a companion chat prompt, not a screen). Once those exist, add the per-reply **Message** and **Propose a session** buttons on help requests.
2. **PO review before Phase 4 exit:** screenshots at 390 / 834 / 1280px of `/settings/ai`, `/admin/ai`, the photo UI, the plan card and `/community` (the chat and help screens were checked once; the tab fix on phones was not re-shot).
3. **Merge `development` into `main`** after the PO reviews.

## Open points (all in README §2 as "PO to confirm")

- **P4-02:** moderators can only Dismiss a reported AI answer; the skill-page question is put in the field, not sent; no "uncertainty line" (the model gives no marker); the docked chat is remembered per page for the browser tab only.
- **P4-03:** plans are not kept after a reload; steps are not copied into the project; typing "plan a project" is an ordinary question.
- **P4-04:** question text still required with a photo; photos over 10 MB are shrunk, not refused.
- **P4-05:** the `app_setting` table; "requests" excludes quota refusals; a `dailyCap` field was added to the usage response; tiles and a table, no chart; no alert when the cap is reached.
- **P4-06:** the case list and the 80% quality bar; evals run by hand before each prompt or model change.
- **P4-07:** its own settings entry, separate from Privacy; deleting asks first.
- **P4-08 scope defaults:** "learning" means crafts and creative skills; selling or running a craft business is out of scope; the redirect is free text, not fixed copy.
- **P3-03:** list chips and default; feed card placement; predefined skills only in the ask form; no edit or delete of a reply by its author; no alt-text field on request photos.

## Known limitations

- Plans are not persisted. A reply cannot be edited or deleted by its author yet. No Message / Propose a session buttons until P3-02 and P3-04. Your circles and Sessions are coming-soon tabs.
- The AI scope restriction is a strong nudge, not a guarantee; wording varies run to run.
- A few E2E tests (post ticks, skill-page interests) have flaked under full parallel load but pass alone and in whole-file reruns.

## Before production

- Set `AI_TIER=paid` (billing enabled, no-training terms), or leave `AI_ENABLED` off: the server refuses `AI_TIER=free` when `APP_ENV=production`.
- `/api/ai/messages` and `/api/ai/plan` both need a 60 s function limit on the host; record the free-tier limits from Google AI Studio in `docs/DEPLOYMENT.md` once known.
- `pnpm test:ai-evals` again whenever the prompts or the model change (and when the paid model is chosen).

## Key files

- **AI:** `src/server/modules/ai/` (`service.ts`, `prompts/companion.ts`, `prompts/plan.ts`), `src/components/companion/`, `src/app/(app)/companion/`.
- **AI admin and settings:** `src/components/admin/ai-usage-dashboard.tsx`, `src/app/admin/ai/`, `src/components/settings/ai-privacy-form.tsx`, `src/app/(app)/settings/ai/`.
- **Evals:** `tests/ai-evals/`, `vitest.ai-evals.config.mts`; results in `test-results/ai-evals.jsonl` (git-ignored).
- **Help requests:** `src/server/modules/help/`, `src/components/community/`, `src/app/(app)/community/`, `src/app/api/help-requests/`.
- **Docs:** `docs/AI_INTEGRATION.md` §14b, §14c; `docs/IMPLEMENTATION_ROADMAP.md` rows P3-00…P3-03 and P4-01…P4-08; README §2 rows for each task above.
