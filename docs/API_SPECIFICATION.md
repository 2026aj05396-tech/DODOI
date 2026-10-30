# API Specification

REST-style JSON API implemented as Next.js Route Handlers under `/api` (CONFIRMED architecture). This document covers **Phase 1**; later phases are specified before they start.

Markers: **CONFIRMED** / **PROPOSED** / **OPEN**.

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Base path | `/api` (no version prefix in MVP — PROPOSED; add `/api/v1` if external clients appear) |
| Format | JSON request/response, `Content-Type: application/json` |
| Naming | Resource paths plural kebab-case; JSON fields camelCase |
| Auth | Auth.js session cookie (JWT). Unauthenticated requests to protected routes → `401` |
| Validation | Every body/query parsed with a Zod schema from `src/lib/schemas`; failures → `400 VALIDATION_ERROR` |
| IDs | Opaque strings (cuid). Never trusted as authorization |
| Timestamps | ISO 8601 UTC strings |
| Pagination | Cursor-based: `?cursor=<opaque>&limit=<n>`; response `{ items, nextCursor }` (`nextCursor: null` at end). Default limit 20, **max 50** (server-enforced) |
| Idempotency | Save/unsave and feedback are idempotent (PUT/DELETE semantics). Create endpoints guard against double submit on the client; server uniqueness constraints handle races |
| Rate limits | Listed per endpoint; exceeded → `429 RATE_LIMITED` with `Retry-After` header. Exact numbers PROPOSED; store = PostgreSQL (OD-27) |
| Caching | Authenticated responses: `Cache-Control: private, no-store` |

### 1.1 Success response
Single resource: the resource object. Lists: `{ "items": [...], "nextCursor": "..." | null }`. Mutations without content: `204`.

### 1.2 Error response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable, safe to display",
    "fields": { "email": "Enter a valid email address" },
    "requestId": "req_abc123"
  }
}
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid input (`fields` populated) |
| 401 | `UNAUTHENTICATED` | No/expired session |
| 403 | `FORBIDDEN` | Authenticated but not permitted (used only where existence is not secret) |
| 404 | `NOT_FOUND` | Missing **or** not visible to actor (private resources return 404, not 403) |
| 409 | `CONFLICT` | Uniqueness violation (e.g. username taken) |
| 413 | `PAYLOAD_TOO_LARGE` | Upload limits exceeded |
| 422 | `UNPROCESSABLE` | Valid shape but business rule violated (e.g. under 18) |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected; generic message only |

### 1.3 Permission legend
`Public` = no session needed · `User` = signed in · `Owner` = signed in and owns the resource · `Admin` = role ADMIN.

> **Signed-out access (CONFIRMED, OD-29):** only `GET /api/posts/{postId}` and `GET /api/posts/{postId}/related` are `Public` (read-only, non-personalised: `isSaved` is always `false`). Every other endpoint marked `User*` below requires a signed-in user (`User`).

---

## 2. Shared Types

```ts
type ExperienceLevel = "CURIOUS" | "BEGINNER" | "INTERMEDIATE" | "EXPERIENCED";

type SkillSummary = { id: string; name: string; slug: string; accent: "BUTTER" | "BLUSH" | "LAVENDER" | "MINT" | "SKY" | "CORAL"; origin: "PREDEFINED" | "CUSTOM" };

type Media = {
  id: string; type: "IMAGE" | "VIDEO";
  url: string;            // base delivery URL; client requests variants via helper
  width: number; height: number;
  altText: string | null;
  posterUrl?: string;     // video
  durationSec?: number;   // video
};

type Attribution = {
  sourceType: "TEAM_ORIGINAL" | "INVITED_CREATOR" | "STOCK_LICENSED" | "CREATIVE_COMMONS";
  license: string; attributionText: string;
  originalAuthor: string | null; originalUrl: string | null;
};

type CreatorSummary = { username: string; displayName: string; avatarUrl: string | null };

type PostCard = {
  id: string; type: string; title: string;
  estimatedMinutes: number | null; // card label "Tutorial · 20 min" (P1-20)
  coverMedia: Media; mediaCount: number;
  skills: SkillSummary[]; primarySkillId: string;
  creator: CreatorSummary | null; attribution: Attribution | null;
  isSaved: boolean;
};

type PostDetail = PostCard & {
  description: string | null;
  media: Media[];
  difficulty: ExperienceLevel | null;
  materials: { id: string; name: string; note: string | null }[]; // id: for tutorial progress (P1-20b)
  steps: { position: number; text: string; media: Media | null }[];
  publishedAt: string;
};
```

Like counts do not exist in Phase 1 (reactions are P2; counts will be owner-only — CONFIRMED).

---

## 3. Auth and Account

Auth.js handles `GET/POST /api/auth/*` (sign-in, callback, sign-out, session). Custom endpoints:

### POST /api/account/register — Public
Rate limit: 5 / hour / IP (PROPOSED).
```json
// request
{ "email": "a@b.com", "password": "…", "dateOfBirth": "1998-04-17" }   // used for the 18+ check only, never stored
```
- `201` `{ "status": "verification_sent" }` — account created and verification email sent.
- `400` invalid input · `409 EMAIL_ALREADY_REGISTERED` (has a password) or `409 EMAIL_REGISTERED_WITH_GOOGLE` (no password), message on field `email` (PO decision, SECURITY §2.5) · `422 UNDER_MINIMUM_AGE` · `429`.

### POST /api/account/age — User
For Google sign-ups that have not passed the age check: `{ "dateOfBirth": "YYYY-MM-DD" }` → `204` (sets `ageConfirmedAt`) · `422 UNDER_MINIMUM_AGE` (account and session deleted). Until this succeeds, all other `/api/*` calls return `403 AGE_CHECK_REQUIRED`.

### POST /api/account/verify-email — Public
`{ "token": "…" }` → `204` · `400 TOKEN_INVALID_OR_EXPIRED`.

### POST /api/account/verify-email/resend — User
Rate limit: 3 / hour / user. → `204` (also when already verified) · `503 EMAIL_NOT_SENT` when the email provider refuses the message.

### POST /api/account/password-reset/request — Public
`{ "email": "…" }` → always `204`. Rate limit: 5 / hour / IP and 3 / hour / email.

### POST /api/account/password-reset/confirm — Public
`{ "token": "…", "newPassword": "…" }` → `204`; increments `sessionVersion` (signs out other sessions) · `400 TOKEN_INVALID_OR_EXPIRED`.

### POST /api/account/password — User
`{ "currentPassword": "…", "newPassword": "…" }` → `204` (other sessions signed out; this one receives a fresh session cookie) · `400 INVALID_CURRENT_PASSWORD` (field `currentPassword`) · `429` (5 / 15 min / user, PROPOSED). Google-only accounts (no password): `400 NO_PASSWORD_SET` — they sign in with Google; setting a password is via the reset flow.

