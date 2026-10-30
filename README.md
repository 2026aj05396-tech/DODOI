# dodoi

> For the things you love making, and all the things you haven't tried yet.

**dodoi** is a visual-first creative discovery and community Progressive Web App for hobbyists, makers and beginners. Users discover art and craft inspiration, save ideas into collections, explore unfamiliar skills, and (in later phases) share their work, connect with other makers and get help from an AI creative companion.

**Product principle:** Curiosity over perfection. Discovery over comparison. Creativity without pressure.

**Status:** Pre-development. No code exists yet. This repository currently contains only the documentation set that defines what will be built.

---

## 1. Documentation Map

Read the documents in this order before writing any code.

| # | Document | Purpose |
|---|---|---|
| 1 | [README.md](README.md) | Overview, confirmed decisions, setup |
| 2 | [docs/AI_DEVELOPMENT_RULES.md](docs/AI_DEVELOPMENT_RULES.md) | **Mandatory** rules for every AI coding session |
| 3 | [docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md) | Finalized requirements, priorities, acceptance criteria |
| 4 | [docs/USER_FLOWS.md](docs/USER_FLOWS.md) | Step-by-step user journeys and edge cases |
| 5 | [docs/UI_UX_GUIDELINES.md](docs/UI_UX_GUIDELINES.md) | Design system, tokens, components, accessibility |
| 6 | [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) | Stack, module boundaries, folder structure, ADRs |
| 7 | [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Entities, relationships, indexes, lifecycle |
| 8 | [docs/API_SPECIFICATION.md](docs/API_SPECIFICATION.md) | Endpoint contracts, validation, permissions, errors |
| 9 | [docs/SECURITY_AND_PRIVACY.md](docs/SECURITY_AND_PRIVACY.md) | Auth, authorization, moderation, privacy |
| 10 | [docs/AI_INTEGRATION.md](docs/AI_INTEGRATION.md) | AI companion (Phase 4) design and safety |
| 11 | [docs/TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md) | Unit, integration, E2E, accessibility, AI evals |
| 12 | [docs/IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md) | Phased tasks, dependencies, acceptance criteria |
| 13 | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Hosted test site: accounts, variables, deploy and checks |

### Marker conventions used across all documents

| Marker | Meaning |
|---|---|
| **CONFIRMED** | Decided by the product owner. Implement as written. |
| **PROPOSED** | Suggested by documentation author, *not yet approved*. Must be confirmed before implementation depends on it. |
| **OPEN** | Undecided. Agents must not implement behavior that depends on it; ask the product owner. |

---

## 2. Confirmed Decisions (Decision Log)

| Area | Decision | Status |
|---|---|---|
| Product name | **dodoi** (design shows domain `dodoi.app`; domain registration not decided) | CONFIRMED |
| Product type | Responsive web app + PWA | CONFIRMED |
| MVP scope | **Phase 1 only** (Discovery Foundation) | CONFIRMED |
| Frontend | Next.js (App Router) + TypeScript (strict) | CONFIRMED |
| Backend | Modular monolith inside the same Next.js app: Route Handlers + server-side service layer | CONFIRMED |
| Database | PostgreSQL | CONFIRMED |
| ORM | Prisma | CONFIRMED |
| Authentication | Auth.js (NextAuth) — email/password + Google | CONFIRMED |
| Transactional email | Resend (free tier); Gmail SMTP on the test site until a sending domain is verified (2026-10-28) | CONFIRMED |
| Hosting | Local: PostgreSQL via Docker. Test site: Vercel Hobby + Neon Postgres (2026-10-27, [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)). Production host is OPEN. | CONFIRMED / OPEN |
| Cost constraint | No paid services at this stage; free tiers only | CONFIRMED |
| Media storage | Cloudinary (free tier) | CONFIRMED |
| Search | PostgreSQL full-text search (`simple` config) + `pg_trgm` trigram matching | CONFIRMED |
| Data conventions | cuid ids, snake_case tables/columns via `@map`, text limits per DATABASE_SCHEMA | CONFIRMED |
| GitHub plan | Free; no branch protection or secret scanning for now (OD-34) | CONFIRMED |
| Styling | Tailwind CSS + shadcn/ui | CONFIRMED |
| Typeface | DM Sans (Google Fonts, free), via `next/font` | CONFIRMED |
| Package manager | pnpm | CONFIRMED |
| Testing | Vitest (+ Testing Library) and Playwright (+ axe) | CONFIRMED |
| Real-time messaging (Phase 3) | Polling first; realtime service later if needed | CONFIRMED |
| AI provider (Phase 4) | — | OPEN |
| Minimum age | **18+**, checked by date of birth (discarded after the check) | CONFIRMED |
| Launch market | India first: English UI, INR, IST default, DPDP Act applies | CONFIRMED |
| Post types | First attempt · Tutorial · Work in progress · Journal · Finished · Tip | CONFIRMED |
| Onboarding | 3 steps: interests (min 3) → familiarity (optional) → skills you can help with (optional) | CONFIRMED |
| Tutorial progress | Materials checks + step progress saved per user, synced across devices | CONFIRMED |
| Layout | Sidebar everywhere on desktop (icon rail on detail pages with docked companion); tablet 768–1279 = icon rail + 2-col feed | CONFIRMED |
| Unverified email | Private features allowed; public actions need verification; unverified accounts deleted after 30 days | CONFIRMED |
| Google ↔ password accounts | Auto-link; password removed if existing account was unverified | CONFIRMED |
| Auth.js version and adapter | `next-auth@5.0.0-beta.32` pinned exactly (v5 is still beta; upgrades are deliberate); own minimal adapter instead of `@auth/prisma-adapter` (P1-04) | CONFIRMED |
| Google OAuth tokens | Not stored: dodoi does not call Google APIs, so only the account link (provider + Google id) is kept | PROPOSED (P1-04) |
| Sign-in for Google-only accounts | Password attempt shows "Looks like you signed up with Google … Continue with Google instead." (accepted enumeration risk, SECURITY §2.5) | CONFIRMED |
| Registration follow-up | New users are signed in right after registering; a taken email shows "This email is already registered." + "Sign in instead", or "Looks like you signed up with Google." + "Continue with Google" (accepted enumeration risk, SECURITY §2.5) | CONFIRMED |
| Display name for email sign-ups | Email local-part (e.g. `aanya.k`), editable in Edit profile | CONFIRMED |
| Under-18 and sign-up copy | "dodoi is for adults 18 and over, so we can't create an account for you." · "This email is already registered." · "Check your email — we've sent you a link." | CONFIRMED |
| Password reset details | Email sent after the response (timing-safe); reset link verifies an unverified email; password change keeps the current device signed in, 5 attempts / 15 min | PROPOSED (P1-06) |
| Welcome and Google button | `/` shows Welcome `1a` below 1024px and Landing `2a` from 1024px; designed three-button entry kept (no email-first); official Google "G" logo | CONFIRMED |
| Responsive delivery | Every screen is built for mobile, tablet and desktop in the same task (never mobile-only) | CONFIRMED |
| Admin content rules | Up to 10 media per post, images and videos mixed; any skill (predefined too) can be hidden; published posts editable if they still meet the publish rules; attribution rules incl. stock source link | CONFIRMED |
| Seed importer | File is the source of truth (re-run updates the post); per-file `publish` flag; skills by slug; seed content kept outside git (`pnpm seed:content <folder>`) | CONFIRMED (P1-18) |
| Post detail (P1-20) | Save "coming soon" until P1-25; signed-out visitors get a slim bar (Log in / Sign up) instead of the app shell; Share is an icon (Web Share API, copy-link fallback); several media: swipe + dots on mobile, arrows + thumbnails from 768px | CONFIRMED |
| Tutorial progress (P1-20b) | Signed-out visitors see the checklist and steps; tapping sends them to sign-in and back to the post; "Next step" sits in the steps header (hidden when all steps are done) | CONFIRMED |
| Feed ranking (P1-21) | SYSTEM_ARCHITECTURE §7 rules approved as proposed (+3 interest, +1 level fit, freshness +2/+1, +1 saves, −2 not interested, ≥20% discovery, ≤2 same skill in a row, 24h sessions); "recent" = 30 days; no level = Curious; suggestion card first on page 1 of For you only; up to 5 interest chips, newest first | CONFIRMED |
| Saves & collections (P1-24) | Adding a post to a collection saves it first; collections listed most recently changed first, posts most recently added first, cover = newest post | CONFIRMED |
| Feed screen (P1-22) | TanStack Query installed for client data; greeting "What will you make today/tonight, {first name}?" (5 pm India time; first word of the display name, dot/underscore/number tail dropped); search field, bell and avatar "coming soon" until search (P1-26) and profiles (P1-14) | CONFIRMED |
| Saved screens (P1-25) | `/saved`: collections on top, All saved below; collection pages at `/saved/{id}` (public ones open for other signed-in users); unsave Undo restores the save and its collections; profile Collections tab moves to P1-14 | CONFIRMED |
| Profiles (P1-13/P1-12) | Any signed-in user may upload their own avatar (purpose `avatar` only; posts/covers stay admin-only); usernames and display names are checked against the offensive-word list (bios left to reports); unverified users may edit their whole profile; profiles hidden after a report or deactivated are not found for others | CONFIRMED |
| Landing craft photos | Landing and welcome tiles show real craft photos (`public/images/crafts/`, Unsplash License, see THIRD_PARTY_NOTICES) faded in over the craft patterns; the pattern stays as placeholder and as fallback when a photo can't load (PO request, 2026-10-28) | CONFIRMED |
| Craft-tile motion | Landing, welcome and auth craft tiles are **still**: the design's floating loop (`ddFloat`) is removed and not used anywhere. No looping float/drift animation on photos or image tiles (PO, 2026-10-28) | CONFIRMED |
| Empty home feed | Mood-board art above the message (three craft photos with washi tape, a coral thread that draws in, sparkles; prints fan out on hover) and an "Explore crafts" button to `/explore` (PO request, 2026-10-28) | CONFIRMED |
| Log out | Per design v3 (updated 2026-10-28): desktop sidebar "Log out" in danger red under the Ask dodoi card; own profile below 1280px ends with a "Settings and privacy" + "Log out" card (`1i`); both open the "Log out of dodoi?" confirmation (sheet on mobile, centred from 768px). Tablet icon rail has no Log out (`3c`). Icon points outward (the design draws the log-in glyph) — **PO to confirm** | CONFIRMED |
| Seed content minimums (OD-31) | Tiered: every active predefined skill ≥ 2 published posts; 15 launch-focus skills (Drawing, Sketching, Doodling, Watercolor, Acrylic painting, Calligraphy, Crochet, Amigurumi, Knitting, Embroidery, Punch needle, Pottery, Polymer clay, Origami, Journaling) ≥ 6 incl. ≥ 2 tutorials; every post type ≥ 5; every published theme ≥ 6. A post counts toward every skill it is tagged with; hidden and custom skills excluded. Values in `src/lib/constants/seed-coverage.ts` (PO decision, 2026-10-28) | CONFIRMED |
| Profile screens (P1-14) | Tabs Projects · Collections · Posts with Projects/Posts coming soon; "Pick your username" dismissal remembered on the account; one "Your skills" screen linked from Edit profile and Settings; the profile shows only public collections, also to its owner | CONFIRMED |
| Search & Explore (P1-23) | Popular skills = most saves in 30 days, topped up by most published posts (never empty); Explore shows 8 popular, 8 new, 8 skills to try (with hint, outside your interests, related first), all themes with idea counts, 12 newest beginner-friendly posts | CONFIRMED |
| Explore & skill pages (P1-26) | Explore adds Popular, New on dodoi and Beginner-friendly below the designed sections; "See all" opens an All skills page; skill pages have "Add to my interests" (removing keeps ≥ 3 interests) | CONFIRMED |
| Reporting (P1-28b) | Admin sees one row per reported target; Hide/Dismiss resolve all its open reports; hidden targets can be shown again from Resolved; owners of hidden profiles see a neutral notice with `SUPPORT_EMAIL` (optional env; "the dodoi team" until set) | CONFIRMED |
| Admin skill create/rename/delete | Requested by PO (2026-10-26), **on hold**: needs delete rule for skills in use, editable fields (name/slug/accent) and type of new skills. Today admin can edit editorial fields, hide/show and set related skills | OPEN |
| Admin onboarding | Admins skip onboarding: `/` and `/onboarding` redirect them to `/admin` (age check still applies) | CONFIRMED |
| Post lists | Related posts: 12, most shared skills → same primary → newest; skill pages newest first; hidden/deactivated creators: post stays, creator row not shown | CONFIRMED |
| Media integration | Cloudinary REST APIs called directly (no `cloudinary` SDK, like Resend); uploads in `dodoi/<APP_ENV>/…`; deletes limited to `dodoi/` | PROPOSED (P1-03) |
| Google sign-in tests | Dev-only `oauth2-mock-server` 9.3.0 as a local stand-in for Google in E2E | CONFIRMED |
| Onboarding data | Up to 50 skills per user; resume step stored per user; skipped familiarity stores no level | CONFIRMED |
| Age check date | Age computed on today's date in India (IST) | PROPOSED (P1-05) |
| Reserved usernames and fallback | Full list in `src/server/modules/users/username.ts` (OD-11 names + every top-level route); usernames fall back to `maker-NNNN` when neither name nor email gives 3 usable characters; the same list applies to username changes | CONFIRMED (2026-10-27) |
| Rate-limit store | PostgreSQL table | CONFIRMED |
| Media limits | Images JPEG/PNG/WebP/HEIC ≤ 10 MB, ≤ 10/post, **no minimum size** (the ≥ 600 px rule was dropped 2026-10-29: small photos get a soft note); video MP4/MOV/WebM ≤ 60 s, ≤ 50 MB, no feed autoplay | CONFIRMED |
| Photo editor (PO request 2026-10-29) | Makers are not turned away for photo size: in Create post every photo has **Edit photo** (crop to Original / Square / 4:5 / 3:4 / 16:9, zoom, drag, rotate), applied as a new upload in the same place with its description; photos over 10 MB are shrunk in the browser to 2,400 px. Built without a new library (canvas) | CONFIRMED (screens: PO review) |
| Collections | ≤ 100 per user, ≤ 1,000 items, unique names | CONFIRMED |
| Reporting in P1 | Custom skills and profiles | CONFIRMED |
| Account deletion | Deactivate now, hard delete after 14 days | CONFIRMED |
| Account deletion details | Password accounts confirm with their password; Google-only accounts sign in with Google again (fresh login) and confirm within 5 minutes. Signing in during the grace period shows only a blocking "scheduled for deletion" screen (Cancel deletion / Sign out). Invited creators' posts are deleted with their media. Admin accounts can't be deleted from settings | CONFIRMED (2026-10-27) |
| Code hosting / CI | GitHub + GitHub Actions | CONFIRMED |
| Usernames | Auto-generated at sign-up, editable; 3–20 chars `[a-z][a-z0-9_-]`, reserved names blocked, one change per 30 days | CONFIRMED |
| Seeded post creators | Invited creators = real accounts; team/stock/Creative Commons (CC BY, BY-SA only) = "via dodoi editors" + attribution | CONFIRMED |
| Icons | Lucide (`lucide-react`) | CONFIRMED |
| Content Security Policy | Static policy without nonces, keeps pages statically rendered (OD-35) | CONFIRMED |
| Signed-out access | Landing page + published post detail (read-only); everything else requires sign-in (OD-29) | CONFIRMED |
| Auth settings | JWT sessions (30 days rolling), Argon2id, passwords ≥ 10 chars, tokens 24h/1h, rate limits per SECURITY §6, `/admin` → 404 for non-admins | CONFIRMED |
| Google profile data | Name pre-fills display name; photo not imported; users upload their own avatar | CONFIRMED |
| Retention | Feed sessions 7 days after expiry; orphaned uploads 24h | CONFIRMED |
| Custom-interest blocklist | LDNOOBW English + Hinglish (CC BY 4.0) minus reviewed craft-safe exceptions | CONFIRMED |
| Coming-soon nav items | Muted + butter "Soon" pill, tooltip only | CONFIRMED |
| Undesigned Phase 1 screens | Built from the design system (tokens + components); product owner reviews | CONFIRMED |
| Profile default visibility | Public | CONFIRMED |
| Reactions (Phase 2) | Single like/heart | CONFIRMED |
| Like counts | Hidden publicly; visible only to post owner | CONFIRMED |
| Collection default visibility | Private | CONFIRMED |
| Deleting a collection | Items stay saved (removed from that collection only) | CONFIRMED |
| Seed content sources | Mix: team originals + invited creators (core); licensed free stock (filler). Every item stores source, license and attribution. | CONFIRMED |
| Seeding method | Seed script (bulk JSON import) **and** minimal admin UI (create/edit) | CONFIRMED |
| Phase 1 media types | Images + short video | CONFIRMED (limits OPEN) |
| Unbuilt features in UI | Shown as disabled "coming soon" (Create, Community, Messages, Journal, notifications, Ask dodoi, etc.) | CONFIRMED |
| Feed extras in Phase 1 | Filter chips (For you / per-interest / New to you) + "New to you" skill suggestion card | CONFIRMED |
| Theme | Light only in MVP; tokens structured for future dark mode | CONFIRMED |
| Visual design source | Claude Design `dodoi App v3.dc.html`, local copy in `docs/design/`; tokens extracted into UI_UX_GUIDELINES §2. DC-01–05 resolved; remaining conflicts OPEN (UI_UX_GUIDELINES §10) | CONFIRMED |
| Custom interests | Immediately public, normalized to prevent duplicates, reportable | CONFIRMED |
| Experience levels | Curious / Beginner / Intermediate / Experienced | CONFIRMED |
| Phase 2 start | Draft the Phase 2 spec (P2-00) now, in parallel with Phase 1 sign-off; no Phase 2 code until the PO approves it (2026-10-28) | CONFIRMED |
| Comment threading (OD-25) | One level of replies: comments + replies to a comment; replies to a reply attach to the same comment (2026-10-28) | CONFIRMED |
| User upload licence (OD-05) | Makers keep ownership; publishing grants dodoi a non-exclusive licence to show the post on dodoi only, ending on deletion; "my own work" confirmation; takedown via Report "Not my work" + support email. Legal wording pending (2026-10-28) | CONFIRMED (wording: PO to confirm with legal) |
| First Phase 2 slice | Create post: P2-01 user uploads → P2-02 create/preview/edit/delete (2026-10-28) | CONFIRMED |
| Phase 2 spec details | PRODUCT_REQUIREMENTS §6.1 and the §9.1 / §1b sections it links, including the 7 highlighted proposals (verified email for public actions, required alt text, no unpublish, owner-only follower counts, in-app notifications every 60 s, MODERATOR role, Create post built from the system) — approved 2026-10-28 | CONFIRMED |
| "Post" vs "Share link" (2026-10-29) | Publishing is **Post** (Create's last button, the journal's project button); **Share link** only sends a link (system share sheet, or Copy link / WhatsApp / Email on desktop), on the post page and the "Posted!" card. The maker's own post shows "Live · showing in feeds" | CONFIRMED |
| Creative journal (P2-03) | Built 2026-10-29: `/journal` (sidebar; phones reach it from the profile's Projects tab), project pages `/projects/{id}` per design `1g`, "Start as my project" on tutorials, Share → draft post | CONFIRMED (screens: PO review) |
| Comments (P2-04) | Built 2026-10-29: Comments section on the post page (below related posts under 1024px, below the steps from 1024px), reading needs sign-in (OD-29) and writing a verified email (OD-08); count shown publicly in the heading. Choices made while building, **PO to confirm:** a deleted comment can't get new replies; signed-out visitors see the count and "Sign in to read and join the comments"; a comment whose writer's profile is hidden or deactivated shows as "A dodoi member"; Report and Block in the ⋯ menu arrive with P2-08 | CONFIRMED (copy: PO review) |
| Likes (P2-05) | Built 2026-10-29: heart on the post page (next to Save on tablet/desktop; left of the two buttons in the phone bar), optimistic, one like per user; the post's author sees "{n} likes" on their own post only. Choices made while building, **PO to confirm:** only the post page has the heart for now (cards have no menu to hold it, so the spec's "card menu" waits); a maker can like their own post; the like notification to the author comes with P2-07 | CONFIRMED (placement: PO review) |
| Follows (P2-06) | Built 2026-10-29: Follow / Following on the creator row (post page) and on public profiles; the owner's profile shows "{n} followers · {n} following" linking to `/profile/followers` and `/profile/following` (owner only); feed gets a **Following** chip (once you follow someone) and a ranking boost for followed makers. Choices made while building, **PO to confirm:** the boost is **+4** per post by a followed maker (docs said only "a boost"; for scale, one matching interest is +3); the Following chip sits right after For you; the Following list has an unfollow button, the Followers list is read-only; no "follow back" button; unfollowing still works after a maker turns their profile private; follow notifications come with P2-07 | CONFIRMED (boost size, copy: PO review) |
| Notifications (P2-07) | Built 2026-10-29: the bell is a live link with a coral dot (checked on page open and every 60 s while the tab is visible), `/notifications` lists newest first (likes grouped per post per day) and marks everything read once opened, `[Settings] → Notifications` has four switches (comments, replies, new followers, likes; all on), kept 90 days. Choices made while building, **PO to confirm:** the bell exists only where the design has one — the phone header and the feed header from 768px — so tablet/desktop pages other than the feed have no bell (reach the list from the feed or by link); a reply to a comment sends the commenter a REPLY and the post's author a COMMENT unless they are the same person; taking back a like or follow removes its notification; likes group only within a loaded page of 50 notifications; "Someone" stands in for a person whose profile is hidden or gone; no notification for your own actions or for posts no longer published; blocked users (P2-08) will be skipped when blocking is built | CONFIRMED (copy and bell placement: PO review) |
| Safety (P2-08) | Built 2026-10-29 as documented (MOD-01…05): report posts and comments from ⋯ menus (reasons now include **Not my work**); **block** from a profile, a post's or a comment's menu (both ways: profile, posts, comments, feed, search and notifications disappear; follows removed; no follow/like/comment between them; nobody is told) with **Settings → Blocked accounts**; **MODERATOR** role works `/admin/reports` only (hide / dismiss / show again for skills, profiles, posts and comments); a hidden post or comment shows only to its author ("Hidden after a report") and moderators; every action audited. Choices made while building, **PO to confirm:** a hidden own post is listed with the maker's drafts (labelled "Hidden after a report") so they can find and delete it; admins assign Moderator through `PATCH /api/admin/users/{id}/role` only (**no screen for it yet**); moderators have no link in the app (they open `/admin/reports`); the Report reason is labelled "Not my work" as in the spec; blocking a hidden/deactivated profile is allowed and they stay in the block list; unblocking does not restore follows or notifications; **MOD-06 (report by email for people without an account) is not built** — it needs the terms and support address (OD-26); automatic content/image moderation is **OD-37 (open)** | CONFIRMED (copy, bell/nav placement: PO review) |
| AI companion (P4-00 spec, drafted 2026-10-29) | PO decisions: **Google Gemini** (OD-02); the Gemini **free tier is for local and test** (PO, 2026-10-29: no paid model yet) because Google may use and human-review content sent through it — testers are told (notice in the companion screens while `AI_TIER=free`), and the app refuses `AI_TIER=free` when `APP_ENV=production`, where a paid tier with no-training terms is required; the PO's Google AI Pro subscription gives no API access, so the API key and billing are separate; **everything in the first release including photos**; photos checked by the provider's safety filters + explicit consent + reports; chat history kept **30 days, deletable anytime** (other platforms vary, no standard); **no private collections** as context. First real calls 2026-10-29 (AI_INTEGRATION §14): the key works; local model `gemini-3.5-flash-lite` (Gemini 3.x needed, `gemini-2.5-flash` is closed to new users); free-tier replies take 3–30 s. Also approved with the spec: 30 messages a day / 5 photos a day / 10 a minute / 800-token replies / last 10 messages; one response at a time (no streaming); AI answers reportable; plans start a private journal project | CONFIRMED (PO approved P4-00 on 2026-10-29) |
| AI companion screens (P4-02, 2026-10-30) | PO request: chat screens including the free-tier notice. Built as in USER_FLOWS F-23 and UI_UX §8.2. Choices made while building, **PO to confirm:** (1) a reported AI answer can only be **Dismissed** by moderators (nothing to hide), (2) the skill page question is put in the field, not sent automatically, (3) ~~the sidebar card copy "Ask me about it."~~ — design copy "Show me a photo." restored in P4-04, (4) no "uncertainty line" (the model gives no marker), (5) ~~the interests sheet had no Settings switch~~ — Settings → AI and privacy exists since P4-07 and the sheet points to it, (6) docked chat is remembered per page for the browser tab only | CONFIRMED (screens: PO review) |
| AI project plans (P4-03, 2026-10-30) | Built as in AI_INTEGRATION §11 and USER_FLOWS F-25. Choices made while building, **PO to confirm:** (1) the plan is shown in the chat view only and not saved with the conversation, (2) the steps are not copied into the project (the journal has no steps list), only title, craft and the materials checklist, (3) "Plan a project" is a chip and sheet only; typing the words is an ordinary question, (4) the response also carries `skillId` so the project gets its craft, (5) the craft picker lists dodoi's own skills | CONFIRMED (screens: PO review) |
| AI photos (P4-04, 2026-10-30) | Built as in F-24. Choices made while building, **PO to confirm:** (1) the question text is still required with a photo (the API needs 1–1,000 characters), (2) the sidebar card is back to the design copy "Stuck on a stitch? Show me a photo." now that photos exist, (3) photos over 10 MB are shrunk in the browser instead of refused | CONFIRMED (screens: PO review) |
| AI and privacy settings (P4-07, 2026-10-30) | Built as in F-26 / AIC-08 at `/settings/ai`. Choices made while building, **PO to confirm:** (1) the page is its own settings entry "AI and privacy" (not part of the existing Privacy page, which is about profile visibility), (2) deleting asks first, in a sheet, for one chat and for all, (3) the chat list here shows the same 30-day chats as `/companion`. Resolves the earlier gap that withdrawing a consent had no screen (P4-02 open point 5) | CONFIRMED (screens: PO review) |
| AI admin: usage and kill switch (P4-05, 2026-10-30) | Built as in AIC-10 at `/admin/ai` (admins only). Choices made while building, **PO to confirm:** (1) the switch is stored in a new small `app_setting` table (the spec said "stored in the database" without naming a table), (2) "requests" excludes quota refusals, (3) a `dailyCap` field was added to the usage response so the page can show today's cap, (4) tablet/desktop/phone use one layout of tiles and a per-day table (no chart), (5) no alert or email when the cap is reached | CONFIRMED (screens: PO review) |
| Journal entry title | Entries get an optional title, as design `1g` shows (the approved spec had text + photos only) | PROPOSED — PO to confirm |
| Newest-entry dot | Shown still, not pulsing as in `1g`, following the no-looping-motion decision of 2026-10-28 | PROPOSED — PO to confirm |
| Create post experience | PO request (2026-10-28): the Create post flow must be really interactive, attractive and easy; richer motion allowed within the tokens — **Instagram flow chosen (2026-10-28):** picker opens at once → Pick → Arrange → Details (caption-style rows) → Share, uploads start on pick, Preview optional, one publish celebration, reduced-motion respected — UI_UX_GUIDELINES §8.1, USER_FLOWS F-17 | CONFIRMED (screens: PO review) |
| Pre-commit review skill | PO request (2026-10-29): a project skill `/pre-commit-review` ([.claude/skills/pre-commit-review/SKILL.md](.claude/skills/pre-commit-review/SKILL.md)) reviews all uncommitted changes against AI_DEVELOPMENT_RULES (gates, security, architecture, tests, docs sync, responsive/a11y, commit hygiene) and outputs a severity-ranked report plus a self-contained fix list an AI agent can implement. Read-only; never writes to git | DRAFT — PO to confirm |

The full list of open decisions lives in [docs/PRODUCT_REQUIREMENTS.md §9](docs/PRODUCT_REQUIREMENTS.md#9-open-decisions-register).

---

## 3. Prerequisites (Local Development)

| Tool | Version | Notes |
|---|---|---|
| Node.js | 24 (LTS) | Pinned in `.nvmrc` and `package.json` `engines` |
| pnpm | Latest stable | `corepack enable` then `corepack prepare pnpm@latest --activate` |
| Docker + Docker Compose | Current stable | Runs local PostgreSQL |
| Git | Any recent | Version control; remote on GitHub |

Free accounts required:

| Service | Used for | Needed from |
|---|---|---|
| Google Cloud Console | OAuth client for Google sign-in | Phase 1 |
| Cloudinary | Image/video storage, transforms, CDN | Phase 1 |
| Resend | Verification and password-reset emails | Phase 1 |
| Gmail account with an App Password | Same emails from the test site, until a Resend domain is verified | Test site (P1-35) |

---

## 4. Setup (to be valid once the project is scaffolded)

> These steps describe the **target** setup. Task P0-01 in the roadmap creates the scaffold that makes them work. Update this section if the scaffold differs.

```bash
# 1. Install dependencies
pnpm install

# 2. Create local environment file
cp .env.example .env.local
#    then fill in values (see §5)

# 3. Start PostgreSQL (host port 5433; creates databases dodoi and dodoi_test)
docker compose up -d db

# 4. Apply database migrations (also enables pg_trgm extension)
pnpm db:migrate

# 5. Load reference data (skills/categories) and seed content
pnpm db:seed

# 6. Start the dev server
pnpm dev
#    → http://localhost:3000
```

### Planned scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm format` / `pnpm format:check` | Prettier write / check (Markdown excluded) |
| `pnpm test` | Vitest unit + integration tests |
| `pnpm test:e2e` | Playwright end-to-end + accessibility tests |
| `pnpm db:migrate` | `prisma migrate dev` + `prisma generate` (Prisma 7 no longer regenerates the client after migrating) |
| `pnpm db:seed` | Load predefined skills (idempotent); refuses production without `--confirm-production` |
| `pnpm seed:content [folder]` | Import seed posts from `<folder>/posts/*.json` (default `./seed-content`, outside git); `--check` validates only; both end with a coverage report against the OD-31 minimums (skills and post types; themes on `/admin/coverage`); refuses production without `--confirm-production`. Template and field guide: [docs/seed-content/](docs/seed-content/README.md) |
| `pnpm jobs:daily` | Daily maintenance (P1-33): delete accounts that are due, purge spent auth tokens, old feed sessions, expired rate-limit buckets and orphaned media. Idempotent; exits 1 if a job failed |
| `pnpm db:studio` | Prisma Studio |
| `pnpm db:reset` | Drop, re-migrate, re-seed (local only) |

---

## 5. Environment Variables

Each environment (local, test, production) has its **own values for every variable** — separate database, OAuth client, Cloudinary and email (Resend or SMTP) credentials. Hosted environments set them in the host's secret settings, never in files.

`.env.example` must list every variable with a placeholder and comment. Never commit real values.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (on Neon: the pooled URL) |
| `DIRECT_DATABASE_URL` | No — hosted only | Direct (unpooled) URL used by `prisma migrate deploy`; falls back to `DATABASE_URL` |
| `AUTH_SECRET` | Yes | Auth.js secret (`npx auth secret`) |
| `AUTH_URL` | Yes | Base URL, e.g. `http://localhost:3000`; Google redirect URI is `<AUTH_URL>/api/auth/callback/google` |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth client secret |
| `RESEND_API_KEY` | Yes, unless SMTP is set (may be empty with `APP_ENV=local`, for automated tests: emails are then skipped) | Resend API key |
| `SMTP_USER`, `SMTP_PASSWORD` | No — set together | SMTP login (e.g. a Gmail address and its App Password); when set, email goes through SMTP instead of Resend |
| `SMTP_HOST` | No | SMTP server, default `smtp.gmail.com` (port 465, TLS) |
| `EMAIL_FROM` | Yes | Sender address: on a domain verified in Resend, or the SMTP account's own address |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key (server only) |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret (server only) |
| `APP_ENV` | Yes | `local`, `test` or `production` (SYSTEM_ARCHITECTURE §13) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public base URL used in client code |
| `CLOUDINARY_API_BASE` | No — automated tests only | Points the Cloudinary Admin API at the local mock in E2E runs; refused unless `APP_ENV=local` |
| `AUTH_GOOGLE_ISSUER` | No — automated tests only | Points Google sign-in at the local mock provider in E2E runs; refused unless `APP_ENV=local` |
| `SEED_ADMIN_EMAIL` | No | Email of the account promoted to ADMIN after it signs in with a verified email (P1-04) |
| `CRON_SECRET` | Outside local | 32+ random characters; Vercel Cron sends it to `/api/cron/daily` (P1-35) |
| `SUPPORT_EMAIL` | No | Support address shown to owners of profiles hidden after a report (P1-28b); set before launch |

Rule: only variables prefixed `NEXT_PUBLIC_` may be read in client code, and none of them may contain secrets.

---

## 6. Planned Repository Structure

See [docs/SYSTEM_ARCHITECTURE.md §5](docs/SYSTEM_ARCHITECTURE.md#5-folder-structure) for the full structure.

```
/
├── README.md
├── docs/                  # This documentation set
│   └── design/            # Exported Claude Design files (visual source of truth)
├── prisma/                # schema.prisma, migrations, seed
├── seed-content/          # Seed JSON + local media for import (git-ignored)
├── public/                # Static assets, PWA icons
├── src/
│   ├── app/               # Next.js routes (UI + /api route handlers)
│   ├── components/        # UI components (ui/ = shadcn primitives)
│   ├── server/            # Modular monolith: modules, db, auth, lib
│   ├── lib/               # Shared client/server utilities, schemas
│   └── styles/            # Tailwind + design tokens
├── tests/                 # Integration + E2E tests
└── docker-compose.yml
```

---

## 7. Product Phases at a Glance

| Phase | Name | Status |
|---|---|---|
| 0 | Setup and definition | **Current** |
| 1 | Discovery Foundation | **MVP** |
| 2 | Creative Expression | Post-MVP |
| 3 | Community and Peer Learning | Post-MVP |
| 4 | AI Creative Companion | Post-MVP (P4-00 spec approved 2026-10-29; P4-01 in progress) |
| 5 | Refinement and Growth | Post-MVP |

Details: [docs/IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md).
