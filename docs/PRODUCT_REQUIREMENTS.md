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
| AUTH-06 | Sign out (current session). Entry points: desktop sidebar, own profile (mobile and tablet), Settings → Account; sidebar and profile ask first ("Log out of dodoi?"). Signing out deletes the pages and images kept for offline use (SYSTEM_ARCHITECTURE §9) |
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
| POST-09 | Save and share: **"Share link"** sends a link to the post — the device's share sheet where there is one, otherwise a menu with Copy link, WhatsApp, Email (PO decision 2026-10-29: "share" never means publishing; publishing is **Post** in Create). The maker's own post shows "Live · showing in feeds" (or "Draft · only you can see this" in preview) |
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
| PRF-07 | Public collections shown on profile; from P2-02 also the user's published posts (Posts tab) and, for the owner, their drafts |
| PRF-08 | Private fields (email, DOB if collected) never exposed by public endpoints |

**Private profile (CONFIRMED, OD-10):** others see only avatar, display name and username with "This profile is private"; bio, skills and public collections are hidden; the profile is excluded from creator search. The owner always sees everything. Follow-approval behaviour is decided in P2 (proposed: private profiles cannot be followed, FLW-02). Following (P2) and blocking (P2) are not in P1. Username rules (CONFIRMED, OD-11): 3–20 characters; lowercase letters, digits, `_` and `-`; must start with a letter; case-insensitive unique; reserved names blocked; can be changed at most once every 30 days.

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

**Invited creators (CONFIRMED, OD-18/DC-27):** get a real dodoi account; their seeded posts have `authorId` set and show the creator row (Follow = coming soon in P1, live from P2-06). Team-original, stock and Creative Commons posts have no author account: no creator row, a "via dodoi editors" line, and the attribution block.

### 5.8b Media Limits (MEDIA)

| ID | Requirement (CONFIRMED, OD-15 / OD-23) |
|---|---|
| MEDIA-01 | Images: JPEG, PNG, WebP, HEIC; max 10 MB each; max 10 images per post. **No minimum size (PO decision 2026-10-29, was ≥ 600 px):** photos under 600 px on the short side upload normally and get a friendly "may look a little soft" note. In the Create flow, photos over 10 MB are shrunk in the browser (long side 2,400 px) instead of being refused, and every photo can be cropped, zoomed and rotated in a photo editor (UI_UX_GUIDELINES §8.1) |
| MEDIA-02 | Avatars: same formats, max 5 MB |
| MEDIA-03 | Video: MP4, MOV, WebM; max 60 seconds and 50 MB; Cloudinary transcodes for streaming and generates the poster |
| MEDIA-04 | Location/EXIF metadata stripped on delivery |
| MEDIA-05 | Limits enforced at signature time and re-verified against Cloudinary metadata after upload |

### 5.9 Coming-soon Navigation (NAV)

CONFIRMED: the Phase 1 UI keeps the full navigation layout from the design, with features that are not built yet shown as **disabled "coming soon"** items.

| ID | Requirement |
|---|---|
| NAV-01 | Coming-soon items in Phase 1 (**Community is live from P3-03**; Messages stays coming soon until P3-02): Create (tab/button), Community (tab/link), Messages, Journal, notifications bell, "Ask dodoi" pill/card, Follow, "Start as my project", "Ask about this", profile Projects/Posts tabs, following count — **Follow and the following count are live from P2-06;** **Create is live from P2-02** (2026-10-29); **"Ask dodoi" and "Ask about this" are live from P4-02** (2026-10-30) |
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
| P2 | Post creation (images, short video, captions, skills, tags, materials, steps, difficulty), preview, edit, delete; creative journal (Project → ProjectEntry); comments (one level of replies, OD-25); single like; following; in-app notifications; reporting and blocking for posts, comments, profiles | Single like/heart; like counts visible only to owner; comments one level deep (OD-25); makers keep ownership of uploads (OD-05). Detailed in §6.1 |
| P3 | Communities (join/leave, discussions, rules, reporting, auditable moderation); direct messaging; peer-help requests (open / in progress / resolved); scheduled sessions with timezone handling | Messaging uses polling first; spec in §6.3 PROPOSED (2026-10-30) |
| P4 | AI companion: skill discovery, learning assistance, image-aware troubleshooting, project planning; usage limits | Provider decided (Gemini); spec in §6.2 CONFIRMED |
| P5 | Recommendation improvements, push notifications, offline improvements, performance, advanced community tools | — |

