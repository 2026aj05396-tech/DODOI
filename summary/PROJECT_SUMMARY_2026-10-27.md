# dodoi — Summary (26–27 Oct 2026)

Continues `PROJECT_SUMMARY_2026-10-26.md`. Details: README decision log, `docs/IMPLEMENTATION_ROADMAP.md`.

## Done
- **☑ (server):** P1-18 seed importer (`pnpm seed:content`), P1-21 feed, P1-24 saves/collections, P1-13/P1-12 profiles and avatars, P1-23 search/Explore.
- **◐ (built, awaiting PO screen review):** P1-17 admin, P1-20 post page, P1-20b tutorial progress, P1-22 feed, P1-25 Saved, P1-14 profile/settings, P1-26 Explore/search/skill/theme, P1-28b reporting.
- **Admin access:** admins skip onboarding (`/` → `/admin`).
- **New modules:** `library`, `search` and `reports` (they avoid import cycles).
- **Installed:** TanStack Query.
- **Last run:** 453 unit/integration tests and 148 E2E passing; lint, types and format clean.

## Verify (PO)
1. Review screenshots (390/834/1280) for all ◐ tasks.
2. Run `pnpm db:migrate`: two new migrations (feed impression page, username prompt).
3. Commit the pending work (suggested messages given per task); push; confirm CI green (P0-09).
4. Set `SUPPORT_EMAIL` in `.env.local`.
5. Before launch, verify a Resend domain you own (the email sender needs one).
6. Delete the "Importer live test" draft in `/admin`.

## Gotchas
- `registry.npmjs.org` DNS fails on the office network; install with public DNS or another network.
- Stop servers only by exact PID.

## On hold
- Admin skill create/rename/delete (needs rules).

## Next
1. P1-33 daily jobs + P1-28 account deletion. First question: how is the daily job triggered (OD-01)?
2. P1-30 landing metadata.
3. P1-27 PWA (needs icons + offline-matrix approval).
4. P1-31 accessibility/performance pass.
5. P1-35/P1-34 test environment and CI.
