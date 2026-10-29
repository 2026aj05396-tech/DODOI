# Deployment — hosted test environment (P1-35)

How the **test** site (`APP_ENV=test`, SYSTEM_ARCHITECTURE §13) is hosted and set up. Hosting decision OD-01 for test (PO, 2026-10-27): **Vercel Hobby + Neon Postgres**, both free. Production hosting is decided before launch: Vercel Hobby is for non-commercial use, so production likely needs Vercel Pro or another host.

## How it works

| Piece | Where | Notes |
|---|---|---|
| App | Vercel project, region `sin1` (Singapore) | `vercel.json`: only `main` deploys; build runs `pnpm build:vercel` = `prisma migrate deploy && next build` |
| Database | Neon project, region Singapore (AWS `ap-southeast-1`) | App uses the **pooled** URL (`DATABASE_URL`); migrations use the **direct** URL (`DIRECT_DATABASE_URL`) |
| Daily jobs | Vercel Cron → `GET /api/cron/daily` at 21:00 UTC (≈ 02:30 IST, ±59 min on Hobby) | Vercel sends `Authorization: Bearer <CRON_SECRET>`; anyone else gets 404 |
| Search engines | `APP_ENV=test` | `robots.txt` disallows all and every response has `X-Robots-Tag: noindex` |
| Skills seed | Run once by hand (below) | Not on every deploy: it would undo skill edits made in the test admin |

## One-time setup

Each environment has its own accounts and keys; nothing is shared with local or production (SYSTEM_ARCHITECTURE §13).

1. **Neon** (neon.tech): create a project `dodoi-test`, region **AWS Asia Pacific (Singapore)**, Postgres 16+. From *Connect*, copy two connection strings: **pooled** (host contains `-pooler`) → `DATABASE_URL`, and **direct** (pooling off) → `DIRECT_DATABASE_URL`. Both end with `?sslmode=require`.
2. **Google OAuth** (Google Cloud console → APIs & Services → Credentials): a new *Web application* client `dodoi test`. Authorized redirect URI: `https://<your-project>.vercel.app/api/auth/callback/google` (fill in after step 5 gives the address, then redeploy). → `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
3. **Cloudinary**: a separate product environment (or account) for test → `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Uploads go to `dodoi/test/…`.
4. **Email.** Until a sending domain is verified in Resend, Resend only delivers to the Resend account owner's address, and `*.vercel.app` can't be verified (you can't add DNS records to it). So the test site sends through **Gmail SMTP** instead (PO, 2026-10-28):
   - Create a Gmail account just for the test site (e.g. `dodoi.test@gmail.com`); an App Password can send mail as the whole account, so not your personal one.
   - On it, turn on 2-Step Verification, then Google Account → Security → **App passwords** → create one named `dodoi test`.
   - Set `SMTP_USER` (the Gmail address), `SMTP_PASSWORD` (the 16-character App Password) and `EMAIL_FROM="dodoi <that Gmail address>"`. When both SMTP values are set, SMTP is used and `RESEND_API_KEY` is ignored. Gmail allows about 500 emails a day.
   - Later, with a verified domain: remove `SMTP_USER` and `SMTP_PASSWORD`, set `RESEND_API_KEY` and `EMAIL_FROM` on that domain, and redeploy.
5. **Vercel** (vercel.com, sign in with GitHub): *Add New → Project*, import the dodoi repository. Framework: Next.js (detected); leave build and install commands as they are (`vercel.json` sets the build). Node.js version: **24.x** (Settings → Build and Deployment). Before the first deploy, add the environment variables below for the **Production** environment (on this project, Vercel's "Production" is our test site).
6. **Deploy, then seed the skills once.** The first deploy creates the tables (`prisma migrate deploy` in the build). Then, from your machine, load the predefined skills into the test database using its **direct** URL; your `.env.local` supplies the other values the script checks, and only the database changes:
   ```bash
   DATABASE_URL="<Neon direct URL>" pnpm db:seed
   ```
   Safe to repeat; it refuses only production.
   Then load the seed posts from `./seed-content` (the same posts as the local feed) the same way. Set `APP_ENV=test` too, so the photos upload to Cloudinary under `dodoi/test/` and not `dodoi/local/`; the test site must use the same Cloudinary account as `.env.local`:
   ```bash
   APP_ENV=test CRON_SECRET="$(openssl rand -hex 24)" DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" pnpm seed:content
   ```
   Paste the URL without angle brackets. `APP_ENV=test` makes the env check require `CRON_SECRET`; the importer never uses it, so any random value does. Safe to repeat: an unchanged file updates its post and is not uploaded again (PO request, 2026-10-28).
7. **Admin**: set `SEED_ADMIN_EMAIL` to your address; sign up on the test site and verify the email, and the account becomes admin.

## Environment variables (Vercel → Settings → Environment Variables → Production)

| Variable | Value |
|---|---|
| `APP_ENV` | `test` |
| `DATABASE_URL` | Neon **pooled** URL |
| `DIRECT_DATABASE_URL` | Neon **direct** URL |
| `AUTH_SECRET` | New random value: `npx auth secret` (never reuse local's) |
| `AUTH_URL` | `https://<your-project>.vercel.app` |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Test OAuth client |
| `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Test Gmail address, its App Password, `dodoi <that address>` |
| `RESEND_API_KEY` | Optional while SMTP is set; needed once a domain is verified |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Test Cloudinary |
| `CRON_SECRET` | New random value, 32+ characters: `openssl rand -base64 32` |
| `SEED_ADMIN_EMAIL` | Your email |
| `SUPPORT_EMAIL` | Optional |

Never set `AUTH_GOOGLE_ISSUER` or `CLOUDINARY_API_BASE` here: they are for automated local tests, and the app refuses to start with them outside `APP_ENV=local`.

## Checking a deploy

- Vercel → Deployments: the build log shows `prisma migrate deploy` applying (or "No pending migrations") before `next build`.
- `/robots.txt` says `Disallow: /`.
- Sign up with any address, verify from the email, onboard, open the feed, save a post, sign out.
- On a phone over HTTPS: the install banner after a save, and offline mode (visit the feed, turn on airplane mode, reopen).
- Vercel → Settings → Cron Jobs lists `/api/cron/daily`; "Run" triggers it, and the function log shows each job's count.
