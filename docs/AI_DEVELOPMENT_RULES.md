# AI Development Rules

**Mandatory for every AI coding agent and every session.** This project is built from scratch with AI assistance across many sessions. These rules keep the work consistent, honest and safe.

---

## 1. Before Writing Any Code

Every session starts by reading, in this order:

1. [README.md](../README.md) — confirmed decisions and setup.
2. This file.
3. [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) — find the task ID you are working on and its dependencies.
4. The documents relevant to the task: PRODUCT_REQUIREMENTS (requirement IDs), USER_FLOWS, UI_UX_GUIDELINES, SYSTEM_ARCHITECTURE, DATABASE_SCHEMA, API_SPECIFICATION, SECURITY_AND_PRIVACY, TESTING_STRATEGY (and AI_INTEGRATION for P4).
5. The existing code in the affected modules — follow its conventions.

If a session has no task ID, ask the product owner which task to work on.

## 2. No Assumptions Rule

The product owner has explicitly required: **do not assume anything that is not documented.**

- **CONFIRMED** items: implement as written.
- **PROPOSED** items: do not build on them until confirmed. Ask, and record the answer.
- **OPEN** items (`OD-xx`): stop and ask. Do not pick a value "for now", do not add placeholder behavior that silently becomes permanent.
- Anything not covered by the docs: ask before implementing. State the question, the options, and a recommendation.
- Never invent requirements, fields, endpoints, limits, copy, or UX that the docs do not contain.
- When the product owner answers, update the relevant document **in the same change** (change marker to CONFIRMED and record the decision in README §2 if it is a project-level decision).

## 3. Feature Workflow

For each task:

1. Restate the task, its requirement IDs and acceptance criteria.
2. List affected layers: UI, route handlers, services, schema, integrations.
3. Identify blockers (OPEN/PROPOSED dependencies) — ask before continuing.
4. Propose a short implementation plan; wait for approval when the plan changes architecture, schema, API contracts or UX.
5. Identify security, privacy and failure cases (use SECURITY §10 checklist).
6. Implement the smallest coherent slice end-to-end (DB → service → API → UI).
7. Add validation, error handling, loading/empty/error states.
8. Write or update tests (TESTING_STRATEGY).
9. Run `pnpm lint`, `pnpm typecheck`, `pnpm test` (and `pnpm test:e2e` when UI flows change). Before handing over, `/pre-commit-review` can be run for an independent review of the uncommitted changes.
10. Update documentation affected by the change, in the same change (§13).
11. Finish with a session summary (§9), including changed files and a suggested commit message. Do not stage, commit or push (§11).

## 4. Architecture Rules

- Modular monolith in Next.js. Layers: `app/` → `server/modules/*` → `server/db` / `server/integrations`. No layer skipping. UI and route handlers never import Prisma.
- Modules expose a public API via `index.ts`; never import another module's internals or query its tables.
- Authentication in route handlers; **authorization in services** with an explicit `actor`.
- Mutations go through `/api/*` route handlers. No Server Actions unless the decision changes.
- All inputs validated with Zod schemas from `src/lib/schemas`.
- Errors thrown as `AppError` subclasses; responses use the standard error format.
- Integrations (email, media, AI) only through their interfaces.
- No new architectural patterns (state libraries, data-fetching approaches, folder conventions) parallel to existing ones.

## 5. Coding Standards

- TypeScript `strict`; no `any` (use `unknown` + narrowing); no `@ts-ignore` without a comment explaining why.
- Naming: files `kebab-case.ts`, React components `PascalCase`, functions/variables `camelCase`, constants `SCREAMING_SNAKE_CASE`, DB models PascalCase.
- Components focused and small; business logic stays out of components.
- Styling only via Tailwind classes using design tokens; no raw hex values, no inline style objects for theming.
- Visual decisions come from `docs/design/` and UI_UX_GUIDELINES. Phase 1 screens that are not designed are built **only** from the existing tokens and components (UI_UX_GUIDELINES §8 rule) and flagged for product-owner review with screenshots; never introduce new visual styles. Do not copy the design file's inline styles or its `support.js` runtime into the app; rebuild with tokens and components.
- shadcn primitives live in `components/ui/`; adapt them there rather than duplicating.
- Accessible by default: semantic elements, labels, focus states, keyboard support.
- No commented-out code, no dead code, no TODOs without a task ID or OD reference.
- Comments explain *why*, not *what*.

## 6. Dependencies

- Do not add a dependency without stating: purpose, why existing tools are insufficient, maintenance status, bundle impact (client deps), license.
- Dependencies listed as PROPOSED in SYSTEM_ARCHITECTURE §3 still require approval.
- No paid services. Any service with a free tier must be flagged with its limits for the product owner.

## 7. Database Rules

- Schema changes only through Prisma migrations; never edit applied migrations.
- Every schema change updates DATABASE_SCHEMA.md in the same change.
- Explicit `onDelete` on every relation. Indexes for real query patterns only.
- Raw SQL only via tagged `$queryRaw`; never interpolate user input.
- Seed scripts must be idempotent.

## 8. Security Non-Negotiables

- Never trust client-supplied user IDs, roles or ownership.
- Private resources return 404 to non-owners.
- Public responses use explicit field selection.
- Secrets only server-side (`server-only`), never committed, never logged.
- No `dangerouslySetInnerHTML` with user content.
- Never disable a security control to make a test or feature pass.

