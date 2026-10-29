---
name: pre-commit-review
description: Review all uncommitted changes in dodoi before the product owner commits them. Checks correctness, security, architecture, tests, docs sync, responsive/accessibility and commit hygiene against docs/AI_DEVELOPMENT_RULES.md, then outputs a prioritized, machine-actionable fix list an AI agent can implement. Use when asked to review changes, do a pre-commit review, or check work before committing.
---

# Pre-commit review

Review the working tree the way a senior engineer reviews a pull request, then hand back a fix list another AI agent can execute without asking questions.

## Ground rules

- **Read-only.** Never edit code in this skill, and never run git write commands (AI_DEVELOPMENT_RULES §11). Allowed git: `status`, `diff`, `log`, `show`.
- **The rules are the standard.** `docs/AI_DEVELOPMENT_RULES.md` (§4 architecture, §5 coding, §7 database, §8 security, §10 definition of done, §13 docs sync) is the checklist. Where docs and code disagree, report it as a question for the product owner; do not pick a side (§12).
- **This is a modified Next.js.** If a finding depends on a Next.js API behaving a certain way, check `node_modules/next/dist/docs/` before asserting it.
- **Evidence over opinion.** Every finding cites `file:line`, and says what is wrong and what breaks. Do not report style preferences that lint/prettier already enforce, and do not pad the report. If something is clean, say so.
- **Report only what you verified.** Mark anything you could not run or confirm as "not verified" with the reason.

## Step 1 — Scope the change

Run in parallel:

```
git status --short
git diff --stat
git diff            # unstaged
git diff --staged   # staged
git log -5 --oneline
```

Also read untracked files listed in `git status` (new files do not appear in `git diff`). Read each changed file in full, not only the hunks, when a hunk changes behavior. For large diffs, group by module and review each group.

Identify: the task ID (e.g. P2-xx) from the roadmap or the user, the modules touched, and whether the change includes schema, API, UI, tests, or docs.

## Step 2 — Run the automated gates

Run what applies and record exact results (pass/fail, counts, first failure):

```
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test
```

- Run `pnpm test:e2e` only when UI flows changed and the environment allows it; otherwise list it as "not run" with the reason.
- If `prisma/schema.prisma` changed, confirm a new migration exists, applied migrations were not edited, and `pnpm db:generate` is clean.
- A failing gate is a **Blocker** finding with the failure output summarized.

## Step 3 — Review against the checklist

Go through every section. Skip a section only if it clearly does not apply, and say so.

### A. Correctness
- Logic errors, off-by-one, wrong conditions, unhandled null/undefined, race conditions, double submits, non-idempotent operations that should be idempotent.
- Error paths: failed network/DB calls, partial failure, rollback or transaction needs.
- Loading, empty, and error states exist (§10). Offline behavior where relevant.
- Edge cases: empty input, max lengths, pagination boundaries, concurrent edits, deleted or hidden/blocked content.

### B. Security (§8, SECURITY_AND_PRIVACY)
- Authentication in route handlers; **authorization in services** with an explicit `actor`.
- No client-supplied user IDs, roles or ownership trusted. Private resources return 404 to non-owners.
- Public responses use explicit field selection (no leaking email, hashes, counts that are owner-only).
- All input validated with Zod from `src/lib/schemas`; file upload type/size checks.
- No `dangerouslySetInnerHTML` with user content, no raw SQL interpolation, no secrets in client code, logs, or committed files (check `.env*`, keys, tokens in the diff).
- Rate limits where the spec requires them. Blocked/hidden/moderated content respected in every new query.
- No security control disabled to make something pass.

### C. Architecture (§4)
- Layers respected: `app/` → `server/modules/*` → `server/db` / `server/integrations`. UI and route handlers never import Prisma.
- No cross-module imports of internals; modules expose `index.ts`.
- Mutations through `/api/*` handlers; no Server Actions.
- Errors are `AppError` subclasses with the standard error format.
- No new parallel patterns (state library, fetching approach, folder convention).
- New dependencies: purpose, alternatives, maintenance, bundle impact, license are stated (§6). Flag any unapproved addition.

### D. Code quality (§5)
- TypeScript strict: no `any`, no unexplained `@ts-ignore`/`as` casts hiding real type problems.
- Naming conventions; focused components; business logic out of components.
- No dead code, commented-out code, stray `console.log`, or TODOs without a task ID/OD reference.
- Comments explain why, not what. Duplicated logic that should reuse an existing helper. Unneeded abstraction.
- Performance: N+1 queries, missing indexes for new query patterns (only real ones), unbounded lists, large client bundles, unnecessary client components, missing `next/image` usage, avoidable re-renders.

### E. Database (§7)
- Migration exists and is additive/safe; applied migrations untouched.
- Explicit `onDelete` on every relation; indexes justified; seeds idempotent.
- DATABASE_SCHEMA.md updated.

### F. UI, accessibility, design (§5, §10, UI_UX_GUIDELINES)
- Built for mobile, tablet and desktop together; verified at 390 / 834 / 1280px with screenshots for PO review (§10). If screenshots are missing, say so.
- Tailwind with design tokens only: no raw hex, no inline theming styles, no new visual styles.
- Semantic elements, labels, focus states, keyboard support, alt text, contrast, touch targets.
- **No floating/looping animation on photos or tiles** (PO decision 2026-10-28).
- Copy matches USER_FLOWS and the design.

