# User Flows

Step-by-step journeys for Phase 1 (MVP), plus outline flows for later phases. Requirement IDs refer to [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md). Where a step depends on an OPEN decision, the step is marked and must not be implemented until resolved.

Notation: `→` next step · `[Screen]` · `{System}` · `⚠` edge case.

---

## 1. Phase 1 Flows

### F-01 First visit (unauthenticated)

1. User opens `/` → `[Landing]` showing value proposition, sample of public seed content, "Get started" and "Sign in".
2. Signed-out visitors (CONFIRMED, OD-29) see the landing page and can open **published post detail pages** read-only (shared links work; Save/actions prompt sign-in). Feed, explore, search, skill/theme pages, profiles and saves redirect to sign-in with a safe return URL.
3. "Get started" → F-02. "Sign in" → F-03.

⚠ PWA install prompt is **not** shown on first visit (see F-12).

### F-02 Register with email and password (AUTH-01, AUTH-04, AUTH-11)

1. `[Sign up]` fields: email, password, **date of birth** (used only to confirm 18+, then discarded).
2. Client validation: email format; password policy (see SECURITY §2.2).
3. Submit → `{POST /api/auth/register}`.
   - Success → `{Send verification email via Resend}` → `[Check your email]` screen with "Resend email" (rate-limited) → user continues to onboarding (unverified users can use private features; public actions show "Verify your email to share with the community" — OD-08).
   - New email → "Check your email" screen ("We've sent you a link."); the form signs the user in straight away. Display name = email local-part.
   - Email already registered with a password → "This email is already registered." on the email field + **Sign in instead** link (opens sign-in with the email filled in, carried in session storage, not the URL).
   - Email registered through Google (no password) → "Looks like you signed up with Google." + inline **Continue with Google** button. (PO decisions; accepted risk, SECURITY §2.5.)
   - Under 18 → "dodoi is for adults 18 and over, so we can't create an account for you."; no data stored.