## 9. Honesty and Reporting

- Never claim a feature is complete because the UI renders. Done = §10.
- Report exactly which checks/tests were run and their results. Report tests **not** run and why.
- Report known limitations and anything skipped.
- If something fails, show the failure; do not hide or work around it silently.

**Session summary template**
```
Task: P1-xx — <title>
Changes: <files/modules>
Requirements covered: <IDs>
Tests: <added/updated>; ran: lint ✓/✗, typecheck ✓/✗, test ✓/✗, e2e ✓/✗/not run (why)
Docs updated: <files>
Changed files (uncommitted): <list>
Suggested commit message: <type(scope): summary [TASK-ID]>
Decisions needed / questions: <list>
Known limitations / follow-ups: <list>
```

## 10. Definition of Done

A task is done only when:

- [ ] Acceptance criteria are met.
- [ ] Loading, empty, error (and offline where relevant) UI states exist.
- [ ] API and database behavior are correct and match the specs.
- [ ] Authorization is enforced server-side and tested.
- [ ] Errors are handled with the standard format and friendly UI messages.
- [ ] Relevant tests are written and pass.
- [ ] Every screen is built for **mobile, tablet and desktop in the same task** — never mobile-only with desktop "later" (PO instruction, 2026-10-24). Designed web layouts (`2a`–`2c`) are used where they exist; otherwise the desktop layout is built from the system. Accessibility and layout checked at 390, 834 and 1280px, with screenshots of all three for PO review.
- [ ] Documentation updated.
- [ ] Known limitations recorded.

## 11. Git — the product owner does all git operations

**Non-negotiable (product owner instruction, 2026-10-21):** AI agents have **no write access to git**. The product owner stages, commits, branches, merges and pushes.

- **Never run** git commands that change the repository or the remote: `git add`, `git commit`, `git push`, `git pull`, `git merge`, `git rebase`, `git reset`, `git checkout` / `git switch`, `git branch` (create/delete), `git stash`, `git tag`, `git cherry-pick`, `git revert`, `git rm`, `git mv`, `git restore`, `git init`, `git remote` changes, or anything equivalent through other tools.
- **Read-only** commands (`git status`, `git diff`, `git log`, `git show`) are allowed, only to report what changed.
- Agents edit files in the working tree only and leave every change **uncommitted**.
- At the end of each task, the session summary lists the changed files and a **suggested** commit message for the product owner, following these conventions:
  - Branch per task: `p1-21-feed-ranking`.
  - Conventional commits referencing task IDs: `feat(feed): rules-based ranking [P1-21]`.
  - One task per pull request where possible. Remote: GitHub; CI: GitHub Actions (OD-24).

## 12. When Docs and Code Disagree

Stop and ask. Do not "fix" either side silently. The docs are the source of truth until the product owner says otherwise.

## 13. Keep the Docs in Sync — Every Change, Same Change

**Product owner instruction (2026-10-28):** documentation is updated **in the same change** as the code, never "later". This covers every request, flow change, copy change, design update and decision the product owner mentions in a session — even a small one-line request.

1. **Record what the PO said.** A PO request or decision becomes a README §2 row (what, where, date, status). A changed or new journey goes into USER_FLOWS; a changed requirement into PRODUCT_REQUIREMENTS.
2. **Use the map below** to find every document the change touches; then `grep -ri` the docs for the feature's names (screen, component, route, copy) to catch mentions the map misses.
3. **Design updates:** when the PO updates the Claude Design project, refresh `docs/design/dodoi-app-v3.dc.html` from it (the source file, without the preview runtime the served copy injects) and record what changed.
4. **Deviations from the design** are written down where the screen is described (UI_UX_GUIDELINES §4/§8) and flagged as "PO to confirm" in README §2 — never left only in chat.
5. The session summary's **Docs updated** line lists each file, or says why none was needed. A change is not done (§10) until it is filled in.

| Change | Update |
|---|---|
| PO request or decision (anything the PO asks for) | README §2 (+ the documents below that it touches) |
| New or changed user journey, entry point, copy in a flow | USER_FLOWS (+ PRODUCT_REQUIREMENTS IDs) |
| Screen, component, layout, token, animation, empty/error state | UI_UX_GUIDELINES §3/§4/§8 (+ `/dev/ui` preview when it is a reusable component) |
| Requirement added, changed or clarified | PRODUCT_REQUIREMENTS |
| Task built, extended or re-scoped | IMPLEMENTATION_ROADMAP (task row "Built:" notes) |
| API route, request/response, error code | API_SPECIFICATION |
| Prisma schema / migration | DATABASE_SCHEMA (§7) |
| Architecture, caching, PWA/offline, integrations, env vars | SYSTEM_ARCHITECTURE, DEPLOYMENT, `.env.example` |
| Auth, privacy, data retention, headers/CSP | SECURITY_AND_PRIVACY |
| Tests added or test approach changed | TESTING_STRATEGY |
| Third-party code, fonts, images or data added | THIRD_PARTY_NOTICES (source, license, where used, changes) |
| Design file changed in Claude Design | `docs/design/` + the UI_UX_GUIDELINES rows it affects |
