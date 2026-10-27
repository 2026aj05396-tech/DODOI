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
Full view also has `isPrivate: false`, `isOwner` and `visibility`; skills are active skills only; `publicCollections` are most recently changed first. Private profile (OD-10) → `{ username, displayName, avatarUrl, isPrivate: true }` only (the owner always gets the full view). Unknown, deactivated or hidden-after-report profiles → `404` (owners still see their own). **Never** includes email, DOB, role, internal IDs beyond what is needed.

---

## 5. Feed, Posts, Themes, Search

### GET /api/feed — User
Query: `filter` (`for-you` default · `skill:<slug>` (must be one of the actor's interests) · `new-to-you`), `cursor`, `limit`. A call without cursor creates a feed session bound to that filter; changing filter = new session.
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
`PostDetail`. DRAFT/UNPUBLISHED → 404 for non-admins.

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

### GET /api/admin/reports?status=OPEN|RESOLVED&cursor= — Admin
One row per reported target (PO decision, P1-28b): `{ reportId, targetType, target: { label, href, detail, isHidden }, reportCount, reasons: { REASON: n }, notes: [{ reason, note, createdAt }], latestAt, status }`, newest report first. Reporters are never included (RPT-05).

### POST /api/admin/reports/{id}/action — Admin
`{ "action": "HIDE_TARGET" | "DISMISS" | "RESTORE_TARGET" }` for the report's target: hide it and resolve all its open reports as ACTIONED; resolve them as DISMISSED; or show a hidden target again (Resolved tab). Audited as `report.hide_target` / `report.dismiss` / `report.restore_target`. → `204`.

## 7. Media

### POST /api/media/sign — Admin (Phase 1); User from P2
```json
{ "purpose": "post" | "cover" | "avatar", "type": "IMAGE" | "VIDEO", "bytes": 123456, "mimeType": "image/jpeg" }
```
Validates against MEDIA-01…03 (`413 PAYLOAD_TOO_LARGE`, `400 UNSUPPORTED_MEDIA_TYPE`; videos only for `post`). Returns `{ "uploadUrl", "signature", "timestamp", "apiKey", "folder", "resourceType", "allowedFormats" }` for a direct Cloudinary upload; the browser sends `folder`, `allowed_formats`, `timestamp`, `api_key` and `signature` exactly as returned. Folder: `dodoi/<APP_ENV>/{posts|covers|avatars}`. Rate limit: 30 / hour / user. Non-admins (and signed-out callers) → `404`.

### POST /api/media — Admin (P1)
`{ "purpose": "post", "type": "IMAGE", "publicId": "…", "altText": "…" }` → server fetches asset metadata from Cloudinary, re-validates type/size/dimensions/duration, creates `MediaAsset` → `201 Media`. Mismatch → deletes the Cloudinary asset and returns `400 UNSUPPORTED_MEDIA_TYPE` / `400 MEDIA_REJECTED` / `413`. `publicId` outside the purpose's folder or unknown → `400 MEDIA_NOT_FOUND`; already saved → `409 MEDIA_ALREADY_REGISTERED`. Alt text is optional here (it can be added after upload with `PATCH /api/media/{id}`); publishing a post requires it on every image.

### PATCH /api/media/{id} — Owner/Admin
`{ "altText": "…" }`.

Avatar uploads for regular users (P1-12): any signed-in user may sign and register uploads for `purpose: "avatar"` only (IMAGE, MEDIA-02, folder `avatars/`, the same 30/hour limit) — CONFIRMED 2026-10-27. Other purposes stay admin-only (`404`).

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

---

## 9. Later Phases (to be specified)

P2: posts (user create/edit/delete), projects & entries, comments, likes, follows, notifications, reports, blocks. P3: communities, conversations/messages (polling: `GET /api/conversations/{id}/messages?after=<cursor>`), help requests, sessions. P4: AI endpoints (see AI_INTEGRATION.md).