### GET /api/account — User
`{ "email", "emailVerified": bool, "hasPassword": bool, "providers": ["google"], "role", "onboardingCompleted": bool }`

### DELETE /api/account — User
Body `{ "password"?: string }`. Accounts with a password must send it (`400 INVALID_PASSWORD`, 5 tries / 15 min); Google-only accounts must have signed in within the last 5 minutes (`403 REAUTHENTICATION_REQUIRED`; the client signs in with Google again with `prompt=login`). Admins → `403 ADMIN_ACCOUNT`. Deactivates immediately, signs out every session and schedules hard delete in 14 days (OD-22) → `202 { "deletionScheduledFor": "…" }`.

While an account is deactivated, every other `/api/*` call answers `403 ACCOUNT_DELETION_SCHEDULED`.

### POST /api/account/deletion/cancel — User
Reactivates a deactivated account → `204` (also when none was scheduled). Allowed until the daily job has deleted the account.

---

## 4. Onboarding, Skills and Profiles

### GET /api/skills — User
Query: `q` (optional, ≥1 char), `origin`, `cursor`, `limit`. Returns `SkillSummary[]` (ACTIVE only). Used by the onboarding picker and search suggestions.

### POST /api/skills — User
Create or resolve a custom interest. Rate limit: 10 / day / user (PROPOSED).
```json
{ "name": "Pipe cleaner animals" }
```
- Normalizes name; if `normalizedName` exists → `200` existing skill; else `201` new CUSTOM skill.
- Validation (OD-13): 2–40 chars, Unicode letters/digits/space/`-`/`'`/`&`, blocklist → `400 SKILL_NAME_NOT_ALLOWED`. Requires verified email → `403 EMAIL_NOT_VERIFIED`.

### GET /api/skills/{slug} — User*
Skill detail: `{ ...SkillSummary, description, coverMedia, relatedSkills: SkillSummary[] }`. Hidden skill → 404. `SkillSummary` carries the editor's `hint` (string | null, SRCH-08; added P1-26).

### GET /api/skills/{slug}/posts — User*
Paginated `PostCard[]`, published posts newest first (CONFIRMED, P1-15). Hidden skill → 404.

### PUT / DELETE /api/me/interests/{skillId} — User
One interest on or off (skill page, P1-26) → `204` (idempotent). Adding: `400 SKILL_NOT_AVAILABLE` (hidden/unknown) · `422 TOO_MANY_SKILLS` (50). Removing keeps at least 3 interests → `422 NOT_ENOUGH_INTERESTS`. A skill's can-help / want-to-learn flags are kept.

### GET /api/me/skills — User
`{ items: [{ skill: SkillSummary, isInterest, canHelp, wantsToLearn, level }] }`

### PUT /api/me/skills — User
Replace the full set (used by onboarding and settings).
```json
{ "items": [{ "skillId": "…", "isInterest": true, "canHelp": false, "wantsToLearn": false, "level": "BEGINNER" }] }
```
Rules: skill must exist and be ACTIVE (else `400 SKILL_NOT_AVAILABLE`, field `items.{n}.skillId`); no duplicate skillIds; rows with all flags false are dropped; at most **50** items (CONFIRMED, P1-10); `level` null = not specified. → `200` new set. Skills hidden later are left out of `GET`.

### GET /api/me/onboarding — User
`{ "step": 1, "completed": false, "interestCount": 0 }` — `step` is where to resume (1 interests, 2 familiarity, 3 can-help-with).

### PUT /api/me/onboarding — User
`{ "step": 2 }` → `200` new state · `422 NOT_ENOUGH_INTERESTS` for step 2 or 3 with fewer than 3 interests.

### POST /api/me/onboarding/complete — User
Marks onboarding complete. Precondition: at least 3 active interests (OD-14), else `422 NOT_ENOUGH_INTERESTS`. → `204` (idempotent; the first completion time is kept).

### GET /api/me/profile — User
Own full profile: `{ username, displayName, bio, avatar: Media|null, visibility, usernameChangeAvailableAt: string|null, showUsernamePrompt, email, hasPassword }` (`usernameChangeAvailableAt` = when the username may change again, null = now; `showUsernamePrompt` until dismissed or the username is changed, DC-26; `email` and `hasPassword` for Account settings, own profile only).

### PATCH /api/me/profile — User
```json
{ "username": "…", "displayName": "…", "bio": "…", "avatarMediaId": "…|null", "visibility": "PUBLIC|PRIVATE", "dismissUsernamePrompt": true }
```
`409 USERNAME_TAKEN` · `400` invalid/reserved username · `422 USERNAME_CHANGE_TOO_SOON` (within 30 days of last change; sending the current username is not a change) · `avatarMediaId` must be the actor's own uploaded avatar (IMAGE in `avatars/`), else `400` on the field · usernames and display names with offensive words → `400` (OD-36 list, PO decision P1-13) · display name 1–50, bio ≤ 300 (empty clears it). Unverified users may edit everything (PO decision).

### GET /api/profiles/{username} — User*
Public profile: `{ username, displayName, bio, avatarUrl, skills: { interests[], canHelp[], wantsToLearn[] } (with levels), publicCollections: CollectionSummary[] }`.
Full view also has `isPrivate: false`, `isOwner`, `visibility`, `follow` and (owner only) `followCounts`; skills are active skills only; `publicCollections` are most recently changed first. Private profile (OD-10) → `{ username, displayName, avatarUrl, isPrivate: true }` only (the owner always gets the full view). Unknown, deactivated or hidden-after-report profiles → `404` (owners still see their own). **Never** includes email, DOB, role, internal IDs beyond what is needed.

---

## 5. Feed, Posts, Themes, Search