4. User clicks link in email → `[/verify-email?token=…]` → presses "Confirm my email" (the token is only used on that press, so email link scanners can't use it up) → `{POST /api/account/verify-email}` → `[Verified]` → onboarding or feed.
   - ⚠ Expired/used token → `[Link expired]` with "Send a new link".

### F-03 Sign in (AUTH-02, AUTH-03)

1. `[Sign in]`: email + password, or "Continue with Google".
2. Email/password:
   - Success → if onboarding incomplete → F-05, else → `[Home feed]` (or the originally requested URL).
   - Invalid credentials → "That email and password don't match. Check them and try again." (same message for unknown email).
   - Account without a password (Google sign-up) → "Looks like you signed up with Google, so there's no password for this account. Continue with Google instead." (PO decision, SECURITY §2.5).
   - ⚠ Too many attempts → rate-limited message with retry time.
3. Google:
   - Success, new user → display name pre-filled from the Google name (editable later); Google photo not imported → **date of birth step** (blocks under-18; on block the just-created account is deleted) → username auto-generated → F-05.
   - Success, existing Google-linked user → feed.
   - Email already exists as a password account → linked automatically; if that account was never verified its password is removed and other sessions signed out (OD-09).
   - ⚠ User cancels at Google → return to `[Sign in]` with neutral message "Google sign-in was cancelled."
   - ⚠ Provider error → "We couldn't reach Google. Try again or use email."

### F-04 Password recovery (AUTH-05)

1. `[Forgot password]` → enter email → submit.
2. Always show: "If an account exists for this email, we've sent a reset link. It works once and expires in 1 hour." (rate-limited). "Forgot password?" on sign-in carries the typed email over.
3. Email link → `[Reset password]` → new password + confirm → success → every session signed out (CONFIRMED, SECURITY §2.2) → "Your password is set…" → `[Sign in]`.
4. ⚠ Expired/used token → `[Link expired]` → restart.
5. Google-only accounts requesting reset: same neutral response; the email lets them set a password (adds password sign-in to the account).

### F-05 Onboarding (ONB-01…07)

Entry: `[Welcome]` (design `1a`) is the pre-auth screen with "Continue with Google", "Sign up with email" and "Log in"; onboarding starts after authentication.

1. *(removed — Welcome happens before auth)*
2. `[Step 1 of 3 · Pick interests]` (design `1b`)
   - Grid of predefined skills with images; search box filters as you type (ONB-03).
   - Multi-select chips; selected count visible.
   - "Add your own" → text input → `{normalize}` → if matches existing skill, that skill is selected; otherwise a new public custom skill is created (ONB-04).
   - Minimum **3** selections; button reads "Pick {n} more to continue" (disabled) until then. No "Skip" on this step.
3. `[Step 2 of 3 · Familiarity]` (optional, skippable) — for each selected interest choose Curious / Beginner / Intermediate / Experienced. Default when skipped: no level stored, treated as unknown (CONFIRMED, P1-10).
4. `[Step 3 of 3 · Skills you can help with]` (optional, skippable) — pick from selected/other skills; sets `canHelp`.
   - Username is auto-generated at sign-up (e.g. `aanya-4821`); user can change it in Edit profile; prompt "Pick your username" on first visit to own profile.
5. `{Mark onboarding complete}` → `[Home feed]` with interest-weighted content (until the feed exists, P1-22, finishing returns to `/`).

Routing (P1-11): after sign-in or sign-up, `/` and every signed-in page send a user who hasn't finished onboarding to `/onboarding` (order: date-of-birth step first for Google sign-ups, then onboarding). **Admins skip onboarding** (PO decision, P1-17): `/` and `/onboarding` send them to `/admin`; the age check still applies.

⚠ User closes app mid-onboarding → on next sign-in, resume at the saved step (`User.onboardingStep`, saved on every Continue/Skip — CONFIRMED, P1-10).
⚠ Network failure on submit → inline error, selections retained, retry.

### F-06 Browse the home feed (FEED-01…12)

1. `[Home feed]` loads first page `{GET /api/feed?filter=for-you}` with skeleton cards. Greeting "What will you make tonight, {first name}?" (source of first name: display name — PROPOSED).
   - Filter chips: For you · user's interests · New to you (FEED-13). Selecting a chip reloads the feed with a new session.
   - A "New to you" skill suggestion card appears as the first item (FEED-14) → "Try it →" opens the skill page.
2. User scrolls → next page via cursor. Accessible "Load more" button also present.
3. Card actions: tap card → F-07 · Save icon → F-09 · overflow menu → "Not interested" (FEED-05) / "More like this" (FEED-06).
4. "Not interested" → card collapses with "Hidden. Undo" for a few seconds → `{POST /api/feed/feedback}`.
5. States:
   - Empty (no matching content) → mood-board art + friendly message + **Explore crafts** button (→ `/explore`). Every feed filter uses this art; the message depends on the filter.
   - Error → message + "Try again".
   - Offline → offline banner; previously loaded cards remain visible; further loading disabled until reconnect.
   - ⚠ Broken media → fallback visual with skill color and icon.

### F-07 View content detail (POST-01…10)

1. `[Post detail]` at `/p/{postId}` — media (gallery or video), title, description, attribution/creator, skills, optional materials, steps, difficulty, estimated time.
2. Actions: Save (F-09), Share (Web Share API → fallback copy link with toast).
3. Tap a skill chip → F-08 skill page. Creator row (invited creators only) → profile (F-11); stock/Creative Commons posts show "via dodoi editors" and the attribution block links to the original source.
4. Tutorial progress: tick materials; tap a step number to mark it done (tap again to undo); "Next step" scrolls to the next unfinished step; all saved to the account.
5. Related posts below → open another detail.
6. ⚠ Post unpublished or not found → `[Not found]` with link home.

### F-08 Search and Explore (SRCH-01…07)

1. `[Explore]` sections: popular skills, new skills, curated themes, beginner-friendly projects.
2. Search bar → typing ≥ 2 characters (PROPOSED threshold) shows suggestions (skills, creators).
3. Submit → `[Search results]` with tabs: All · Posts · Skills · Creators.
4. Empty query → suggestions/popular. No results → "No matches for 'xyz'" + related skills + link to Explore.
5. Select skill → `[Skill page]` `/s/{slug}`: description, content grid, related skills.
6. Select theme → `[Theme page]` `/t/{slug}`: curated post grid.

### F-09 Save and organize (COLL-01…07)

1. Tap Save on a card/detail → instant visual saved state (optimistic) → `{POST /api/saves}`. On failure → revert + toast "Couldn't save. Try again."
2. After save, a toast offers "Add to collection" → `[Collection picker sheet]`: existing collections with checkboxes + "New collection".
3. New collection → name (required) → visibility defaults to **Private** → created and item added.
4. `[Saved]` page `/saved`: "All saved" grid + list of collections.
5. Collection page: rename, change visibility, delete, remove item from collection.
6. Delete collection → confirm dialog: "Delete 'X'? Saved posts will stay in All saved." → collection removed, saves retained.
7. Unsave a post → removed from All saved and from every collection (CONFIRMED) → toast with Undo.

### F-10 Edit interests and profile (ONB-08, PRF-04)

1. `[Settings] → Interests` → same picker as onboarding with current selections → save → feed refreshes on next load.
2. `[Edit profile]` → avatar upload (Cloudinary), display name, username, bio, the three skill lists (interests / can help with / want to learn) with levels → save.
3. Validation errors inline; unsaved-changes warning on navigation.

### F-11 View a public profile (PRF-05…08)

1. `/u/{username}` → avatar, name, bio, skills grouped as interests / can help / want to learn, public collections.
2. Private profile → avatar, display name, username and "This profile is private" only (OD-10).
3. ⚠ Unknown username → `[Not found]`.

### F-12 Install the PWA (PWA-02, PWA-04)

1. Install guidance appears only after meaningful engagement (APPROVED 2026-10-27: after first save or second visit), as a dismissible banner.
2. Chromium browsers: native `beforeinstallprompt` → "Install app".
3. iOS Safari: instructional sheet ("Share → Add to Home Screen").
4. Dismissed → not shown again for a period (APPROVED 2026-10-27: 30 days).
5. Installed app opens to `/feed` (or `/` if signed out).

### F-13 Offline behavior

1. Connection lost → persistent banner "You're offline. Some things won't work until you reconnect."
2. Navigation to a non-cached page → `[Offline fallback]`.
3. Save/unsave while offline → **not queued in Phase 1** (APPROVED 2026-10-27); button disabled with tooltip.
4. Reconnect → banner changes to "Back online", auto-dismiss, retry failed loads.

### F-14 Account deletion (AUTH-08)

1. `[Settings] → Account → Delete account`.
2. `/settings/account/delete`: explanation of what is deleted; re-authentication required (password, or for Google-only accounts *Confirm with Google*, which signs in again and returns here).
3. Confirm → account deactivated, signed out → confirmation "We'll delete it on {date}. Changed your mind? Sign in before then to cancel." → hard delete after 14 days (OD-22).
4. Signing in during the grace period → `/account-deletion` only: *Cancel deletion* (→ feed) or *Sign out*.

### F-16 Log out (AUTH-06)

1. Entry: desktop (≥ 1280) sidebar **Log out**, under the Ask dodoi card · mobile and tablet: own profile → **Log out** in the card at the end of the page (with **Settings and privacy**) · any size: Settings → Account → **Sign out**.
2. Sidebar and profile open `[Log out of dodoi?]` (bottom sheet on mobile, centred panel from 768px): "Your collections, journal and progress stay saved. Log back in anytime." → **Log out** (danger) or **Cancel** (closes, nothing changes).
3. Log out → `{delete data kept for offline use}` → `{end session}` → `[Landing]` (`/`). The button shows "Logging out…" and is disabled meanwhile.
4. ⚠ Settings → Account → Sign out signs out straight away (no confirmation step).

### F-15 Admin: manage seed content (ADM-04…06)

1. ADMIN user opens `/admin` (non-admins get 404, not 403, to avoid revealing the route — PROPOSED).
2. `[Admin posts list]` filter by status, skill, source type.
3. Create/edit post: media upload (image/short video), title, description, skills, optional materials/steps/difficulty/time, **required** attribution fields: source type, license, attribution text, original author, original URL.
4. Publish / unpublish. Every action writes an audit log entry.
5. `[Admin themes]` create/edit curated themes and assign posts.

---

## 1b. Phase 2 Flows (CONFIRMED — P2-00 approved 2026-10-28)

Requirements: PRODUCT_REQUIREMENTS §6.1. Public actions below need a verified email; an unverified user who tries one sees the verify-email banner's message with "Resend email" (OD-08).

### F-17 Create and publish a post (CRT-01…13) — Instagram-style (PO choice 2026-10-28)

1. `[Create]` (+ tab on mobile, button in the sidebar/rail) → the system photo picker opens at once (camera roll or camera on phones; several files, up to 10) → `/create`. Uploads start the moment files are picked; a draft is created with the first upload. Cancel in the picker → back where you were.
2. `[Pick]` big preview of the selected item, thumbnail strip below (progress ring on each until uploaded, "+" to add more, × to remove) → "Next" (top right). A photo can be opened in **Edit photo** (crop shape, zoom, drag, rotate → "Use this photo" uploads the edited version in its place); small photos show a "Small photo" note but are never refused.
3. `[Arrange]` drag (or arrows) to reorder; first is the cover ("Cover" badge); tap a photo → alt text ("Describe the photo for people who can't see it"), with "2 of 3 photos described" → "Next". Each photo also has "Edit photo".
4. `[Details]` caption-style screen (each step in Materials and steps can get a photo, which needs a description): cover thumbnail beside the title and story fields; below, tappable rows that open sheets — **Type** (six illustrated choices; Tutorial adds the steps and time rows) · **Skills** (search, 1–5, main one marked; suggested from interests) · **Tags** · **Materials and steps** (optional; required steps for a Tutorial) · **Difficulty and time**. Each row shows its value once set; rows still needed for publishing show a dot. "Preview" link shows the post as others see it.
5. **"Post"** (top right; bottom bar on phones; was "Share" until 2026-10-29). First time: "This is my own work, and I'm happy for dodoi to show it" checkbox (link to terms) → published → short confetti moment and "Posted!" with "Share link" / "See your post" → post page, which shows "Live · showing in feeds" to its maker.
6. ⚠ Something missing → Post is still tappable; the row with the problem is highlighted and its sheet opens (photos without a description → Arrange; the own-work tick scrolls into view). ⚠ Leaving mid-way → the draft stays; `/create` lists drafts under "Pick up where you left off", and the own profile's Posts tab shows them under "Your drafts"; either reopens a draft on Details.
7. Own post page: "Edit post" (in place of "Start as my project" from 768px and "Ask about this" on phones; no Follow on your own creator row) opens Details at `/create/{id}`; changes are live on Save ("Unsaved changes" until then). "Delete post" at the bottom of Details → "Delete this post? Comments, likes and saves go with it." → profile with toast.

### F-18 Creative journal (JRN-01…07, design `1g`) — built 2026-10-29

1. `[Journal]` (sidebar and `/journal`; on phones via the profile's Projects tab) → "In progress" then "Finished" project cards → "New project" → name and, optionally, one of your crafts → the project page `/projects/{id}`.
2. Tutorial page → "Start as my project" (from 768px beside Save; on phones in place of "Ask about this") → private project named after the tutorial, on its main craft, its materials as a checklist ("Started from …") → project page. Signed-out visitors are asked to sign in first.
3. Project page (`1g`, full screen on phones): "Project · in progress" label, title, "{craft} · started {when} · {n} entries" (+ "Only you" while private); materials checklist; entries as a timeline, newest first ("Entry n · today", title, photos, text). "Add progress entry" → sheet: title (optional), what happened, up to 4 photos → added. Each entry: edit / delete.
4. "Post" (needs an entry; design `1g` says "Share", renamed 2026-10-29) → a draft post from the latest entry (Work in progress, or Finished once the project is) opens in Create on Details (F-17 step 4). Project menu ⋯: Rename · Mark as finished / Reopen · Show on my profile / Make private · Delete project ("Posts you shared from it stay").
5. Public projects show on the profile's Projects tab; private ones only to the owner (with a lock).

### F-19 Comment and reply (CMT-01…05)

1. Post page → "Comments (n)" section below related posts on mobile, below steps on desktop → field "Add a comment" → Post → appears at the end.
2. "Reply" under a comment → field under it, starting with @username → reply shown under that comment. Replies on a reply go to the same comment.
3. Own comment menu: Edit (shows "edited"), Delete ("Comment deleted" stays if it has replies). Post author's menu on others' comments: Delete. Everyone else: Report, Block (P2-08; until then no menu).
4. Signed-out visitors see the count and "Sign in to read and join the comments" (OD-29); a signed-in user without a verified email can read and sees "Verify your email to comment." (OD-08). A deleted comment gets no new replies.

### F-20 Like and follow (LIKE-01…03, FLW-01…04)

1. Heart on post detail (built P2-05; the card menu has no heart yet) → filled at once (optimistic); the author sees "{n} likes" on their own post only. Signed-out visitors go to sign-in and return; unverified users get "Verify your email to like posts."
2. Follow on a profile or the creator row on a post → "Following" at once; unfollow from the same button. Private profiles and your own show no Follow button; signed-out visitors go to sign-in; unverified users get "Verify your email to follow people."
3. Feed → "Following" chip (once you follow someone) shows only their posts. Own profile → "{n} followers · {n} following" (owner only) → lists at `/profile/followers` and `/profile/following`; unfollow from the Following list.

### F-21 Notifications (NTF-01…05)

1. Bell (phone header; feed header from 768px) shows a dot when something is new (checked on page open and every 60 s) → `/notifications` → list newest first ("Asha commented on Cherry blossom hoop", "Ravi and 3 others liked …", "Meera followed you") → all marked read.
2. Each item opens the post, comment (scrolled to; replies beyond the first 3 under a comment are not) or profile; likes on one post on one day are one line ("Ravi and 3 others liked …"). `[Settings] → Notifications` → four switches (comments, replies, new followers, likes), saved as you flip them.

### F-22 Report and block (MOD-01…06)

1. Post (⋯ next to the creator row), comment (⋯) or profile (Report button) → Report → reason (Offensive · Spam · Impersonation · Not my work · Other) + optional note → "Thanks for letting us know" (as P1).
2. Menu → Block → "Block @name? You won't see each other's posts, comments or profile, and follows are removed. They won't be told." → Block → back to the previous page with toast; their content disappears.
3. `[Settings] → Blocked accounts` → Unblock (follows and notifications that were removed do not come back). Profile: a Block button beside Report; post: ⋯ → Block @name; comment: ⋯ → Block @name.
4. Moderator: `/admin/reports` (moderators see only Reports; admins assign the role through the API for now) → Hide post / comment / profile / skill, Dismiss, Show again; the author sees "Hidden after a report" on their hidden post or comment (a hidden post is listed with their drafts so they can delete it).

### F-23 Ask the companion (AIC-01…03, AIC-06, approved 2026-10-29)

1. Entry points: **Ask dodoi** (pill on phones and tablet, sidebar card on desktop) → `/companion`; **Ask about this** on a post (phones: sticky bar; tablet/desktop: beside the actions) → new chat "Looking at: {post title}"; skill page → **What is this and how do I start?** → new chat about that skill. Signed-out visitors go to sign-in; unverified users are asked to verify.
2. Chat: field "Ask about a technique…", reply with an **AI** label, "Answers can be wrong", **Helpful / Not helpful**, Report. Skill names the assistant mentions are links. While waiting: a typing indicator. Past chats: list at `/companion` (30 days), reopen, delete.
3. Desktop (≥ 1280): on a post or skill page the companion docks on the right ("Talking about: {title}") and the sidebar becomes the icon rail (`2c`); elsewhere `/companion` is a two-pane page (list | chat). Phones: list → full-screen chat (`1f`).
4. Suggestions ("what should I try next?"): the first time, a notice asks to use interests and levels; Allow / Not now. Answers name real dodoi skills.
5. Limits: at 30 messages a day the field says "You've used today's questions. They reset at {time}."; per-minute limit shows "Slow down a little". AI off or over the global cap: "The companion is resting. Try again later." Blocked by safety filters: "I can't help with that one."

### F-24 Photo troubleshooting (AIC-05, AIC-07, approved 2026-10-29)

1. In the chat field → **Add a photo** (one photo; JPEG, PNG or WebP up to 10 MB) → first time only: consent notice ("Your photo is sent to our AI provider to answer this question. It is kept with this chat for 30 days, and you can delete it any time.") → Allow / Cancel.
2. The photo uploads at once; the message is sent with it; the answer says what can and cannot be seen and how sure it is, and suggests a better photo if needed (design `1f`).
3. Withdraw: Settings → AI and privacy → switch off "Use my photos in the companion" (stops at once; existing chats stay until deleted).

### F-25 Plan a project (AIC-04, approved 2026-10-29)

1. In the chat, **Plan a project** (or the same words typed) → short form: what you want to make (and craft, optional) → plan card: title, craft, materials checklist, steps.
2. **Start as my project** → private journal project with the materials as a checklist → project page (F-18). The plan stays in the chat.

### F-26 AI and privacy settings (AIC-07, AIC-08, approved 2026-10-29)

Settings → **AI and privacy**: two switches (photos; interests and levels), "Your conversations" list with Delete, **Delete all conversations** (confirmation; photos go too), and a note on retention (30 days).

## 2. Post-MVP Flow Outlines (to be detailed before each phase)

| Phase | Flow |
|---|---|
| P3 | Discover/join community → read rules → post discussion |
| P3 | Start conversation → send messages (polling) → block/report |
| P3 | Create help request → receive responses → mark resolved |
| P3 | Propose session → accept/decline/reschedule/cancel with timezone display |
| P4 | Open AI companion from persistent entry point → ask with optional image (consent) → receive guidance → feedback (helpful / not helpful) |