### 6.1 Phase 2 — Creative Expression (P2-00 draft, 2026-10-28)

**Status: CONFIRMED — approved by the product owner 2026-10-28 (P2-00).** Decided by the PO: single like with owner-only counts; comments one level deep (OD-25); makers keep ownership (OD-05); Create post is the first build slice. The rest was proposed in the P2-00 draft and approved as written. Schema: DATABASE_SCHEMA §9; API: API_SPECIFICATION §9; flows: USER_FLOWS §2; permissions and limits: SECURITY_AND_PRIVACY §3, §6; screens: UI_UX_GUIDELINES §8.

**Who can do what (PROPOSED):** every signed-in user can write drafts and journal entries (private); anything others can see — publishing a post, a public project, a comment, a like, a follow, a report — needs a verified email (OD-08 rule extended).

#### Create post (CRT) — slice 1 (P2-01, P2-02)

| ID | Requirement |
|---|---|
| CRT-01 | Create a post Instagram-style (PO choice 2026-10-28): Create tab / button → pick photos/videos → arrange (order, cover, alt text) → details screen (caption-style: title and story on top, then rows for type, skills, tags, materials and steps, difficulty and time) → **Post** (button renamed from "Share", PO 2026-10-29). Drafts save automatically and are listed under "Drafts" on the own profile |
| CRT-02 | Post type: any of the six types (First attempt, Tutorial, Work in progress, Journal, Finished, Tip). A Tutorial needs ≥ 2 steps and an estimated time to publish |
| CRT-03 | Media: 1–10 images/videos, mixed, MEDIA-01/03 limits; at least one to publish; reorder; first item is the cover. Alt text required on every image to publish, with a short prompt ("Describe the photo for people who can't see it") |
| CRT-04 | Details: title (1–120), description (≤ 2,000), difficulty and estimated time optional |
| CRT-05 | Skills: 1–5, exactly one main skill; any active skill, including the user's own custom skills |
| CRT-06 | Tags: 0–10 free tags, 2–30 characters, lowercased and normalised like custom skills, blocklist applied (OD-36). Tags are searchable; no tag pages in P2 |
| CRT-07 | Materials (≤ 30, name + optional note) and steps (≤ 30, text ≤ 1,000 + optional photo), as in POST-05/06 |
| CRT-08 | Ownership (OD-05): before the first publish the maker ticks "This is my own work, and I'm happy for dodoi to show it" (links to the terms); stored with the date. The post shows the creator row; no attribution block |
| CRT-09 | "Preview" on the details screen shows the post exactly as others will see it (`1e`/`2c` layout); optional, not a step (as Instagram) |
| CRT-10 | Edit after publishing: all fields; changes are live immediately; "Edited" is not shown |
| CRT-11 | Delete: confirmation, then the post, its media, comments, likes and saves are deleted (removed from everyone's collections). No unpublish for users |
| CRT-12 | Published user posts join the feed candidate pool, search and skill pages like seeded posts; the author never sees their own posts in their feed |
| CRT-13 | Limits: 20 published posts / day / user; 50 drafts per user |

#### Creative journal (JRN) — P2-03

| ID | Requirement |
|---|---|
| JRN-01 | A **project** has a title (1–80), an optional main skill, status *In progress* / *Completed*, and visibility *Private* (default) / *Public* |
| JRN-02 | **Progress entries**: an optional title (≤ 80, as design `1g` shows — added 2026-10-29, PO to confirm), text (≤ 2,000) and 0–4 photos; at least one of them; dated automatically; newest first; numbered "Entry n · {relative date}" (design `1g`) |
| JRN-03 | "Start as my project" on a tutorial creates a private project named after it, linked to the tutorial and copying its materials as the project's checklist |
| JRN-04 | Mark complete (and reopen); completed projects show a "Finished" pill |
| JRN-05 | **Share** (design `1g`) opens Create post pre-filled from the project's latest entry (type Work in progress, or Finished when the project is complete); the post links back to the public project |
| JRN-06 | Public projects appear on the profile **Projects** tab; private ones only to the owner. Projects never appear in the feed |
| JRN-07 | Limits: 100 projects per user, 200 entries per project |

#### Comments (CMT) — P2-04 (OD-25)

| ID | Requirement |
|---|---|
| CMT-01 | Comments on published posts: 1–1,000 characters, plain text, oldest first; replies (one level) shown under their comment, oldest first; "Reply" on a reply answers the same comment and starts with @username |
| CMT-02 | Edit own comment (shows "edited"); delete own comment — if it has replies it shows "Comment deleted" and the replies stay |
| CMT-03 | The post's author can delete any comment on their post |
| CMT-04 | Comments load 20 at a time; the count of comments is shown publicly (it is not a like count) |
| CMT-05 | Rate limit: 30 comments / hour / user |

#### Likes (LIKE) — P2-05

| ID | Requirement |
|---|---|
| LIKE-01 | One like per user per post (heart toggle); the liker sees their own state |
| LIKE-02 | The like count is visible only to the post's author (CONFIRMED); nobody sees who liked except the author, as a list in notifications |
| LIKE-03 | Likes do not change feed ranking in P2 |

#### Following (FLW) — P2-06

| ID | Requirement |
|---|---|
| FLW-01 | Follow / unfollow a user with a public profile from their profile, the creator row and the post detail (replaces the coming-soon Follow buttons) |
| FLW-02 | Private profiles cannot be followed in P2 (no follow requests); turning a profile private keeps existing followers |
| FLW-03 | Follower and following counts are shown only to the profile owner (PP-4); the owner can open both lists |
| FLW-04 | Feed: posts from followed makers get a ranking boost, and a "Following" filter chip shows only them. **Built P2-06:** boost +4 (PO to confirm); the chip appears after "For you" once the user follows someone; empty state "No new posts from people you follow" |

#### Notifications (NTF) — P2-07

| ID | Requirement |
|---|---|
| NTF-01 | In-app only: new comment on your post, reply to your comment, new follower, likes on your post (grouped: "Asha and 3 others liked …") |
| NTF-02 | The bell (replaces the coming-soon bell) shows an unread dot; the list opens at `/notifications`; opening the list marks all as read |
| NTF-03 | Checked when a page opens and every 60 s while the tab is visible (no push in P2) |
| NTF-04 | Preferences in Settings: each type on/off (all on by default) |
| NTF-05 | Kept 90 days; never sent for blocked users (the block part comes with P2-08). **NTF-01…04 built P2-07**; bell placement and the other choices are in README §2 |

#### Safety (MOD) — P2-08

| ID | Requirement |
|---|---|
| MOD-01 | Report posts, comments, profiles and custom skills; reasons as RPT-02 plus **"Not my work"** (copyright — OD-05 takedown) |
| MOD-02 | **Block** a user from their profile, post or comment menu: both stop seeing each other's profile, posts and comments (404 / filtered out); follows both ways are removed; neither can comment on, like or follow the other. The blocked user is not told. Block list with Unblock in Settings |
| MOD-03 | **MODERATOR** role: works the reports queue (hide post / comment / profile / skill, dismiss, show again) but cannot edit content, themes, skills or roles. Admins assign it |
| MOD-04 | A hidden post or comment disappears for everyone except its author, who sees "Hidden after a report" and can delete it |
| MOD-05 | Every moderation action is audited (AuditLog, as in P1) |
| MOD-06 | "Not my work" reports are also reachable by email (support address in the terms) for people without an account |

### 6.2 Phase 4 — AI Creative Companion (P4-00, approved 2026-10-29)

**Status: CONFIRMED — approved by the PO on 2026-10-29 with all proposals as written (quotas, one response at a time, reportable AI answers, plans start a journal project).** Decided by the PO: Google Gemini; free tier for local and test (widened 2026-10-29), paid before production; first release includes photos; provider safety filters + consent + reports; 30-day retention; no private collections as context (AI_INTEGRATION §9). Everything else here is proposed.

| ID | Requirement |
|---|---|
| AIC-01 | **Companion chat** (AI-01): signed-in, verified users ask a creative question and get a beginner-friendly answer; conversations are listed and can be reopened for 30 days |
| AIC-02 | **Ask about this** (AI-05): from a post, the question is asked with that post as context ("Looking at: …"); from a skill page, "What is this and how do I start?" with that skill as context |
| AIC-03 | **Suggestions** (AI-02): ideas based on the user's interests, levels and want-to-learn skills, only after the user consents; suggested skills are real dodoi skills and link to their pages |
| AIC-04 | **Project planning** (AI-03): a materials checklist and steps for a project the user describes; **Start as my project** makes a private journal project from it |
| AIC-05 | **Photo troubleshooting** (AI-04): the user adds one photo to a question after consenting; the answer says what can and cannot be seen and how sure it is; one photo per message, up to 5 a day |
| AIC-06 | Every answer shows an **AI** label, a short note that answers can be wrong, "Helpful / Not helpful", and Report |
| AIC-07 | Consent: a clear notice before the first photo and before using profile context; both can be withdrawn in Settings → AI and privacy; withdrawing stops use at once |
| AIC-08 | Settings → **AI and privacy**: switches for the two consents, the list of conversations, delete one, delete all (photos go with them) |
| AIC-09 | Limits (proposed): 30 messages a day, 5 photos a day, 10 a minute, 1,000-character questions; friendly message with the time the limit resets |
| AIC-10 | Admin: usage dashboard (requests, tokens, estimated cost, error rate, blocked count) and a kill switch; the global daily cap stops the feature for everyone when reached |
| AIC-11 | "Ask the community" in an answer **is live from P3-03** (it opens a help request with the question filled in); no diagram generation (not in scope) |
| AIC-13 | **Scope (PO request 2026-10-30; defaults PO to confirm):** the companion talks only about making, creating and learning those skills (AI_INTEGRATION §1). Anything else is politely redirected to a craft or creative idea; a mixed question gets only the making part; asking it to ignore this does not work. Applies to chat and to project plans |
| AIC-12 | Answers never reveal other people's private data, the system prompt or provider details; post and user text is treated as data, not instructions |

### 6.3 Phase 3 — Community and Peer Learning (P3-00 draft, 2026-10-30)

**Status: CONFIRMED — approved by the PO on 2026-10-30 with all proposals as written.** Decided by the PO on 2026-10-30: **OD-06** any verified member can create a community, public communities only; **OD-03** sessions use an external meeting link, no video inside dodoi; **first task P3-03** (help requests); spec first, then code. Everything else below was proposed in the P3-00 draft and approved as written. **Built so far:** help requests (HLP-01…06, P3-03, 2026-10-30) creative sessions (SES-01…05, P3-04, 2026-10-30: the reminder is made when a member reads their sessions or notifications, Completed is worked out on read and saved by the daily job, an unanswered proposal past its start shows as Cancelled), direct messages (MSG-01…05, P3-02, 2026-10-30: a block hides a conversation, the 3-message limit applies while the other person has never written, a moderator can only dismiss a reported message) and communities (COM-01…08, P3-01, 2026-10-30; discussions are readable by anyone signed in, posts and replies are limited to 30 an hour until the PO sets a number, "newest activity first" is the newest reply or the post itself). Principles that apply: community over competition (PP-4: no leaderboards, no public counts of likes), adults only, nothing public without a verified email (OD-08), blocks work both ways (MOD-02).

**Communities (COM)** — screen `1h` tab "Your circles"

| ID | Requirement |
|---|---|
| COM-01 | Any **verified** member can create a community: name (3–40 characters), one **skill** (required, so communities can be found by craft), description (≤ 300), up to 5 rules (≤ 150 each). **Public only** (OD-06): anyone signed in can read and join. Limits: 2 created a day, 10 owned in total |
| COM-02 | Names, descriptions and rules go through the same blocked-word check as usernames and custom skill names (OD-13/OD-36); duplicate names are refused (case-insensitive) |
| COM-03 | Join and leave with one tap; a member's communities are listed under "Your circles"; discovery lists communities for the member's interests first, then newest; search by name. No member lists and no member counts shown publicly (PP-4); the owner sees the count |
| COM-04 | Roles: **Owner** (the creator), **Moderator** (appointed by the owner), **Member**. The owner can leave only after handing ownership to a moderator or deleting the community |
| COM-05 | **Discussions:** a verified member who has joined posts text (≤ 2,000) with up to 4 photos; one level of replies like comments (OD-25); the author can edit for 15 minutes and delete always; newest activity first |
| COM-06 | **Community moderation:** owner and moderators hide or restore posts and replies and remove a member; every action is written to an audit trail (who, what, when, never content). Removed members can be allowed back by the owner only. Site admins and moderators can hide a whole community from the reports queue (target `COMMUNITY`) |
| COM-07 | Reports (reason list as P2) on communities, discussion posts and replies; the reporter is never shown (RPT-05). Blocked members' posts and replies are hidden from each other |
| COM-08 | Deleting a community by its owner deletes its discussions and photos after a confirmation; deleting an account hands each owned community to its oldest moderator, or deletes it when it has none |

**Direct messages (MSG)** — "Messages" in the sidebar (now coming soon)

| ID | Requirement |
|---|---|
| MSG-01 | One-to-one conversations between verified members, text only (≤ 1,000 per message), no photos, links shown as plain text. Started from a profile ("Message") or from a help response. Polling: the open conversation every 10 s while visible, the unread dot every 60 s (SYSTEM_ARCHITECTURE: polling first) |
| MSG-02 | Setting **Who can message me**: Everyone (default) · People I follow · No one. Messaging is also impossible when either side blocked the other; a block ends the conversation for both |
| MSG-03 | Limits: 30 messages an hour, 5 new conversations a day per member, to stop spam. A message to someone who has never replied is limited to 3 until they answer |
| MSG-04 | Only the two participants can read a conversation (anyone else gets 404). A member can delete a message they sent (it shows "Message deleted") and hide a conversation for themselves; neither side sees "seen" receipts |
| MSG-05 | **Report** a message or a person from the conversation; a moderator sees only the reported message and the few before it (SECURITY §8). Retention: messages are kept until deleted; account deletion removes the member's messages |

**Help requests (HLP)** — screen `1h` tab "Help requests"; right-rail "Help other makers"; feed card

| ID | Requirement |
|---|---|
| HLP-01 | A verified member asks for help: title (≤ 100), details (≤ 1,000), one skill (required), up to 3 photos. Limit 5 requests a day. Visible to signed-in members |
| HLP-02 | Status **Open → In progress → Resolved**. Responses (≤ 1,000, text) from other verified members; "Offer help" is writing a response; a member cannot answer their own request. The asker marks a response **Helpful** (shown to the helper as a thank-you in notifications, never as a score), moves the request to **In progress** (also done automatically when a session is proposed from it) and **Resolved**; the asker can reopen it |
| HLP-03 | Matching: members see open requests in the skills they listed under "can help with" in the right rail "Help other makers" card (replaces the coming-soon card, DC-22) and as a "Help request" card in the feed (max one per feed page, only for matching skills, never the member's own) |
| HLP-04 | Requests and responses can be reported; blocked members do not see each other's. The asker can delete their request (responses go with it); requests resolved or idle for 90 days leave the list but stay readable by link for their participants |
| HLP-05 | **Ask the community** in the AI companion chat (live since P3-03, AIC-11) opens a new help request with the question prefilled; the member edits and posts it. The AI answer itself is not shared |
| HLP-06 | Notifications (bell): new response on your request; your response marked helpful; request resolved (to responders). New types `HELP_RESPONSE`, `HELP_HELPFUL`, `HELP_RESOLVED`; preferences get matching switches |

**Creative sessions (SES)** — screen `1h` tab "Sessions"; right-rail "Live sessions"

| ID | Requirement |
|---|---|
| SES-01 | A session is a **scheduled call between two members**, proposed from a help request, a conversation or a profile: date and time, length (15, 30, 45 or 60 minutes), optional note, and an **external meeting link** (OD-03: Google Meet, Zoom or similar; https only; dodoi never embeds or hosts video). The link is visible only to the two participants and only once the session is accepted |
| SES-02 | States: Proposed → Accepted · Declined · Rescheduled (the other person proposes a new time) · Cancelled (either side, any time) · Completed (automatically after the end time). Max 5 open proposals per member; a block cancels open sessions |
| SES-03 | Times are stored in UTC and shown in the viewer's own time zone (from the browser), with **IST** shown beside it when the viewer is somewhere else. Past times cannot be proposed; a new time must be at least 1 hour ahead |
| SES-04 | In-app notifications (no email or push in this phase): proposed, accepted, declined, rescheduled, cancelled, and a reminder one hour before. Types `SESSION_*` |
| SES-05 | A shown link carries the note "Opens another site. Only join if you're comfortable"; sessions are never recorded or monitored by dodoi. Report the person (profile report) for misuse; the link is removed from the app 24 hours after the session ends |

**Use what you have (USE)**

| ID | Requirement |
|---|---|
| USE-01 | The Explore "Use what you have" card (coming soon, DC-09) opens a new companion chat with "I have: …" waiting in the field, so ideas from materials are an AI chat topic and not a separate screen (AI_INTEGRATION §9, AI-07). No new data. Counts against the normal AI limits |

**Order (PO):** P3-03 help requests first, then P3-01 communities, P3-02 messages, P3-04 sessions, P3-05 use what you have. **Open points for the PO** are listed in README §2 (row "Phase 3 spec").

### 6.4 Voice typing (P2-10, approach approved by the PO 2026-10-30; built 2026-10-30)

PO request: a voice option in chats (AI assistant, messaging) and while creating a post, to describe a post or how it was made. **Meaning: voice input — speak and the words are typed into the box.** Approach A (browser dictation) is chosen; nothing here needs a server. Defaults marked "PO to confirm" are in README §2 "Voice typing".

| ID | Requirement |
|---|---|
| VOI-01 | A mic button sits inside these text boxes: AI companion chat and Plan a project, direct messages, create post (description, steps), journal entries, comments, help requests. It is **not** offered on sign-in or account fields, search, alt text, usernames or admin editors. It is hidden when the browser has no speech recognition (for example Firefox) and disabled with a reason while offline. |
| VOI-02 | Tap to start, tap again to stop. It also stops when the message is sent, the box loses focus, the page is hidden or the browser ends the session. Only one box listens at a time. |
| VOI-03 | Final words appear in the box at the cursor; words still being recognised show beside "Listening…" and are typed when they are final (a text box cannot show part of its text muted). The text stays editable. **Dictation never sends, posts, shares or saves by itself**; drafts autosave exactly as they do for typing. |
| VOI-04 | Language: English (India) in the first release. Hindi and Hinglish are open (PO to confirm). |
| VOI-05 | Privacy: dodoi never receives, records or stores audio. The browser does the recognition; in Chrome and Edge the audio goes to the browser vendor's speech service. A one-time note says so before the first use on a device. The text is checked on the server like typed text (blocklists, length limits). |
| VOI-06 | States: idle, listening ("Listening…" text and a static ring, no pulsing), microphone blocked (how to allow it), no speech heard, offline, speech service unavailable. Each has a friendly message and the box keeps working by typing. |
| VOI-07 | Built for mobile, tablet and desktop together; 44 px touch target; keyboard (Space/Enter toggles); screen-reader name and a polite live status; reduced motion respected; WCAG 2.2 AA. |
| VOI-08 | The AI companion receives only the text that is sent, as for typed messages; voice typing does not change AI quotas, consent or retention. |
| VOI-09 | **Out of scope:** audio/voice-note messages, voice changing or effects, reading answers aloud, server-side transcription (approach B), Hindi/Hinglish accuracy work. B may follow if the browser's accuracy is not good enough. |

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
| NFR-09 | Operate within free tiers; track usage of Cloudinary, Resend (and Gmail SMTP on the test site) |

## 8. Success Metrics

**North Star (definition OPEN, OD-19):** Weekly Active Creative Explorers — unique users per week completing ≥1 meaningful discovery action (candidate actions: save, open a tutorial, explore a new skill).

Phase 1 supporting metrics: signup completion, onboarding completion, % selecting interests, % saving first idea, feed→detail CTR, saves per active user, distinct skills explored, engagement with out-of-interest items, % revisiting saved content, D1/D7/D30 retention.

**Analytics tooling is OPEN (OD-20).** No analytics SDK is to be added until decided.

## 9. Open Decisions Register

Agents must not implement behavior that depends on an OPEN item. Ask the product owner.

| ID | Decision | Blocks | Phase |
|---|---|---|---|
| OD-01 | Hosting for the **test** and **production** environments (three environments CONFIRMED: local, test, production — SYSTEM_ARCHITECTURE §13). Must be free for now. **Test: Vercel Hobby + Neon (DECIDED 2026-10-27).** Production: open (Hobby is non-commercial) | Deployment tasks | Production: before launch |
| OD-02 | ~~AI provider and model(s)~~ — **RESOLVED 2026-10-29: Google Gemini** (free tier for local and test, since no paid model is available yet — it lets Google use submitted content, so testers are told; paid tier with no-training terms before production; AI_INTEGRATION §9) | All AI work | P4 |
| OD-03 | ~~Video calls: integrated vs external provider~~ — **RESOLVED 2026-10-30: external meeting link only** (members paste a Meet/Zoom link; dodoi schedules, does not host video) | Sessions | P3 |
| OD-04 | Monetization | — | Later |
| OD-05 | ~~Content licensing for user uploads~~ — **RESOLVED (2026-10-28):** makers keep ownership; publishing grants dodoi a non-exclusive, royalty-free licence to show the post on dodoi only, ending when the post or account is deleted; maker confirms it is their own work; takedown via Report ("Not my work") + support email. **Legal wording pending (OD-26 / pre-launch legal review)** | — | — |
| OD-06 | ~~Community creation permissions, private communities~~ — **RESOLVED 2026-10-30: any verified member can create a community; public communities only** (private ones are not planned) | Communities | P3 |
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
| OD-23 | ~~Image limits~~ — **RESOLVED: JPEG/PNG/WebP/HEIC, 10 MB, 10 per post**; the ≥ 600 px minimum was dropped for everyone on 2026-10-29 (soft note instead) | — | — |
| OD-24 | ~~Git hosting / CI~~ — **RESOLVED: GitHub + GitHub Actions** | — | — |
| OD-25 | ~~Comment threading in P2~~ — **RESOLVED (2026-10-28): one level of replies** (comments + replies to a comment; no replies to replies) | — | — |
| OD-26 | Privacy policy and terms of service authorship | Launch | Before launch |
| OD-27 | ~~Rate-limit store~~ — **RESOLVED: PostgreSQL table behind interface** | — | — |
| OD-28 | ~~Minimum age 13+ vs India's DPDP Act~~ — **RESOLVED: minimum age raised to 18+** (adults only) | — | — |
| OD-29 | ~~Signed-out browsing~~ — **RESOLVED:** signed-out visitors can see the **landing page** and **published post detail pages** (with related posts) read-only, so shared links work; feed, explore, search, skill/theme pages, profiles, saves and everything else require sign-in | — | — |
| OD-30 | ~~Predefined skill list~~ — **RESOLVED (2026-10-23):** the 51 skills in `prisma/seed/skills.json` are approved; the PO may edit the file later (the seed test validates every entry) | — | — |
| OD-31 | ~~Minimum seed content per skill / post type for launch~~ — **RESOLVED (2026-10-28):** every active predefined skill ≥ 2 published posts; 15 launch-focus skills (Drawing, Sketching, Doodling, Watercolor, Acrylic painting, Calligraphy, Crochet, Amigurumi, Knitting, Embroidery, Punch needle, Pottery, Polymer clay, Origami, Journaling) ≥ 6 incl. ≥ 2 tutorials; every post type ≥ 5; every published theme ≥ 6. A post counts toward every skill it is tagged with; hidden and custom skills excluded. Values in `src/lib/constants/seed-coverage.ts` | — | — |
| OD-32 | ~~Text-search config~~ — **RESOLVED: `simple`** (language-neutral) | — | — |
| OD-33 | ~~Icon set~~ — **RESOLVED: Lucide** (`lucide-react`) | — | — |
| OD-34 | ~~Branch protection / secret scanning~~ — **RESOLVED: stay on free GitHub for now**; rely on agent rules and checking CI before merging; revisit before adding contributors | — | — |
| OD-35 | ~~CSP approach~~ — **RESOLVED: static policy without nonces (option A)**; keeps static rendering; revisit if user HTML is rendered | — | — |
| OD-36 | ~~Blocklist source~~ — **RESOLVED:** LDNOOBW English + romanised Hindi (CC BY 4.0, credited in THIRD_PARTY_NOTICES.md), minus 23 reviewed craft-safe exceptions (e.g. 'fingering' yarn, 'swastika' rangoli, 'butt' joint, 'patakha') | — | — |
| OD-37 | **Content moderation beyond reports (raised 2026-10-29 by the PO; to be decided after Phase 2).** Today only usernames, display names, custom skill names and post tags are checked against the offensive-word list (OD-36), and nothing checks images or videos; Phase 2 relies on reports and moderators (P2-08). Options: (1) reactive only, as built; (2) also run the word list on comments, post titles/descriptions/steps and journal text; (3) automatic image/video moderation through an external service (needs the free-tier limits checked first: no paid services). Recommended: 1 + 2 for Phase 2, and decide 3 before public launch | **OPEN** |