### GET /api/feed — User
Query: `filter` (`for-you` default · `following` (P2-06) · `skill:<slug>` (must be one of the actor's interests) · `new-to-you`), `cursor`, `limit`. A call without cursor creates a feed session bound to that filter; changing filter = new session.
Response: `{ items: FeedItem[], nextCursor }`. Cursor encodes feed session; no post repeats within a session (FEED-09).

```ts
type FeedItem =
  | { kind: "post"; post: PostCard }
  | { kind: "skill_suggestion"; skill: SkillSummary; pitch: string; beginnerProjectCount: number; coverMedia: Media | null };
```
`skill_suggestion` placement per FEED-14 (CONFIRMED: first item on page 1 of a `for-you` session only; never a skill already in the actor's interests). Errors: `400 INVALID_FILTER` (skill chip not among the interests), `400 FEED_SESSION_EXPIRED` (cursor of an expired or another user's session — start again without a cursor).

### GET /api/feed/filters — User
Chips for the filter bar (up to 5 interests, most recently added first): `{ items: [{ key: "for-you", label: "For you" }, { key: "skill:crochet", label: "Crochet" }, …, { key: "new-to-you", label: "New to you" }] }`.

### GET /api/feed/suggestion — User
Single `skill_suggestion` for the desktop right rail (`2b`), or `204` if none.

### POST /api/feed/feedback — User
`{ "postId": "…", "type": "NOT_INTERESTED" }` → `204` (idempotent; `404` for unpublished posts). The post never appears in the feed again and its skills weigh −2 for 30 days.
### DELETE /api/feed/feedback — User
Undo: same body → `204`.

### GET /api/posts/{postId} — User*
`PostDetail`, plus `isOwn` (the viewer wrote it themselves: Edit instead of Follow, P2-02). DRAFT/UNPUBLISHED → 404 for non-admins, except the post's own author (Preview, CRT-09).

### GET /api/posts/{postId}/progress — User
`{ "checkedMaterialIds": string[], "completedStepPositions": number[], "updatedAt": string | null }` (empty defaults if none).

### PUT /api/posts/{postId}/progress — User
`{ "checkedMaterialIds"?: string[], "completedStepPositions"?: number[] }` — partial replace, idempotent. Ids must belong to the post; positions must exist in the post (`400` with field errors). → `200` new progress. Signed out → `401`; draft/unpublished → `404` (admins excepted). No rate limit defined (SECURITY §6); the web client sends one request at a time. (POST-11/12, P1-20b)

### GET /api/posts/{postId}/related — User*
`{ items: PostCard[] }` — up to 12 published posts sharing skills, ordered by most shared skills, then same primary skill, then newest (CONFIRMED, P1-15). No pagination.

### GET /api/themes — User*
Published themes in curated order: `{ items: [{ id, slug, title, description, coverMedia }] }`.
### GET /api/themes/{slug} — User*
`{ theme, posts: { items: PostCard[], nextCursor } }` — published posts in the theme's curated order (`?cursor`, `?limit`). Unpublished theme → 404.

### GET /api/explore — User*
```json
{
  "popularSkills": [SkillSummary],
  "newSkills": [SkillSummary],
  "skillsToTry": [{ "skill": SkillSummary, "hint": "Pairs with drawing" }],
  "themes": [ThemeSummary],
  "beginnerFriendly": [PostCard]
}
```
CONFIRMED (PO, P1-23): "popular" = most saves of the skill's posts in the last 30 days, topped up with the skills that have the most published posts (never empty), 8; "new" = most recently created ACTIVE skills, 8; "skills to try" = ACTIVE skills with an editor's hint outside the actor's interests, related to an interest first, 8; themes = all published, curated order, each with `postCount`; "beginner-friendly" = the 12 newest published Curious/Beginner posts.

### GET /api/search — User*
Query: `q` (required, 1–100 chars, trimmed), `type` = `all|posts|skills|creators` (default `all`), `cursor`, `limit`. Rate limit: 60 / minute / user (SECURITY §6, `429`). Matching (P1-23): posts by every word as a prefix over title, description and skill names (`simple` FTS) or a similar title (pg_trgm); skills as `GET /api/skills?q=` (prefix + trigram, custom skills included); makers by username or a word of the display name starting with the term, or a similar one.
- `type=all`: `{ posts: PostCard[] (≤ 8), skills: SkillSummary[] (≤ 8), creators: CreatorSummary[] (≤ 8) }` — no pagination.
- Specific type: `{ items, nextCursor }`.
- Private and hidden profiles excluded from creator results (OD-10).

---

## 6. Saves and Collections

### PUT /api/saves/{postId} — User
Save (idempotent). → `200 { "saved": true, "saveId": "…" }`. Post must be PUBLISHED.
### DELETE /api/saves/{postId} — User
Unsave (idempotent); removes from all collections. → `204`.
### GET /api/saves — User
Paginated `PostCard[]` most recently saved first ("All saved"); unpublished posts are left out.

### GET /api/collections — User
Own collections, most recently changed (renamed, added to or removed from) first (PO decision, P1-24): `{ items: [{ id, name, visibility, itemCount, coverMedia: Media|null, previewMedia: Media[] }] }` (`previewMedia`: covers of the 3 newest posts, for the mosaic tile, P1-25). `itemCount` counts published posts; `coverMedia` is the cover of the most recently added one.
### POST /api/collections — User
`{ "name": "Crochet ideas to try", "visibility": "PRIVATE" }` (visibility optional, defaults PRIVATE) → `201` collection. `409 COLLECTION_NAME_TAKEN` (case- and space-insensitive) · `422 COLLECTION_LIMIT_REACHED` (100) · `403 EMAIL_NOT_VERIFIED` for `PUBLIC` (OD-08).
### GET /api/collections/{id} — Owner, or User* if PUBLIC
`{ collection: { …summary, isOwner, owner: { username, displayName } | null }, items: PostCard[], nextCursor }`, posts most recently added first. Private and not owner → **404**; public but the owner's profile is private, hidden or deactivated (OD-10) → **404**.
### PATCH /api/collections/{id} — Owner
`{ "name"?, "visibility"? }` → `200` collection summary (same errors as create).
### DELETE /api/collections/{id} — Owner
Deletes collection only; saves remain (CONFIRMED). → `204`.
### PUT /api/collections/{id}/items/{postId} — Owner
Adds post to collection (idempotent). If the post is not yet saved, it is saved first (CONFIRMED, P1-24). → `204`. `404` for unpublished posts · `422 COLLECTION_FULL` (1,000).
### DELETE /api/collections/{id}/items/{postId} — Owner
Removes from this collection only; save remains. → `204`.
### GET /api/posts/{postId}/collections — User
`{ ids }` of the actor's collections containing the post (for the picker).

---

## 6b. Reports (Phase 1: skills and profiles)

### POST /api/reports — User (verified email)
`{ "targetType": "SKILL" | "PROFILE", "targetId": "…", "reason": "OFFENSIVE" | "SPAM" | "IMPERSONATION" | "OTHER", "note"?: "…" }` → `201` (also `201` if an open report by the same user already exists — idempotent). `targetId` is the skill id, or the **username** for a profile (public responses never expose user ids; the report stores the user id). Only custom skills (`400 NOT_REPORTABLE`); unverified → `403 EMAIL_NOT_VERIFIED`; yourself → `422 SELF_REPORT`. Rate limit 10 / day / user (`429`).

**P2-08 (built 2026-10-29):** `targetType` also accepts `POST` (`targetId` = post id) and `COMMENT` (comment id); `reason` also `NOT_MY_WORK`. Only posts and comments the reporter can see (published, not hidden, not by someone blocked either way) → else `404`; your own → `422 SELF_REPORT`. `GET /api/admin/reports` and `POST /api/admin/reports/{id}/action` are open to **Moderators and Admins** (everyone else `404`); `HIDE_TARGET` / `RESTORE_TARGET` set `hiddenAt` on posts and comments (audited as `report.hide_target` / `report.restore_target` with `targetType` `post` / `comment`). Report groups for posts and comments show the title / the first 140 characters, link to `/p/{id}` (comments with `#comment-{id}`), and say "Post" / "Comment".

### GET /api/admin/reports?status=OPEN|RESOLVED&cursor= — Moderator or Admin
One row per reported target (PO decision, P1-28b): `{ reportId, targetType, target: { label, href, detail, isHidden }, reportCount, reasons: { REASON: n }, notes: [{ reason, note, createdAt }], latestAt, status }`, newest report first. Reporters are never included (RPT-05).

### POST /api/admin/reports/{id}/action — Admin
`{ "action": "HIDE_TARGET" | "DISMISS" | "RESTORE_TARGET" }` for the report's target: hide it and resolve all its open reports as ACTIONED; resolve them as DISMISSED; or show a hidden target again (Resolved tab). Audited as `report.hide_target` / `report.dismiss` / `report.restore_target`. → `204`.

## 7. Media

### POST /api/media/sign — Admin (Phase 1); User from P2
```json
{ "purpose": "post" | "cover" | "avatar" | "entry", "type": "IMAGE" | "VIDEO", "bytes": 123456, "mimeType": "image/jpeg" }
```
Validates against MEDIA-01…03 (`413 PAYLOAD_TOO_LARGE`, `400 UNSUPPORTED_MEDIA_TYPE`; videos only for `post`; `entry` = journal photos, post-image limits). Returns `{ "uploadUrl", "signature", "timestamp", "apiKey", "folder", "resourceType", "allowedFormats" }` for a direct Cloudinary upload; the browser sends `folder`, `allowed_formats`, `timestamp`, `api_key` and `signature` exactly as returned. Folder: `dodoi/<APP_ENV>/{posts|covers|avatars|entries}`. Rate limit: 30 / hour / user. Signed-in users may use `avatar`, `post` and `entry` (P2-01); `cover` is admin-only; anything else (and signed-out callers) → `404`.

### POST /api/media — same callers as `/api/media/sign`
`{ "purpose": "post", "type": "IMAGE", "publicId": "…", "altText": "…" }` → server fetches asset metadata from Cloudinary, re-validates type/size/duration, creates `MediaAsset` → `201 Media`. Mismatch → deletes the Cloudinary asset and returns `400 UNSUPPORTED_MEDIA_TYPE` / `400 MEDIA_REJECTED` / `413`. `publicId` outside the purpose's folder or unknown → `400 MEDIA_NOT_FOUND`; already saved → `409 MEDIA_ALREADY_REGISTERED`. Alt text is optional here (it can be added after upload with `PATCH /api/media/{id}`); publishing a post requires it on every image.

### PATCH /api/media/{id} — Owner/Admin
`{ "altText": "…" }`.

Avatar uploads for regular users (P1-12): any signed-in user may sign and register uploads for `purpose: "avatar"` (IMAGE, MEDIA-02, folder `avatars/`, the same 30/hour limit) — CONFIRMED 2026-10-27. From P2-01 also `post` and `entry`; `PATCH /api/media/{id}` is allowed to the uploader or an admin (others `404`).

---

## 8. Admin (Phase 1) — all `Admin`, non-admins receive 404

| Method & path | Purpose |
|---|---|
| `GET /api/admin/posts?status=&skillId=&sourceType=&cursor=` | List posts |
| `POST /api/admin/posts` | Create post (DRAFT) |
| `GET /api/admin/posts/{id}` | Full post incl. attribution |
| `PATCH /api/admin/posts/{id}` | Update fields, skills, media order, steps, materials, attribution |
| `POST /api/admin/posts/{id}/publish` | Publish (validates attribution + alt text present) |
| `POST /api/admin/posts/{id}/unpublish` | Unpublish |
| `DELETE /api/admin/posts/{id}` | Delete post (media assets deleted if unused) |
| `GET/POST/PATCH/DELETE /api/admin/themes[/{id}]` | Manage themes and their posts |
| `GET /api/admin/skills` | Every skill, hidden ones included: `{ items: [{ id, name, slug, origin, status }] }` |
| `GET /api/admin/skills/{id}` | Skill with editorial fields and `relatedSkillIds` |
| `PATCH /api/admin/skills/{id}` | Edit description/hint/pitch/cover/status (any skill can be hidden) |
| `PUT /api/admin/skills/{id}/related` | Set related skills |
| `GET /api/admin/reports?status=OPEN\|RESOLVED&cursor=` | Reports grouped by target (§6b) |
| `POST /api/admin/reports/{id}/action` | `{ "action": "HIDE_TARGET" \| "DISMISS" \| "RESTORE_TARGET" }` — for all open reports on the target; audited (§6b) |

Admin post create/update body:
```json
{
  "type": "TUTORIAL",
  "title": "Pipe cleaner bumblebee",
  "description": "…",
  "skillIds": ["…"], "primarySkillId": "…",
  "mediaIds": ["…"],
  "difficulty": "BEGINNER", "estimatedMinutes": 30,
  "materials": [{ "name": "Yellow pipe cleaners", "note": "2 pieces" }],
  "steps": [{ "text": "Twist…", "mediaId": null }],
  "attribution": {
    "sourceType": "TEAM_ORIGINAL", "license": "Owned",
    "attributionText": "Made by the team", "originalAuthor": null, "originalUrl": null, "permissionRef": null
  },
  "authorUsername": null
}
```
Every mutation writes an `AuditLog` entry in the same transaction (`post.create`, `post.update`, `post.publish`, `post.unpublish`, `post.delete`, `theme.*`, `skill.update`, `skill.hide`, `skill.show`, `skill.set_related`). Seed imports write `post.seed_import` (no actor; metadata `seedKey`, `created`, `status`).

Rules (P1-16, PO decisions): a post holds up to **10** media, images and videos mixed (`mediaIds` order = gallery order). Lists in `PATCH` (skills, media, steps, materials) replace the whole list. **Publish** (`400 POST_NOT_PUBLISHABLE`, field errors) requires: at least one skill with an active primary skill, at least one photo or video, alt text on every image (post and steps), and attribution — Creative Commons only `CC BY`/`CC BY-SA` with original author and source link; stock with a source link; invited creator with `authorUsername` (a real account) and `permissionRef`; other source types have no author. A **published** post can be edited, but the change is rejected (nothing saved) if the post would no longer meet these rules. Re-publishing keeps the first `publishedAt`. `GET /api/admin/posts` is ordered by last change, newest first. Themes: `{ slug, title, description, coverMediaId, isPublished, position, postIds }` (`postIds` in display order; `409 SLUG_TAKEN`). Skills: `PATCH { description, hint, pitch, coverMediaId, status: "ACTIVE" | "HIDDEN" }` — any skill, predefined included, can be hidden; `PUT …/related { skillIds }` stores pairs in both directions.

**Seed file format** (`<seed folder>/posts/<seedKey>.json`, P1-18, PO decisions 2026-10-26) = the admin body above with these differences: `seedKey` (lowercase letters, numbers and dashes; must equal the file name), `publish` (default `false`), skills by **slug** (`skills`, `primarySkill`) because ids differ per environment, local `mediaFiles: [{ "path", "altText" }]` (1–10, paths relative to the seed folder) instead of `mediaIds`, steps take an optional `mediaFile` instead of `mediaId`, and `attribution` is required. Unknown keys are rejected.
```json
{
  "seedKey": "granny-square",
  "publish": true,
  "type": "TUTORIAL",
  "title": "Your first granny square",
  "description": "Four rounds, one colour.",
  "skills": ["crochet"], "primarySkill": "crochet",
  "mediaFiles": [{ "path": "media/granny-square.jpg", "altText": "A finished granny square" }],
  "difficulty": "BEGINNER", "estimatedMinutes": 45,
  "materials": [{ "name": "Cotton yarn", "note": "Worsted weight" }],
  "steps": [{ "text": "Make a magic ring." }, { "text": "Work round 1.", "mediaFile": { "path": "media/round-1.jpg", "altText": "Round 1" } }],
  "attribution": { "sourceType": "CREATIVE_COMMONS", "license": "CC BY 4.0", "attributionText": "Photo by Asha on Wikimedia Commons", "originalAuthor": "Asha", "originalUrl": "https://commons.wikimedia.org/wiki/File:Granny_square.jpg" },
  "authorUsername": null
}
```
Import rules: each file is fully checked (shape, skill slugs, creator account, attribution and licence rules — on every import, draft or not — and each file's type and size against MEDIA-01/03) before anything is uploaded or saved. The file is the source of truth: re-running updates the post to match it (edits made in `/admin` to seeded posts are overwritten). `publish: true` publishes (the publish rules must pass, else nothing is saved); `publish: false` keeps a draft, or unpublishes a published post. Media public ids are `dodoi/<APP_ENV>/posts/seed-<seedKey>-<sha256 prefix>`, so unchanged files are never uploaded twice; media the post no longer uses are deleted.

**Coverage (P1-19, OD-31).** Every run ends with a report of the valid files that publish against the launch minimums (skills and post types; failed files are not counted). The admin page `/admin/coverage` shows the same from **published posts in the database**, plus published themes; it is a server-rendered page calling `getSeedCoverage(actor)` (admin only, 404 otherwise), with no API route. A post counts toward every skill it is tagged with; only active predefined skills and published themes are checked.

---

## 9. Later Phases (to be specified)

P2: specified in §9.1 below. P3: communities, conversations/messages (polling: `GET /api/conversations/{id}/messages?after=<cursor>`), help requests, sessions. P4: AI endpoints (see AI_INTEGRATION.md).

### 9.1 Phase 2 endpoints (CONFIRMED — P2-00 approved 2026-10-28)

Requirements: PRODUCT_REQUIREMENTS §6.1 · schema: DATABASE_SCHEMA §9.1. `Verified` = signed in with a verified email (otherwise `403 EMAIL_NOT_VERIFIED`, as for custom skills). `Moderator` = role MODERATOR or ADMIN. Every read that returns another user's content excludes users blocked either way (404 for direct links). All conventions in §1 apply.

**Media (P2-01)** — `POST /api/media/sign` and `POST /api/media` open to `User` for `purpose: "post"` (images + video) and `"entry"` (images, journal); folders `dodoi/<APP_ENV>/{posts|entries}`; same MEDIA limits and 30 / hour. Users can only attach media they own.

**Own posts (P2-02, built)** — the admin post body (§8) without `attribution` and `authorUsername`, plus `tags: string[]` (≤ 10), with the user limits: ≤ 5 skills, description ≤ 2,000, ≤ 30 materials and ≤ 30 steps (≤ 1,000 chars). Media must be the caller's own uploads and skills active (`400` field errors). Response `OwnPost` (`src/lib/types/posts.ts`): the editable post with `tags` and `ownWorkConfirmed`. `GET /api/posts/{postId}` also returns the author's own draft to them (CRT-09 Preview).

| Method & path | Who | Purpose |
|---|---|---|
| `GET /api/me/posts?status=DRAFT\|PUBLISHED&cursor=` | User | Own posts and drafts |
| `POST /api/me/posts` | User | Create draft → `201` (only `type` needed; defaults `FIRST_ATTEMPT`, title "Untitled"); 50 drafts max → `422 DRAFT_LIMIT` |
| `GET /api/me/posts/{id}` | Owner | Full editable post |
| `PATCH /api/me/posts/{id}` | Owner | Update fields, media order, skills, tags, steps, materials (published posts change live) |
| `POST /api/me/posts/{id}/publish` | Owner, Verified | `{ "ownWorkConfirmed": true }` required the first time (empty body later); rules CRT-02/03/05/08 → `400 POST_NOT_PUBLISHABLE` with `fields` (as the admin editor); 20 / day → `429`; already published → `200`, no change |
| `DELETE /api/me/posts/{id}` | Owner | Delete post and its media → `204` |
| `GET /api/profiles/{username}/posts?cursor=` | User* | Published posts on a profile (Posts tab) |

**Journal (P2-03, built 2026-10-29)** — module `journal`; `Project` = summary + `isOwner`, `owner`, `sourcePost`, `materials`, `entries` (all of them, newest first, ≤ 200, each with `number`, `title`, `body`, `media`, `createdAt`), `completedAt` (`src/lib/types/journal.ts`).

| Method & path | Who | Purpose |
|---|---|---|
| `GET /api/me/projects?status=` / `POST /api/me/projects` | User | List (`{ items }`, in progress first, ≤ 100 so no cursor) / create `{ title, skillId?, visibility? }` → `201 Project`; `422 PROJECT_LIMIT` at 100; `PUBLIC` needs a verified email (`403 EMAIL_NOT_VERIFIED`) |
| `POST /api/posts/{postId}/start-project` | User | "Start as my project" from a published tutorial → `201 Project` (JRN-03); not a tutorial → `422 NOT_A_TUTORIAL` |
| `GET /api/projects/{id}` | Owner, or User* if PUBLIC | The project; private or a hidden owner's → `404` |
| `PATCH /api/projects/{id}` / `DELETE` | Owner | Title, skill, status (`COMPLETED` sets `completedAt`, `IN_PROGRESS` clears it), visibility; delete removes entries and their photos used nowhere else (shared posts stay) |
| `POST /api/projects/{id}/entries` | Owner | `{ title?, body?, mediaIds[] (≤ 4, own uploads) }`, at least one → `201 Project`; `422 ENTRY_LIMIT` at 200 |
| `PATCH` / `DELETE /api/projects/{id}/entries/{entryId}` | Owner | Edit (→ `200 Project`; dropped photos deleted) / delete (`204`) |
| `PUT /api/projects/{id}/materials/{materialId}` | Owner | `{ checked }` → `204` |
| `GET /api/profiles/{username}/projects` | User* | `{ items }`: public projects; the owner sees all of theirs; private profile → none |

Share (JRN-05): the client creates the draft with `POST /api/me/posts` and `projectId` (checked as the caller's by the route; `Post.projectId`), then opens it in Create.

**Comments (P2-04, OD-25)**

| Method & path | Who | Purpose |
|---|---|---|
| `GET /api/posts/{postId}/comments?cursor=` | User* | Top-level comments, oldest first, each with `replyCount` and its first 3 replies |
| `GET /api/comments/{id}/replies?cursor=` | User* | More replies |
| `POST /api/posts/{postId}/comments` | Verified | `{ body, parentId? }`; a reply to a reply is attached to its parent; 30 / hour → `201 Comment` |
| `PATCH /api/comments/{id}` | Owner | `{ body }` → sets `editedAt` |
| `DELETE /api/comments/{id}` | Owner, or the post's author | Soft or hard delete (CMT-02/03) → `204` |

Built P2-04 (2026-10-29): all five routes need a signed-in user; reading and writing apply to **published posts only** (others → `404`). A `Comment` is `{ id, postId, parentId, body (null when deleted), isDeleted, author ({ username, displayName, avatarUrl } or null), createdAt, editedAt, isOwn, canDelete, replyCount, replies }`; lists are `{ items, nextCursor }`, 20 per page, oldest first. `GET …/replies` without a cursor starts from the first reply. Errors: `403 EMAIL_NOT_VERIFIED` (POST), `404` for a post that is not published, a comment that is not the caller's to edit or delete, or a `parentId` on another post; `422` replying to a deleted comment; `429` at 30 an hour. Deleting a reply also removes its parent when the parent is "Comment deleted" and this was its last reply. The public count is shown on the post page (comments and replies still shown), not an API field.

**Likes, follows, blocks (P2-05, P2-06, P2-08)** — idempotent PUT/DELETE, `204`.

| Method & path | Who | Purpose |
|---|---|---|
| `PUT` / `DELETE /api/posts/{postId}/like` | Verified | Like / unlike. Post detail and cards gain `isLiked`; `likeCount` only when the actor is the author. **Built P2-05:** `204`; unlike needs only a signed-in user; `404` for a post that is not published; `403 EMAIL_NOT_VERIFIED`; `429` at 200 an hour. `isLiked` and `likeCount` reach the post page from the server (not an API field); cards have no `isLiked` yet |
| `PUT` / `DELETE /api/follows/{username}` | Verified | Follow / unfollow; private, own or blocked profile → `404`. **Built P2-06:** `204`, idempotent; unfollow needs only a signed-in user and works even if the profile went private since; `403 EMAIL_NOT_VERIFIED`; `429` at 200 an hour (follows and unfollows together) |
| `GET /api/me/followers?cursor=` / `GET /api/me/following?cursor=` | User | Owner-only lists (FLW-03); profile view gains `follow: { canFollow, isFollowing }` and, for the owner only, `followCounts: { followers, following }` (built P2-06). Lists are `{ items: [{ username, displayName, avatarUrl }], nextCursor }`, newest first, 20 per page; profiles that are hidden or deactivated are left out |
| `PUT` / `DELETE /api/blocks/{username}` | User | Block / unblock (MOD-02). **Built P2-08:** `204`, idempotent; `422 SELF_BLOCK`; `404` unknown username; blocking removes follows and notifications between the two; nobody is told |
| `GET /api/me/blocks?cursor=` | User | Block list: `{ items: [{ username, displayName }], nextCursor }`, newest first (hidden profiles stay listed so they can be unblocked). `PATCH /api/admin/users/{id}/role` `{ role: "USER" \| "MODERATOR" }` → `204`, Admin only, audited (`user.make_moderator` / `user.remove_moderator`); `422 ADMIN_ROLE_LOCKED` for an admin; no screen yet |

**Notifications (P2-07)**

| Method & path | Who | Purpose |
|---|---|---|
| `GET /api/notifications?cursor=` | User | Newest first; likes grouped per post per day |
| `GET /api/notifications/unread` | User | `{ "hasUnread": boolean }` — polled every 60 s while visible |
| `POST /api/notifications/read` | User | Mark all read → `204` |
| `GET` / `PUT /api/me/notification-preferences` | User | `{ COMMENT: true, REPLY: true, FOLLOW: true, LIKE: true }` |

Built P2-07 (2026-10-29): an item is `{ id, type, actors: [{ username, displayName, avatarUrl }] (up to 2, newest first), actorCount, post: { id, title } | null, commentId, isUnread, createdAt }`; the list reads 50 notifications at a time and groups likes on one post on one day within them, so a day's likes can split across two pages. Items about a post that is no longer published are left out. `PUT` takes any of the four booleans and answers `200` with all four. Comments (COMMENT to the post's author, REPLY to the comment replied to), likes and follows record a notification after they succeed; a failure to record one is logged and never fails the action.

**Safety (P2-08)** — `POST /api/reports` accepts `targetType: "POST" | "COMMENT"` and `reason: "NOT_MY_WORK"`. `/api/admin/reports*` opens to `Moderator` (other `/api/admin/*` stays Admin); `HIDE_TARGET` sets `hiddenAt` on posts and comments. `PATCH /api/admin/users/{id}/role` `{ role: "USER" | "MODERATOR" }` — Admin, audited.

**Feed (P2-06)** — `GET /api/feed?filter=following` (FLW-04); `/api/feed/filters` lists "Following" once the user follows someone.

### 9.2 Phase 4 endpoints (CONFIRMED — P4-00 approved 2026-10-29)

All need a signed-in, verified user unless noted; all answer `503 AI_UNAVAILABLE` when `AI_ENABLED` is off, the global cap is reached, the provider fails, or the tier rule is not met (free tier outside local). No provider detail is ever in a response.

| Method & path | Purpose |
|---|---|
| `POST /api/ai/messages` (**built P4-01**) | `{ conversationId?, text (1–1,000), context?: { type: "POST" \| "SKILL", id }, imageMediaId? }` → `201 { conversation, userMessage, assistantMessage }`. Without `conversationId` a new conversation starts (the context is fixed for its life). `403 AI_CONSENT_REQUIRED` (photo without `AI_IMAGES`), `404` (context not visible to the user, or someone else's conversation or photo), `422 AI_BLOCKED` (provider safety filter; the message is stored with status BLOCKED), `429 AI_QUOTA` (with the reset time) or `429` (per-minute), `503 AI_UNAVAILABLE` |
| `POST /api/ai/plan` (**built P4-03**) | `{ text (1–1,000), skillId? }` → `200 { title, craft, skillId, materials: string[], steps: string[] }` (validated; one retry on invalid output). Counts as one message for the quotas and the global cap; `skillId` is the dodoi skill the craft matched (the one asked for, else a case-insensitive name match, else `null`); limits: title ≤ 80, craft ≤ 60, 1–20 materials ≤ 120, 1–15 steps ≤ 300. Errors as for messages (`403 EMAIL_NOT_VERIFIED`, `404` unknown skill, `422 AI_BLOCKED`, `429 AI_QUOTA`, `503 AI_UNAVAILABLE`, also when the answer is unusable twice). Nothing is stored; no usage text |
| `GET /api/ai/conversations?cursor=` (**built P4-01**) | The user's conversations, newest activity first: `{ items: [{ id, title, contextType, context: { id, title } \| null, updatedAt }], nextCursor }` |
| `GET /api/ai/conversations/{id}` (**built P4-01**) | Messages oldest first: `{ id, context, messages: [{ id, role, content, imageUrl, status, feedback: { helpful } \| null, createdAt }] }`; others' → `404` |
| `DELETE /api/ai/conversations/{id}` / `DELETE /api/ai/conversations` (**built P4-01**) | Delete one / all, with their photos → `204` |
| `PUT /api/ai/messages/{id}/feedback` (**built P4-01**) | `{ helpful, comment? (≤300) }` → `204`; assistant messages in your conversations only |
| `GET /api/me/consents` / `PUT /api/me/consents` (**built P4-01**) | `{ AI_IMAGES: boolean, AI_PROFILE_CONTEXT: boolean }` → grant or withdraw (records policy version and time) |
| `GET /api/admin/ai/usage?from=&to=` (**built P4-05**) | Admin only (`404` for everyone else, moderators included): `{ from, to, totals: { requests, inputTokens, outputTokens, costMicros, errors, blocked }, byDay: [{ date, …same }], dailyCap: { used, limit } }`. Dates `YYYY-MM-DD` (UTC, both inclusive); the last 30 days when left out; 1–366 days, else `400`; days without use are listed with zeros. `requests` counts requests that reached the provider or its filters (quota refusals are left out, like in the global cap); `costMicros` is the estimate from the token prices. `dailyCap` is today's count against `AI_DAILY_REQUEST_CAP` (an addition to the approved shape, for the dashboard). No content |
| `PUT /api/admin/ai/switch` (**built P4-05**) | Admin only: `{ enabled }` → `200 { isOn, isConfigured, isSwitchedOff }`. Stored in the database (`app_setting.ai_enabled`, no row = on) on top of the `AI_ENABLED` env flag: the companion runs only when both allow it, and the switch cannot turn on a server that has no key or model. Off → messages and plans answer `503 AI_UNAVAILABLE` at once and the screens show "The companion is resting."; audited (`ai.switch_on` / `ai.switch_off`, target `setting` / `ai_enabled`) |

`POST /api/me/projects` also accepts `materials: string[]` (≤ 30 names, ≤ 120 characters each; a plan's checklist, P4-03). Built details (P4-01): the quota errors are `429 AI_QUOTA` with `Retry-After` and `fields.resetAt` (ISO time); a blocked request answers `422 AI_BLOCKED` and stores the question as BLOCKED; context can only be a post the user can see (published, not hidden, not by someone blocked) or an active skill; the answer is capped at 8,000 characters.

Reports of an AI answer use the existing `POST /api/reports` with `targetType: "AI_MESSAGE"` (CONFIRMED: added to the report types in P4-02, visible to Moderators with the conversation text of that message only). **Built P4-02:** `targetId` is the answer's message id; only an answer in the reporter's own chat can be reported (anything else, including their own question, is `404`); the moderators' list shows that answer's text (up to 400 characters) and nothing else from the chat, with no link; `HIDE_TARGET` / `RESTORE_TARGET` answer `422 NOT_HIDEABLE` (an answer has nothing to hide), so moderators can only Dismiss; audit target `ai_message`.

### 9.3 Phase 3 endpoints (CONFIRMED — P3-00 approved 2026-10-30; help requests built in P3-03, communities in P3-01, messages in P3-02, sessions in P3-04)

All need a signed-in, **verified** member unless noted; lists use `cursor`, 20 per page, newest first; blocked members are filtered both ways; others' private data answers `404`. Errors use the standard format.

| Method & path | Who | Purpose |
|---|---|---|
| `GET /api/help-requests?status=&skillId=&matching=&mine=&cursor=` (**built P3-03**) | User | `{ items: HelpRequestCard[], nextCursor }` newest first, 20 a page, status `OPEN` by default; `mine=true` only your own; `matching=true` other people's requests in your can-help skills; hidden requests, blocked authors and requests resolved or idle for 90 days are left out. A card is `{ id, title, status, skill: { id, name, slug, accent } \| null, author: { username, displayName, avatarUrl } \| null, responseCount, isOwn, createdAt }` |
| `POST /api/help-requests` (**built**) | Verified | `{ title (≤100), body (≤1000), skillId, mediaIds? (≤3) }` → `201`; `429` at 5 a day |
| `GET /api/help-requests/{id}` (**built**) | User | The card plus `{ body, photos: Media[], responses: [{ id, body, author, isOwn, isHelpful, createdAt }], canRespond, isHidden }`; `404` for hidden (except the asker), blocked or unknown |
| `PATCH /api/help-requests/{id}` (**built**) | Owner | `{ status: "OPEN" \| "IN_PROGRESS" \| "RESOLVED" }` → `200` (reopen allowed) |
| `DELETE /api/help-requests/{id}` (**built**) | Owner | → `204` with its responses |
| `POST /api/help-requests/{id}/responses` (**built**, answers `201` with the request) | Verified | `{ body (≤1000) }` → `201`; `422 OWN_REQUEST`; `429` at 30 a day |
| `PUT /api/help-responses/{id}/helpful` / `DELETE` (**built**) | Owner of the request | Mark / unmark helpful → `204` |
| `GET /api/communities?q=&skill=&mine=&cursor=` (**built P3-01**) · `POST /api/communities` (**built**) | User · Verified | Discover (the member's interests first, then newest; `q` searches names, `skill` limits to one craft; `mine=true` lists the member's own circles) → `{ items: CommunityCard[], nextCursor }`, 20 a page; a card is `{ id, name, slug, description, skill: { id, name, slug, accent } \| null, myRole }`. Create `{ name (3–40), skillId, description (≤300), rules[] (≤5, each ≤150) }` → `201` with the detail; `400` for an unavailable craft or a blocked word; `422 NAME_TAKEN`; `429` at 2 a day; `422 COMMUNITY_LIMIT` at 10 owned |
| `GET /api/communities/{slug}` (**built**) | User | The card plus `{ rules[], isRemoved, canJoin, canPost }`; `404` when hidden or unknown (also for the owner) |
| `PUT` / `DELETE /api/communities/{slug}/membership` (**built**) | Verified | Join / leave → `204` (`403 REMOVED` after removal; `422 OWNER_MUST_HAND_OVER`; joining twice is fine) |
| `GET /api/communities/{slug}/posts?cursor=` (**built**) · `POST …/posts` (**built**) | **User** · Member (verified) | Discussions with all their replies, **newest activity first** (a reply refreshes its post), 20 a page: `{ items: [{ id, body, author, isOwn, photos, isHidden, canEdit, canDelete, isEdited, createdAt, replies: [...] }], nextCursor }`; blocked authors are left out both ways and hidden posts are returned only to their author, the owner and moderators. Post `{ body (≤2000), mediaIds? (≤4, purpose `community`), parentId? }` → `201` with the post; replies are text only and the parent must be a top-level post of the same community; `403 NOT_MEMBER`, `403 EMAIL_NOT_VERIFIED`, `404` for a bad parent, `429` at 30 an hour (PO to confirm) |
| `PATCH` / `DELETE /api/community-posts/{id}` (**built**) | Author (edit 15 min) / author, owner, moderators | `{ body }` → `200` (`422 EDIT_WINDOW_CLOSED`); delete → `204` with its replies and photos; a moderator's delete is logged as `post.delete`; others get `404` |
| `POST /api/communities/{slug}/moderation` (**built**) | Owner, moderator | `{ action: "HIDE_POST" \| "RESTORE_POST" \| "REMOVE_MEMBER" \| "ALLOW_MEMBER" \| "SET_ROLE", targetId, role? }` → `204`, logged without content (`post.hide`, `post.restore`, `member.remove`, `member.allow`, `role.change`). Moderators hide / restore posts and remove **members**; only the owner removes moderators, lets a removed member back (`ALLOW_MEMBER` deletes the removal so Join works again) and changes roles (`role: "OWNER"` hands the community over to a moderator and makes the owner a moderator). `403 NOT_MANAGER` / `NOT_OWNER`, `422 INVALID_TARGET`. `GET /api/communities/{slug}/moderation-log` (**built**) returns `{ memberCount, members[] (up to 100), removed[], log[] (last 50) }` for the owner and moderators only |
| `DELETE /api/communities/{slug}` (**built**) | Owner | → `204` with discussions and photos; others `403 NOT_OWNER` |
| `GET /api/conversations?cursor=` (**built P3-02**) · `POST /api/conversations` (**built**) | User · Verified | List your conversations with at least one message, newest activity first, 20 a page: `{ items: [{ id, with: { username, displayName, avatarUrl } \| null, lastMessage: { body \| null, isOwn, createdAt } \| null, lastMessageAt, hasUnread }], nextCursor }`; hidden-for-you and blocked ones are left out. Start `{ username }` → `200` with the existing conversation or `201` with a new one: `{ id, created }`; `403 MESSAGES_CLOSED`, `403 EMAIL_NOT_VERIFIED`, `404` (unknown, hidden or blocked), `422 SELF_MESSAGE`, `429` at 5 new a day (reopening one is free) |
| `GET /api/conversations/{id}` (**built**) | Participant | `{ id, with, canSend, messages (latest 50, oldest first), olderCursor }`; `404` for anyone else and when a block ended it |
| `GET /api/conversations/{id}/messages?after=\|before=` (**built**) | Participant | `{ items: [{ id, body \| null, isOwn, isDeleted, createdAt, cursor }], olderCursor }` oldest first: no parameter = the latest 50, `after` = newer than a cursor (the polling call, up to 51), `before` = the 50 before a cursor; opening or polling marks the conversation read for you only; no read marks are ever returned; `404` for others |
| `POST /api/conversations/{id}/messages` (**built**) | Participant (verified) | `{ body (≤1000) }` → `201` with the message; `403 MESSAGES_CLOSED` (their setting says no and they have never written), `422 AWAITING_REPLY` after 3 unanswered while they have never written, `429` at 30 an hour |
| `DELETE /api/messages/{id}` (**built**) · `DELETE /api/conversations/{id}` (**built**) | Sender · Participant | Erase one of your messages (it reads `body: null`, `isDeleted: true`) / hide the conversation for you → `204`; a new message brings it back; others `404` |
| `GET` / `PUT /api/me/message-settings` (**built**) | User | `{ messagePolicy: "EVERYONE" \| "FOLLOWING" \| "NOBODY" }` |
| `GET /api/sessions?scope=upcoming\|past&cursor=` (**built P3-04**) · `POST /api/sessions` (**built**) | User · Verified | List your sessions: `{ items: [{ id, state, isProposer, other: { username, displayName, avatarUrl } \| null, startsAt, durationMin, note, meetingUrl \| null, helpRequestId, canRespond, canCancel, createdAt }], nextCursor }`; `upcoming` = waiting proposals and accepted sessions that have not ended, soonest first (up to 50, no cursor); `past` = everything else, newest first, 20 a page; sessions with someone either side blocked are left out. `state` is worked out on read (an accepted session past its end is `COMPLETED`, an unanswered one past its start is `CANCELLED`). `meetingUrl` is returned only to the two people, only for `ACCEPTED` / `COMPLETED`, and until 24 hours after the end. Reading the list also creates due reminders. Propose `{ inviteeUsername, startsAt (ISO with zone, ≥1 h ahead), durationMin (15 \| 30 \| 45 \| 60), note? (≤300), meetingUrl (https, ≤500), helpRequestId? }` → `201` with the session; `403 EMAIL_NOT_VERIFIED`; `400` (time, length, link; `TOO_SOON` for a time under an hour away); `404` (unknown, hidden or blocked person, or a request that is not one of the two people\'s); `422 SELF_SESSION`, `422 TOO_MANY_OPEN` at 5 waiting proposals |
| `GET /api/sessions/{id}` (**built**) · `PATCH /api/sessions/{id}` (**built**) | Participant · Invitee / either | One of your sessions (`404` for anyone else). `{ action: "ACCEPT" \| "DECLINE" \| "CANCEL" }` or `{ action: "RESCHEDULE", startsAt, meetingUrl? }` → `200` with the session (for `RESCHEDULE`, the **new** proposal, which goes back to the person who proposed the old one, which becomes `RESCHEDULED`). Accept, decline and reschedule are for the invitee only (`403 NOT_INVITEE`) and only while the proposal waits and has not started (`422 NOT_PENDING`); cancel is for either person until the end (`422 NOT_CANCELLABLE`); `400 TOO_SOON` and `422 TOO_MANY_OPEN` as for proposing |
| Notifications | — | **Built P3-03:** `HELP_RESPONSE` (to the asker), `HELP_HELPFUL` (to the helper, once per mark) and `HELP_RESOLVED` (to everyone who answered) with matching switches in `GET` / `PUT /api/me/notification-preferences`; an item carries `helpRequest: { id, title } \| null` and opens `/community/help/{id}`. **Built P3-04:** `SESSION_PROPOSED` (to the invitee), `SESSION_ACCEPTED` and `SESSION_DECLINED` (to the proposer), `SESSION_RESCHEDULED` (to the person who proposed the old time, pointing at the new one), `SESSION_CANCELLED` (to the other person) and `SESSION_REMINDER` (to both, an hour before, created when either reads `GET /api/notifications`, `GET /api/notifications/unread` or `GET /api/sessions`); an item carries `session: { id, startsAt } \| null` and opens `/community/sessions`; they have no entry in `…/notification-preferences` |

