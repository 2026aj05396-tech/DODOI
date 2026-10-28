# Product Requirements

**Version:** 1.0 · **Product:** dodoi · **Source:** Creative Community PWA — Master Product Documentation v1.0 Draft, plus product-owner decisions recorded in [README §2](../README.md#2-confirmed-decisions-decision-log).

Markers: **CONFIRMED** / **PROPOSED** / **OPEN** (see README).

---

## 1. Product Summary

A visual-first creative discovery and community platform for people who make things for joy, relaxation, curiosity or growth — not only professionals. Four pillars:

1. **Discover** — inspiring visual content, techniques, new hobbies. *(Primary entry point and retention driver.)*
2. **Create** — share projects, document progress, creative journal.
3. **Connect** — meet hobbyists, exchange knowledge, request help.
4. **Learn** — AI and community knowledge to try unfamiliar skills.

Core journey: Discover → Save → Learn how → Create → Share → Inspire someone else.

## 2. Product Principles (binding for every decision)

| ID | Principle | Practical implication |
|---|---|---|
| PP-1 | Creativity without pressure | No skill gates, no public ratings, beginner work is first-class |
| PP-2 | Discovery before specialization | Users hold many interests; feed mixes familiar + unexpected |
| PP-3 | Progress over perfection | WIP, experiments and first attempts are legitimate content |
| PP-4 | Community over competition | No leaderboards; like counts hidden publicly (CONFIRMED) |
| PP-5 | AI as an enabler | AI supports learning; never replaces human interaction |
| PP-6 | Visual quality is a feature | Design, imagery, typography are core scope, not polish |
| PP-7 | Safety and trust by design | Privacy, reporting, blocking, moderation from the start |

## 3. Target Audience

Personas (a single user can be several at once, per skill):

| Persona | Core need |
|---|---|
| A. Curious Beginner | Beginner-friendly ideas, simple explanations, encouragement |
| B. Hobby Explorer | Variety, outside-interest recommendations, easy saving |
| C. Social Hobbyist | Supportive communities, feedback, messaging, group sessions |
| D. Experienced Hobbyist | Share process, help others, discover new techniques |

**Rule:** experience is tracked **per skill**, using the CONFIRMED scale: `Curious` (never tried) / `Beginner` / `Intermediate` / `Experienced`.

**Eligibility:** users must be **18 or older** (CONFIRMED — raised from 13+ to avoid India DPDP Act children's-data requirements, OD-28). Age-verification method is OPEN (OD-07).

**Launch market (CONFIRMED): India first.** English UI; currency INR (₹) where prices appear; default time zone IST (Asia/Kolkata) when the user's zone is unknown — timestamps stored in UTC and shown in the user's zone (browser zone preferred, PROPOSED); India's Digital Personal Data Protection Act, 2023 (DPDP) and its Rules apply.

## 4. Release Scope and Priorities

| Priority | Meaning |
|---|---|
| **P1** | Phase 1 — MVP (CONFIRMED scope) |
| **P2** | Phase 2 — Creative Expression |
| **P3** | Phase 3 — Community and Peer Learning |
| **P4** | Phase 4 — AI Creative Companion |
| **P5** | Phase 5 — Refinement and Growth |

| Module | Priority |
|---|---|
| Authentication and account management | P1 |
| Onboarding and creative interests | P1 |
| Home discovery feed | P1 |
| Search and explore | P1 |
| Content detail and tutorials | P1 |
| Saving and collections | P1 |
| User profiles (view/edit, interests, skills) | P1 |
| Seed content pipeline + minimal admin content UI | P1 |
| PWA foundation (installable, offline fallback) | P1 |
| Following | P2 |
| User content creation, uploads, creative journal | P2 |
| Comments and reactions (single like) | P2 |
| Basic in-app notifications | P2 |
| Reporting and blocking | P2 (see note) |
| Communities | P3 |
| Direct messaging (polling) | P3 |
| Peer help and skill exchange | P3 |
| Scheduled creative sessions | P3 |
| AI creative companion | P4 |
| Push notifications, recommendation improvements, offline improvements | P5 |

> **Note on reporting in P1:** Phase 1 has no user-generated posts, but custom interests (CONFIRMED immediately public) and public profiles are user-generated. Requirement **AUTH/PRF/INT reporting** for those two surfaces is therefore listed in P1 below as a minimal report action. This minimal P1 reporting is **CONFIRMED (OD-12)** — see §5.11.

---

## 5. Phase 1 (MVP) Functional Requirements

Each requirement has an ID used by the roadmap, API spec and tests.

### 5.1 Authentication and Account Management (AUTH)

| ID | Requirement |
|---|---|
| AUTH-01 | Register with email + password |
| AUTH-02 | Sign in with email + password |
| AUTH-03 | Sign in / register with Google |
| AUTH-04 | Email verification for email/password accounts |
| AUTH-05 | Password recovery via emailed single-use, time-limited link |
| AUTH-06 | Sign out (current session) |
| AUTH-07 | View and edit basic account details (email display, password change) |
| AUTH-08 | Request account deletion |
| AUTH-09 | Protected routes and APIs require an authenticated session |
| AUTH-10 | Clear, non-technical error messages for all auth failures |
| AUTH-11 | Age check (18+) at registration and once after first Google sign-in: user enters **date of birth**; server computes age, blocks under-18, stores only `ageConfirmedAt` and **discards the date of birth** (CONFIRMED, OD-07) |

**Acceptance criteria**
- A new user can create an account and reach onboarding.
- A returning user signs in and sees their profile, interests and saved content.
- Google sign-in handles success, user cancellation and provider failure with distinct, understandable outcomes.
- Password recovery responds identically whether or not the email exists.
- Expired sessions redirect to sign-in and return the user to their original page after re-authentication.
- Changing a URL or request identifier never exposes another user's private data.
- **Unverified users (CONFIRMED, OD-08):** can use all *private* features (browse, onboarding, saves, private collections, tutorial progress). *Public* actions need a verified email: creating custom interests, making a collection public (P2: posting). A banner "Verify your email to share with the community" offers resend. Accounts still unverified after **30 days** are deleted.
- **Google sign-in with an existing email (CONFIRMED, OD-09):** link automatically. If the existing account was verified → link, keep both sign-in methods. If it was never verified → link, mark email verified, **remove the password** and invalidate other sessions.

### 5.2 Onboarding and Interests (ONB)

| ID | Requirement |
|---|---|
| ONB-01 | Welcome screen with sign-up / log-in entry (design `1a`), shown before authentication |
| ONB-02 | Select multiple interests from predefined skills |
| ONB-03 | Search the skill list |
| ONB-04 | Add a custom interest when none fits |
| ONB-05 | Step 2 (optional): set familiarity / experience level per selected interest |
| ONB-06 | Step 3 (optional): choose skills you can help with (sets `canHelp`) |
| ONB-07 | Land on a personalized feed when finished |
| ONB-08 | Edit interests and levels later from profile/settings |

**Custom interests (CONFIRMED rules)**
- Immediately public: usable and searchable by all users once created.
- Normalized before storage (trim, collapse whitespace, case-insensitive comparison) so duplicates of existing skills are reused instead of re-created.
- Reportable (§5.11).
- **Limits (CONFIRMED, OD-13):** 2–40 characters after trimming/collapsing whitespace; Unicode letters (any script, incl. Indian scripts), digits, spaces, `-`, `'`, `&`; checked against a free offensive-word blocklist (English + Hindi/Hinglish); max 10 per user per day; requires verified email; admins can hide.

**Onboarding steps (CONFIRMED, design DC-18):** 1 Interests (required) → 2 Familiarity (optional) → 3 Skills you can help with (optional). Progress indicator "Step n of 3".

**Minimum interests (CONFIRMED):** **3**. The continue button stays disabled and reads "Pick {n} more to continue" until 3 are selected. No "Skip" on step 1; steps 2 and 3 can be skipped (DC-28).

**Profile basics** are not an onboarding step. **Username is auto-generated at sign-up** (from display name or email local-part, slugified, plus 4 random digits if taken, e.g. `aanya-4821`), editable later in Edit profile; a dismissible "Pick your username" prompt appears on the user's first visit to their own profile (CONFIRMED, DC-26).

**Acceptance criteria**
- Multiple interests can be selected; duplicates are prevented.
- A custom interest typed as an existing skill (e.g. "  Crochet ") resolves to the existing skill.
- Interest changes affect the next feed load.
- Onboarding preferences can be revisited without re-creating the account.

### 5.3 Home Discovery Feed (FEED)

| ID | Requirement |
|---|---|
| FEED-01 | Masonry-style responsive visual feed with natural image proportions |
| FEED-02 | Each card shows media, creator/attribution, caption, skills, content type |
| FEED-03 | Open a content detail view from a card |
| FEED-04 | Save / unsave directly from a card |
| FEED-05 | "Not interested" action that hides the item and down-weights similar content |
| FEED-06 | "More like this" navigation from an item |
| FEED-07 | Cursor-based incremental loading (infinite scroll with accessible "Load more" fallback) |
| FEED-08 | Loading, empty, error and retry states |
| FEED-09 | No duplicate items within the same feed session |
| FEED-10 | Fallback visuals for missing or failed media |
| FEED-11 | Includes items from outside the user's interests for discovery |
| FEED-12 | **Video (CONFIRMED, OD-15):** no autoplay in the feed — poster image + play icon + duration badge; plays on tap, starts muted with controls; never preloaded |
| FEED-13 | **Filter chips** above the feed (CONFIRMED, from design `1c`/`2b`): `For you` (default, ranked feed) · one chip per user interest · `New to you` (only skills outside the user's interests). Changing the filter starts a new feed session. Number of interest chips shown and their order: CONFIRMED (P1-21) — up to 5, most recently added interests first |
| FEED-14 | **"New to you" skill suggestion card** (CONFIRMED, from design): a feed item suggesting a skill the user has not selected, showing skill name, a short pitch, and a link to the skill page ("Try it →"). Shown on mobile in the feed and on desktop in the right rail. Frequency/position: CONFIRMED (P1-21) — first item of the first page of a For you session only; desktop right rail. Pitch text is admin-authored per skill; the beginner-project count line ("3 beginner projects under an hour") is computed from published posts |

**Post types (CONFIRMED)** — shown as a label on every card: `First attempt` · `Tutorial` (label includes estimated time, e.g. "Tutorial · 20 min") · `Work in progress` · `Journal` · `Finished` · `Tip` (materials/technique tips). Any type may carry images or short video. All Phase 1 posts are seeded. User-generated posts, community questions and collections-as-feed-items are P2+.

**Ranking:** rules-based (CONFIRMED approach from master doc). Signals: selected interests and levels, saved content, recent interactions, "not interested" feedback, freshness, cross-skill variety. See [SYSTEM_ARCHITECTURE §7](SYSTEM_ARCHITECTURE.md#7-feed-ranking-phase-1). Weights are PROPOSED and tunable.

**Acceptance criteria**
- A new user's first feed reflects onboarding interests.
- Returning users see relevant content plus a share of discovery content.
- Slow networks and failed media degrade gracefully.
- Paging never repeats an item within one session.

### 5.4 Search and Explore (SRCH)

| ID | Requirement |
|---|---|
| SRCH-01 | Search posts/tutorials, skills, creators (profiles) by keyword |
| SRCH-02 | Partial-keyword and typo-tolerant matching (PostgreSQL full-text + `pg_trgm`) |
| SRCH-03 | Results grouped/filterable by type (posts, skills, creators) |
| SRCH-04 | Empty-query and no-results states with suggestions |
| SRCH-05 | Explore page: curated themes ("Themes this week", with idea count), skills to try, popular/new skills, beginner-friendly projects; "Use what you have" section shown as **coming soon** (Phase 2) |
| SRCH-08 | **Skill hints** (CONFIRMED, DC-09): each skill can carry one short editor-set hint tag shown on skill cards (e.g. "Beginner friendly", "Pairs with drawing", "Under ₹300 to start"); managed in admin |
| SRCH-06 | Skill page: selecting a skill shows its content and related skills |
| SRCH-07 | Custom interests are discoverable in search and have skill pages |

Searching communities, collections and tags is P2/P3 (those entities are not populated in P1).

**Curated themes** (e.g. "Small crafts for a relaxing evening") are created by admins in Phase 1. Whether themes are a separate entity or a public admin-owned collection: PROPOSED as a `Theme` entity (see DATABASE_SCHEMA).

**"Use what you have" (ideas based on available materials):** Phase 2 (CONFIRMED, DC-09); shown as coming soon in Phase 1.

### 5.5 Content Detail and Tutorials (POST)

| ID | Requirement |
|---|---|
| POST-01 | Show main media: a gallery of up to 10 images and short videos, mixed (PO decision, P1-16) |
| POST-02 | Show creator, or for seed content, attribution (source, license, original author) |
| POST-03 | Description/story |
| POST-04 | Associated skills (linked to skill pages) |
| POST-05 | Optional: materials and tools list |
| POST-06 | Optional: ordered steps (text + optional image per step) |
| POST-07 | Optional: difficulty (uses experience scale), estimated time |
| POST-08 | Related posts |
| POST-09 | Save and share (Web Share API, copy-link fallback) |
| POST-10 | Missing optional fields render nothing — no empty headings |
| POST-11 | **Materials checklist** (CONFIRMED, DC-07): signed-in users can tick materials; checks are saved to their account and sync across devices. Header shows "{n} of {total} · saved to your account" |
| POST-12 | **Step progress** (CONFIRMED, DC-07/DC-24): each step can be marked done/undone by tapping its number; a "Next step" button scrolls to the next unfinished step; header shows "Step {completed} of {total} · progress saved"; saved per user and synced |
| POST-13 | **Attribution block** (CONFIRMED, DC-10) below the steps on every seeded post: source title, original author, site link, license, "Added by dodoi editors" |

Comments and reporting on posts are P2.

### 5.6 Saved Content and Collections (COLL)

| ID | Requirement |
|---|---|
| COLL-01 | Save / unsave a post (goes to "All saved") |
| COLL-02 | Create named collections |
| COLL-03 | Add/remove a saved post to/from one or more collections |
| COLL-04 | Rename and delete collections |
| COLL-05 | Browse all saved posts and each collection |
| COLL-06 | Collection visibility: **private by default** (CONFIRMED); user may switch to public |
| COLL-07 | Open a post directly from a collection |

**CONFIRMED rules**
- Deleting a collection removes only the collection and its memberships. The posts **stay saved** in "All saved".
- Unsaving a post removes it from all of the user's collections (CONFIRMED).
- Removing a saved item never deletes the original post.
- Private collections are visible only to their owner.

**Limits (CONFIRMED, OD-17):** max 100 collections per user; max 1,000 posts per collection; names 1–80 characters, unique per user (case-insensitive); no limit on total saves (paginated).

### 5.7 Profiles (PRF)

| ID | Requirement |
|---|---|
| PRF-01 | Profile fields: display name, unique username, avatar, short bio. Users upload or replace their **own avatar** any time in Edit profile (P1-12/P1-14); until then a craft-pattern placeholder is shown. The Google profile photo is **not** imported |
| PRF-02 | Skill lists kept distinct: **interests**, **can help with**, **want to learn** (CONFIRMED — the design's profile groups "Learning / Curious about" are replaced by these three lists; see UI_UX DC-08) |
| PRF-03 | Experience level per skill |
| PRF-04 | Edit own profile |
| PRF-05 | Public profile page at `/u/{username}` |
| PRF-06 | Profiles **public by default** (CONFIRMED); user can set profile to private |
| PRF-07 | Public collections shown on profile |
| PRF-08 | Private fields (email, DOB if collected) never exposed by public endpoints |

**Private profile (CONFIRMED, OD-10):** others see only avatar, display name and username with "This profile is private"; bio, skills and public collections are hidden; the profile is excluded from creator search. The owner always sees everything. Follow-approval behaviour is decided in P2. Following (P2) and blocking (P2) are not in P1. Username rules (CONFIRMED, OD-11): 3–20 characters; lowercase letters, digits, `_` and `-`; must start with a letter; case-insensitive unique; reserved names blocked; can be changed at most once every 30 days.

### 5.8 Seed Content Pipeline and Admin (ADM)

| ID | Requirement |
|---|---|
| ADM-01 | Seed script imports skills, themes and posts from JSON, uploading media to Cloudinary |
| ADM-02 | Seed import is idempotent (re-running does not duplicate records) |
| ADM-03 | Every seeded post stores: source type, license, attribution text, original URL (if any), original author name |
| ADM-04 | Minimal admin UI (ADMIN role only): list, create, edit, unpublish seed posts and themes |
| ADM-05 | Admin UI supports image and short-video upload with the same validation as the API |
| ADM-06 | Admin actions are recorded in an audit log |

**Seed source types (CONFIRMED):** `TEAM_ORIGINAL`, `INVITED_CREATOR`, `STOCK_LICENSED`, `CREATIVE_COMMONS`. Creative Commons content is limited to **CC BY and CC BY-SA** (no NC, no ND); author, source link and license are always shown (DC-25).

**Rule:** no scraping of Pinterest, Instagram, Google Images or any source without a license permitting this use.

**Invited creators (CONFIRMED, OD-18/DC-27):** get a real dodoi account; their seeded posts have `authorId` set and show the creator row (Follow = coming soon in P1). Team-original, stock and Creative Commons posts have no author account: no creator row, a "via dodoi editors" line, and the attribution block.

### 5.8b Media Limits (MEDIA)

| ID | Requirement (CONFIRMED, OD-15 / OD-23) |
|---|---|
| MEDIA-01 | Images: JPEG, PNG, WebP, HEIC; max 10 MB each; shortest side ≥ 600 px; max 10 images per post |
| MEDIA-02 | Avatars: same formats, max 5 MB |
| MEDIA-03 | Video: MP4, MOV, WebM; max 60 seconds and 50 MB; Cloudinary transcodes for streaming and generates the poster |
| MEDIA-04 | Location/EXIF metadata stripped on delivery |
| MEDIA-05 | Limits enforced at signature time and re-verified against Cloudinary metadata after upload |

### 5.9 Coming-soon Navigation (NAV)

CONFIRMED: the Phase 1 UI keeps the full navigation layout from the design, with features that are not built yet shown as **disabled "coming soon"** items.

| ID | Requirement |
|---|---|
| NAV-01 | Coming-soon items in Phase 1: Create (tab/button), Community (tab/link), Messages, Journal, notifications bell, "Ask dodoi" pill/card, Follow, "Start as my project", "Ask about this", profile Projects/Posts tabs, following count |
| NAV-02 | A coming-soon item never performs its future action or calls an unbuilt API |
| NAV-03 | Coming-soon items are perceivable and accessible: `aria-disabled="true"` plus an accessible explanation |
| NAV-04 | Coming-soon items are **not tappable** (CONFIRMED, DC-19/DC-21). Cards/sections: dashed border, muted text, butter "Coming soon" pill. Nav tabs, icons and small buttons: muted, small butter "Soon" pill, tooltip "Coming soon" only |
| NAV-05 | Desktop right rail in Phase 1 (CONFIRMED, DC-20/DC-22): "New to you" card; "Help other makers" coming-soon card showing the user's can-help skills as chips; "Live sessions" coming-soon card. Post detail uses the full sidebar in P1 (DC-23) |

### 5.11 Reporting in Phase 1 (RPT) — CONFIRMED (OD-12)

| ID | Requirement |
|---|---|
| RPT-01 | Signed-in, verified users can report a **custom skill** or a **profile** |
| RPT-02 | Reasons: Offensive · Spam · Impersonation · Other (with optional note, max 500 chars) |
| RPT-03 | One open report per reporter per target; rate-limited |
| RPT-04 | Admin UI lists open reports; admin can hide the skill / set the profile hidden, or dismiss; every action audited |
| RPT-05 | Reporter sees a neutral confirmation; reported user is not told who reported |

### 5.10 PWA Foundation (PWA)

| ID | Requirement |
|---|---|
| PWA-01 | Responsive layouts: mobile, tablet, desktop |
| PWA-02 | Web app manifest, icons, installability |
| PWA-03 | Service worker with defined caching strategies |
| PWA-04 | Install guidance (non-intrusive) |
| PWA-05 | Offline fallback page |
| PWA-06 | Clear offline / reconnect indicator and retry behavior |
| PWA-07 | Optimized responsive images via Cloudinary transformations |

Exact offline matrix is PROPOSED in [SYSTEM_ARCHITECTURE §9](SYSTEM_ARCHITECTURE.md#9-pwa-and-offline-strategy) and requires approval. The product must never imply that online-only features work offline.

---

## 6. Post-MVP Requirements (summary)

Detailed specs will be written before each phase begins. Source: master doc §5.7–5.15.

| Phase | Requirements (summary) | Decisions already made |
|---|---|---|
| P2 | Post creation (images, short video, captions, skills, tags, materials, steps, difficulty), preview, edit, delete; creative journal (Project → ProjectEntry); comments (threading OPEN); single like; following; in-app notifications; reporting and blocking for posts, comments, profiles | Single like/heart; like counts visible only to owner |
| P3 | Communities (join/leave, discussions, rules, reporting, auditable moderation); direct messaging; peer-help requests (open / in progress / resolved); scheduled sessions with timezone handling | Messaging uses polling first |
| P4 | AI companion: skill discovery, learning assistance, image-aware troubleshooting, project planning; usage limits | Provider OPEN |
| P5 | Recommendation improvements, push notifications, offline improvements, performance, advanced community tools | — |

## 7. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | Core Web Vitals at p75: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (starting target; finalize after baseline) |
| NFR-02 | All list endpoints paginated; hard maximum page size enforced server-side |
| NFR-03 | Responsive images via Cloudinary; no full-resolution originals in feed |
| NFR-04 | WCAG 2.2 AA (PROPOSED as the concrete accessibility target) |
| NFR-05 | Current stable Chrome, Edge, Firefox, Safari (desktop), Safari iOS, Chrome Android |
| NFR-06 | Idempotent seed import; duplicate-submit protection on create actions |
| NFR-07 | Structured error responses (see API spec) |
| NFR-08 | No secrets in client bundles; server-only env vars |
| NFR-09 | Operate within free tiers; track usage of Cloudinary, Resend |

## 8. Success Metrics

**North Star (definition OPEN, OD-19):** Weekly Active Creative Explorers — unique users per week completing ≥1 meaningful discovery action (candidate actions: save, open a tutorial, explore a new skill).

Phase 1 supporting metrics: signup completion, onboarding completion, % selecting interests, % saving first idea, feed→detail CTR, saves per active user, distinct skills explored, engagement with out-of-interest items, % revisiting saved content, D1/D7/D30 retention.

**Analytics tooling is OPEN (OD-20).** No analytics SDK is to be added until decided.

## 9. Open Decisions Register

Agents must not implement behavior that depends on an OPEN item. Ask the product owner.

| ID | Decision | Blocks | Phase |
|---|---|---|---|
| OD-01 | Hosting for the **test** and **production** environments (three environments CONFIRMED: local, test, production — SYSTEM_ARCHITECTURE §13). Must be free for now. **Test: Vercel Hobby + Neon (DECIDED 2026-10-27).** Production: open (Hobby is non-commercial) | Deployment tasks | Production: before launch |
| OD-02 | AI provider and model(s) | All AI work | P4 |
| OD-03 | Video calls: integrated vs external provider | Sessions | P3 |
| OD-04 | Monetization | — | Later |
| OD-05 | Content licensing policy for user uploads (terms of service, ownership, takedown process) | Launch, P2 uploads | Before launch |
| OD-06 | Community creation permissions, private communities | Communities | P3 |
| OD-07 | ~~Age-gate method~~ — **RESOLVED: date of birth, discarded after check** | — | — |
| OD-08 | ~~Unverified user permissions~~ — **RESOLVED: private features allowed; public actions need verification; delete after 30 days** | — | — |
| OD-09 | ~~Google ↔ password linking~~ — **RESOLVED: auto-link; remove password if existing account was unverified** | — | — |
| OD-10 | ~~Private profile~~ — **RESOLVED: only avatar, name, username visible; excluded from search** | — | — |
| OD-11 | ~~Username rules~~ — **RESOLVED: 3–20 chars, lowercase a–z, 0–9, `_`, `-`; must start with a letter; reserved list (admin, dodoi, api, support, help, settings, explore, …); change at most once per 30 days**. Full list (OD-11 names + every top-level route) in `src/server/modules/users/username.ts` — CONFIRMED 2026-10-27 | — | — |
| OD-12 | ~~Minimal P1 reporting~~ — **RESOLVED: yes, for custom skills and profiles (§5.11)** | — | — |
| OD-13 | ~~Custom interest limits~~ — **RESOLVED: 2–40 chars, Unicode letters, blocklist, verified email** | — | — |
| OD-14 | ~~Minimum interests~~ — **RESOLVED: 3** | — | — |
| OD-15 | ~~Video limits~~ — **RESOLVED: MP4/MOV/WebM, 60 s, 50 MB, no feed autoplay** | — | — |
| OD-16 | ~~Ideas based on available materials~~ — **RESOLVED: Phase 2**, coming soon in P1 | — | — |
| OD-17 | ~~Collection limits~~ — **RESOLVED: 100 collections, 1,000 items each, unique names** | — | — |
| OD-18 | ~~Invited creators~~ — **RESOLVED: real accounts** | — | — |
| OD-19 | Exact North Star definition | Analytics | Before analytics |
| OD-20 | Analytics tool (must be free) | Metrics | P1 or later |
| OD-21 | Error monitoring / logging service (must be free) | Observability | P1 or later |
| OD-22 | ~~Account deletion~~ — **RESOLVED: 14-day grace period, then hard delete (§ SECURITY 7.3)** | — | — |
| OD-23 | ~~Image limits~~ — **RESOLVED: JPEG/PNG/WebP/HEIC, 10 MB, ≥600 px, 10 per post** | — | — |
| OD-24 | ~~Git hosting / CI~~ — **RESOLVED: GitHub + GitHub Actions** | — | — |
| OD-25 | Comment threading in P2 | Comments | P2 |
| OD-26 | Privacy policy and terms of service authorship | Launch | Before launch |
| OD-27 | ~~Rate-limit store~~ — **RESOLVED: PostgreSQL table behind interface** | — | — |
| OD-28 | ~~Minimum age 13+ vs India's DPDP Act~~ — **RESOLVED: minimum age raised to 18+** (adults only) | — | — |
| OD-29 | ~~Signed-out browsing~~ — **RESOLVED:** signed-out visitors can see the **landing page** and **published post detail pages** (with related posts) read-only, so shared links work; feed, explore, search, skill/theme pages, profiles, saves and everything else require sign-in | — | — |
| OD-30 | ~~Predefined skill list~~ — **RESOLVED (2026-10-23):** the 51 skills in `prisma/seed/skills.json` are approved; the PO may edit the file later (the seed test validates every entry) | — | — |
| OD-31 | Minimum seed content per skill / post type for launch | Seed production, launch gate | P1-19 |
| OD-32 | ~~Text-search config~~ — **RESOLVED: `simple`** (language-neutral) | — | — |
| OD-33 | ~~Icon set~~ — **RESOLVED: Lucide** (`lucide-react`) | — | — |
| OD-34 | ~~Branch protection / secret scanning~~ — **RESOLVED: stay on free GitHub for now**; rely on agent rules and checking CI before merging; revisit before adding contributors | — | — |
| OD-35 | ~~CSP approach~~ — **RESOLVED: static policy without nonces (option A)**; keeps static rendering; revisit if user HTML is rendered | — | — |
| OD-36 | ~~Blocklist source~~ — **RESOLVED:** LDNOOBW English + romanised Hindi (CC BY 4.0, credited in THIRD_PARTY_NOTICES.md), minus 23 reviewed craft-safe exceptions (e.g. 'fingering' yarn, 'swastika' rangoli, 'butt' joint, 'patakha') | — | — |
