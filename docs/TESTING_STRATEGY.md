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
- **External services:** Cloudinary, Resend and Google are **never** called in automated tests. Use fakes implementing the integration interfaces (`FakeEmailProvider` captures sent emails so tests can read verification links).
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
- [ ] Deletion: deactivated immediately, cancel within 14 days, hard delete job removes listed data
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
| E2E-02 | Google sign-in (mocked provider in test env) success and cancel paths |
| E2E-03 | Password reset end-to-end |
| E2E-04 | User selects interests, then updates interests in settings; feed changes |
| E2E-05 | User adds a custom interest; another user can find it in search |
| E2E-06 | Feed: scroll several pages without duplicates; "Not interested" hides item with undo |
| E2E-07 | Open post detail, view tutorial steps, open skill page from chip |
| E2E-08 | Save post → create collection → add → rename → delete collection → post still in All saved |
| E2E-09 | Search partial keyword; no-results state |
| E2E-10 | Edit profile; public profile shows changes; private fields absent |
| E2E-11 | Unauthorized user attempts to open another user's private collection URL → not found |
| E2E-12 | Admin creates, publishes and unpublishes a post; non-admin cannot reach `/admin` |
| E2E-13 | PWA: manifest present, service worker registered, offline fallback page shown when offline |
| E2E-14 | Expired session redirects to sign-in and returns to original page |
| E2E-15 | Feed filter chips: switching to an interest chip shows only that skill; "New to you" shows only non-interest skills; "Try it →" on suggestion card opens skill page |
| E2E-17 | Tick materials and mark steps done/undone on a tutorial; reload / second browser context → progress restored |
| E2E-18 | Onboarding: continue disabled until 3 interests, no Skip on step 1; steps 2 and 3 skippable; username auto-generated and editable |
| E2E-16 | Coming-soon items (Create, Community, bell, Ask dodoi…) are announced as disabled and trigger no network calls to unbuilt endpoints |

Later phases add the master doc scenarios: create/edit post, comment, join community, send message, help request, schedule session, AI guidance, report/block.

**Viewports:** every E2E runs on a mobile profile (e.g. Pixel/iPhone emulation) and desktop Chromium. WebKit and Firefox run on a smaller smoke subset (PROPOSED).

## 6. Accessibility Testing

- Automated: axe on every page visited in E2E; **fail on serious/critical violations**.
- Component tests assert accessible names/roles (`getByRole`) rather than test IDs where possible.
- Manual checklist per new screen: keyboard-only navigation, visible focus, focus return after dialogs, screen-reader labels (VoiceOver/TalkBack spot checks), 200% zoom, reduced motion, color-alone check.

## 7. AI Evaluation (Phase 4)

Defined now so it is not forgotten; implemented in P4.

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
- Report tests not run in every session summary (AI_DEVELOPMENT_RULES §9).