### G. Tests (TESTING_STRATEGY)
- New behavior has tests: services (authorization and failure paths, not only happy path), Zod schemas, route handlers; e2e for changed flows.
- Tests assert behavior, are deterministic, and do not depend on order or real time/network.
- Removed or weakened tests, `.skip`, `.only` are blockers unless explained.

### H. Docs in sync (§13) — mandatory
- README §2 row for every PO request or decision.
- Walk the §13 map: USER_FLOWS, PRODUCT_REQUIREMENTS, UI_UX_GUIDELINES, IMPLEMENTATION_ROADMAP "Built:" notes, API_SPECIFICATION, DATABASE_SCHEMA, SYSTEM_ARCHITECTURE/DEPLOYMENT/`.env.example`, SECURITY_AND_PRIVACY, TESTING_STRATEGY, THIRD_PARTY_NOTICES.
- `grep -ri` the docs for the feature's names (screen, component, route, copy) to find stale mentions.
- Missing doc updates are **Major** findings; the change is not done without them.

### I. Commit hygiene
- Diff contains only the intended task: no unrelated refactors, formatting churn, debug files, screenshots/artifacts, lockfile changes without a dependency change, or generated files that should not be committed.
- The change is one reviewable unit. If it mixes tasks, recommend how to split it for the product owner.
- Suggested commit message follows `type(scope): summary [TASK-ID]` (conventional commits).

## Step 4 — Classify findings

| Severity | Meaning | Commit? |
|---|---|---|
| **Blocker** | Failing gate, security hole, data loss, broken core flow, secret committed, violated non-negotiable | No |
| **Major** | Real bug on a plausible path, missing authz/validation/tests for new behavior, missing required docs, rule violation | No, fix first |
| **Minor** | Maintainability, small a11y or perf issue, naming, clarity | Can commit; fix soon |
| **Nit** | Optional polish | Ignore if busy |

Confidence: **Confirmed** (reproduced or provable from code) or **Likely** (plausible, needs a check). Do not inflate severity. Do not report the same root cause twice.

## Step 5 — Write the report

Use exactly this structure.

```
# Pre-commit review — <task ID / title>

**Verdict:** ✅ Ready to commit | ⚠️ Commit after fixing Majors | ⛔ Do not commit (Blockers)
**Scope:** <n files, modules touched, +/- lines>

## Gates
| Check | Result |
|---|---|
| lint | ✓/✗ — <detail> |
| typecheck | ✓/✗ |
| format:check | ✓/✗ |
| test | ✓/✗ — <passed/failed counts> |
| e2e | ✓/✗/not run — <why> |

## Summary
<3–5 lines: what the change does, overall quality, the biggest risks.>

## What is good
<Short, specific. Skip if nothing notable.>

## Findings
### F1 — <short title> — Blocker|Major|Minor|Nit — Confirmed|Likely
- **Where:** `path/to/file.ts:42`
- **Problem:** <what is wrong and the concrete failure scenario>
- **Rule:** <AI_DEVELOPMENT_RULES §x / spec reference, if any>
### F2 — ...

## Questions for the product owner
<Only decisions that are genuinely theirs, e.g. doc/code conflicts, scope splits.>

## Not verified
<What was not run or checked, and why.>

## Suggested commit message
<type(scope): summary [TASK-ID]>
```

## Step 6 — Write the AI fix list

After the report, append a section an implementing agent can follow literally. One entry per finding that needs a change, ordered Blockers → Majors → Minors. Nits only if cheap.

```
## Fix list for the implementing agent

Constraints: follow docs/AI_DEVELOPMENT_RULES.md; do not run git write commands; leave all changes uncommitted; update docs in the same change; re-run lint, typecheck, format:check and test when done and report results.

### FIX-1 (F1) — <imperative title>
- **File(s):** `path/to/file.ts` (function/component name, around line 42)
- **Change:** <exact change in imperative form: what to add/remove/rename and the intended behavior. Include the target signature, query shape, status code, or error class when relevant.>
- **Why:** <one line>
- **Acceptance:** <observable check, e.g. "non-owner GET returns 404", "new test `x.test.ts` covers blocked-user case fails before and passes after", "lint passes">
- **Tests:** <test file and cases to add or update>
- **Docs:** <file and section to update, or "none">
- **Depends on:** <FIX-n or none>
```

Fix-list rules:
- Each entry is self-contained: no "as discussed", no "fix similar issues". Name files, symbols, and expected behavior.
- State the minimal change that resolves the finding; do not ask for broader refactors.
- Do not include fixes for anything marked "Not verified" or for open product-owner questions; list those separately as blocked.
- End the fix list with a verification checklist: the gates to re-run and the §10 items still open.

## Step 7 — Hand-off

Finish with a message to the user: the verdict, counts by severity, the list of Blockers/Majors in one line each, and the offer to implement the fix list. Do not start fixing unless asked. Never stage or commit.
