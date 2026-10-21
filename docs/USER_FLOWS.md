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
   - Email already registered → generic message: "If this email can be used, we've sent instructions." (no account enumeration) — exact UX copy to be confirmed.
   - Under 18 → registration blocked with a friendly message ("dodoi is for adults 18 and over" — exact copy to be confirmed); no data stored.
4. User clicks link in email → `{GET /verify-email?token=…}` → token valid → email marked verified → `[Verified]` → onboarding or feed.
   - ⚠ Expired/used token → `[Link expired]` with "Send a new link".

### F-03 Sign in (AUTH-02, AUTH-03)

1. `[Sign in]`: email + password, or "Continue with Google".
2. Email/password:
   - Success → if onboarding incomplete → F-05, else → `[Home feed]` (or the originally requested URL).
   - Invalid credentials → "Email or password is incorrect." (same message for unknown email).
   - ⚠ Too many attempts → rate-limited message with retry time.
3. Google:
   - Success, new user → display name pre-filled from the Google name (editable later); Google photo not imported → **date of birth step** (blocks under-18; on block the just-created account is deleted) → username auto-generated → F-05.
   - Success, existing Google-linked user → feed.
   - Email already exists as a password account → linked automatically; if that account was never verified its password is removed and other sessions signed out (OD-09).
   - ⚠ User cancels at Google → return to `[Sign in]` with neutral message "Google sign-in was cancelled."
   - ⚠ Provider error → "We couldn't reach Google. Try again or use email."

### F-04 Password recovery (AUTH-05)

1. `[Forgot password]` → enter email → submit.
2. Always show: "If an account exists for this email, we've sent a reset link." (rate-limited)
3. Email link → `[Reset password]` → new password + confirm → success → all other sessions invalidated (PROPOSED) → `[Sign in]`.
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
3. `[Step 2 of 3 · Familiarity]` (optional, skippable) — for each selected interest choose Curious / Beginner / Intermediate / Experienced. Default when skipped: **OPEN** (PROPOSED: no level stored, treated as unknown).
4. `[Step 3 of 3 · Skills you can help with]` (optional, skippable) — pick from selected/other skills; sets `canHelp`.
   - Username is auto-generated at sign-up (e.g. `aanya-4821`); user can change it in Edit profile; prompt "Pick your username" on first visit to own profile.
5. `{Mark onboarding complete}` → `[Home feed]` with interest-weighted content.

⚠ User closes app mid-onboarding → on next sign-in, resume at first incomplete step.
⚠ Network failure on submit → inline error, selections retained, retry.

### F-06 Browse the home feed (FEED-01…12)

1. `[Home feed]` loads first page `{GET /api/feed?filter=for-you}` with skeleton cards. Greeting "What will you make tonight, {first name}?" (source of first name: display name — PROPOSED).
   - Filter chips: For you · user's interests · New to you (FEED-13). Selecting a chip reloads the feed with a new session.
   - A "New to you" skill suggestion card appears as the first item (FEED-14) → "Try it →" opens the skill page.
2. User scrolls → next page via cursor. Accessible "Load more" button also present.
3. Card actions: tap card → F-07 · Save icon → F-09 · overflow menu → "Not interested" (FEED-05) / "More like this" (FEED-06).
4. "Not interested" → card collapses with "Hidden. Undo" for a few seconds → `{POST /api/feed/feedback}`.
5. States:
   - Empty (no matching content) → friendly message + link to Explore.
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

1. Install guidance appears only after meaningful engagement (PROPOSED: after first save or second visit), as a dismissible banner.
2. Chromium browsers: native `beforeinstallprompt` → "Install app".
3. iOS Safari: instructional sheet ("Share → Add to Home Screen").
4. Dismissed → not shown again for a period (PROPOSED: 30 days).
5. Installed app opens to `/feed` (or `/` if signed out).

### F-13 Offline behavior

1. Connection lost → persistent banner "You're offline. Some things won't work until you reconnect."
2. Navigation to a non-cached page → `[Offline fallback]`.
3. Save/unsave while offline → **not queued in Phase 1** (PROPOSED); button disabled with tooltip.
4. Reconnect → banner changes to "Back online", auto-dismiss, retry failed loads.

### F-14 Account deletion (AUTH-08)

1. `[Settings] → Account → Delete account`.
2. Explanation of what is deleted; re-authentication required (password or Google).
3. Confirm → account deactivated, signed out → confirmation "Your account will be deleted on {date}. Sign in before then to cancel." → hard delete after 14 days (OD-22).

### F-15 Admin: manage seed content (ADM-04…06)

1. ADMIN user opens `/admin` (non-admins get 404, not 403, to avoid revealing the route — PROPOSED).
2. `[Admin posts list]` filter by status, skill, source type.
3. Create/edit post: media upload (image/short video), title, description, skills, optional materials/steps/difficulty/time, **required** attribution fields: source type, license, attribution text, original author, original URL.
4. Publish / unpublish. Every action writes an audit log entry.
5. `[Admin themes]` create/edit curated themes and assign posts.

---

## 2. Post-MVP Flow Outlines (to be detailed before each phase)

| Phase | Flow |
|---|---|
| P2 | Create post: media → details → skills/tags → optional materials/steps → preview → publish; edit/delete own post |
| P2 | Creative journal: create project → add progress entries over time → mark complete |
| P2 | Comment, like, follow/unfollow, view notifications |
| P2 | Report content/profile → reason → confirmation; block user → effects explained |
| P3 | Discover/join community → read rules → post discussion |
| P3 | Start conversation → send messages (polling) → block/report |
| P3 | Create help request → receive responses → mark resolved |
| P3 | Propose session → accept/decline/reschedule/cancel with timezone display |
| P4 | Open AI companion from persistent entry point → ask with optional image (consent) → receive guidance → feedback (helpful / not helpful) |
