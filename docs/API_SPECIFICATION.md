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

> **OPEN:** whether feed/explore/post detail are publicly viewable without an account (USER_FLOWS F-01). Endpoints below marked `User*` become `Public` (read-only, non-personalized) if that is approved.

---

## 2. Shared Types

```ts
type ExperienceLevel = "CURIOUS" | "BEGINNER" | "INTERMEDIATE" | "EXPERIENCED";

type SkillSummary = { id: string; name: string; slug: string; accentToken: string; origin: "PREDEFINED" | "CUSTOM" };

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
  coverMedia: Media; mediaCount: number;
  skills: SkillSummary[]; primarySkillId: string;
  creator: CreatorSummary | null; attribution: Attribution | null;
  isSaved: boolean;
};

type PostDetail = PostCard & {
  description: string | null;
  media: Media[];
  difficulty: ExperienceLevel | null; estimatedMinutes: number | null;
  materials: { name: string; note: string | null }[];
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
- `201` `{ "status": "verification_sent" }` — **also returned when email already exists** (sends an "account exists" email instead) to prevent enumeration.
- `400` invalid input · `422 UNDER_MINIMUM_AGE` · `429`.

### POST /api/account/age — User
For Google sign-ups that have not passed the age check: `{ "dateOfBirth": "YYYY-MM-DD" }` → `204` (sets `ageConfirmedAt`) · `422 UNDER_MINIMUM_AGE` (account and session deleted). Until this succeeds, all other `/api/*` calls return `403 AGE_CHECK_REQUIRED`.

### POST /api/account/verify-email — Public
`{ "token": "…" }` → `204` · `400 TOKEN_INVALID_OR_EXPIRED`.

### POST /api/account/verify-email/resend — User
Rate limit: 3 / hour / user. → `204` (also when already verified).

### POST /api/account/password-reset/request — Public
`{ "email": "…" }` → always `204`. Rate limit: 5 / hour / IP and 3 / hour / email.

### POST /api/account/password-reset/confirm — Public
`{ "token": "…", "newPassword": "…" }` → `204`; increments `sessionVersion` (signs out other sessions) · `400 TOKEN_INVALID_OR_EXPIRED`.

### POST /api/account/password — User
`{ "currentPassword": "…", "newPassword": "…" }` → `204` · `400` wrong current password. Google-only accounts (no password): `400 NO_PASSWORD_SET` — they sign in with Google; setting a password is via the reset flow.

### GET /api/account — User
`{ "email", "emailVerified": bool, "hasPassword": bool, "providers": ["google"], "role", "onboardingCompleted": bool }`

### DELETE /api/account — User
Requires recent re-authentication (PROPOSED: within 5 minutes, or password in body). Deactivates immediately and schedules hard delete in 14 days (OD-22) → `202 { "deletionScheduledFor": "…" }`.

### POST /api/account/deletion/cancel — User
Within the grace period → `204`.

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
Skill detail: `{ ...SkillSummary, description, coverMedia, relatedSkills: SkillSummary[] }`. Hidden skill → 404.

### GET /api/skills/{slug}/posts — User*
Paginated `PostCard[]`.

### GET /api/me/skills — User
`{ items: [{ skill: SkillSummary, isInterest, canHelp, wantsToLearn, level }] }`

### PUT /api/me/skills — User
Replace the full set (used by onboarding and settings).
```json
{ "items": [{ "skillId": "…", "isInterest": true, "canHelp": false, "wantsToLearn": false, "level": "BEGINNER" }] }
```
Rules: skill must exist and be ACTIVE; no duplicate skillIds; rows with all flags false are dropped; max items OPEN. → `200` new set.

### POST /api/me/onboarding/complete — User
Marks onboarding complete. Precondition: minimum interests per OD-14. → `204`.

### GET /api/me/profile — User
Own full profile (incl. visibility).

### PATCH /api/me/profile — User
```json
{ "username": "…", "displayName": "…", "bio": "…", "avatarMediaId": "…|null", "visibility": "PUBLIC|PRIVATE" }
```
`409 USERNAME_TAKEN` · `400` invalid/reserved username · `422 USERNAME_CHANGE_TOO_SOON` (within 30 days of last change) · `avatarMediaId` must be owned by actor and of type IMAGE.

### GET /api/profiles/{username} — User*
Public profile: `{ username, displayName, bio, avatarUrl, skills: { interests[], canHelp[], wantsToLearn[] } (with levels), publicCollections: CollectionSummary[] }`.
Private profile (OD-10) → `{ username, displayName, avatarUrl, isPrivate: true }` only. **Never** includes email, DOB, role, internal IDs beyond what is needed.

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
`skill_suggestion` placement per FEED-14 (PROPOSED: first item on page 1, max one per page; never a skill already in the actor's interests or one they dismissed).

### GET /api/feed/filters — User
Chips for the filter bar: `{ items: [{ key: "for-you", label: "For you" }, { key: "skill:crochet", label: "Crochet" }, …, { key: "new-to-you", label: "New to you" }] }`.

### GET /api/feed/suggestion — User
Single `skill_suggestion` for the desktop right rail (`2b`), or `204` if none.

### POST /api/feed/feedback — User
`{ "postId": "…", "type": "NOT_INTERESTED" }` → `204` (idempotent).
### DELETE /api/feed/feedback — User
Undo: same body → `204`.

### GET /api/posts/{postId} — User*
`PostDetail`. DRAFT/UNPUBLISHED → 404 for non-admins.

### GET /api/posts/{postId}/progress — User
`{ "checkedMaterialIds": string[], "completedStepPositions": number[], "updatedAt": string | null }` (empty defaults if none).

### PUT /api/posts/{postId}/progress — User
`{ "checkedMaterialIds"?: string[], "completedStepPositions"?: number[] }` — partial replace, idempotent. Ids must belong to the post; positions must exist in the post. → `200` new progress. (POST-11/12)

### GET /api/posts/{postId}/related — User*
Up to 12 `PostCard` sharing skills (PROPOSED count). No pagination.

### GET /api/themes — User*
Published themes: `{ id, slug, title, description, coverMedia }[]`.
### GET /api/themes/{slug} — User*
Theme + paginated `PostCard[]` (`?cursor`).

### GET /api/explore — User*
```json
{
  "popularSkills": [SkillSummary],
  "newSkills": [SkillSummary],
  "themes": [ThemeSummary],
  "beginnerFriendly": [PostCard]
}
```
"Popular" definition PROPOSED: most saves in last 30 days; "new": most recently created ACTIVE skills.

### GET /api/search — User*
Query: `q` (required, 1–100 chars, trimmed), `type` = `all|posts|skills|creators` (default `all`), `cursor`, `limit`. Rate limit: 60 / minute / user (PROPOSED).
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
Paginated `PostCard[]` newest first ("All saved").

### GET /api/collections — User
Own collections: `{ items: [{ id, name, visibility, itemCount, coverMedia: Media|null }] }`.
### POST /api/collections — User
`{ "name": "Crochet ideas to try", "visibility": "PRIVATE" }` (visibility optional, defaults PRIVATE) → `201`.
### GET /api/collections/{id} — Owner, or User* if PUBLIC
Collection + paginated `PostCard[]`. Private and not owner → **404**.
### PATCH /api/collections/{id} — Owner
`{ "name"?, "visibility"? }` → `200`.
### DELETE /api/collections/{id} — Owner
Deletes collection only; saves remain (CONFIRMED). → `204`.
### PUT /api/collections/{id}/items/{postId} — Owner
Adds post to collection. If the post is not yet saved, it is saved first (PROPOSED). → `204`.
### DELETE /api/collections/{id}/items/{postId} — Owner
Removes from this collection only; save remains. → `204`.
### GET /api/posts/{postId}/collections — User
IDs of actor's collections containing the post (for the picker).

---

## 6b. Reports (Phase 1: skills and profiles)

### POST /api/reports — User (verified email)
`{ "targetType": "SKILL" | "PROFILE", "targetId": "…", "reason": "OFFENSIVE" | "SPAM" | "IMPERSONATION" | "OTHER", "note"?: "…" }` → `201` (also `201` if an open report by the same user already exists — idempotent). Rate limit 10 / day / user. Cannot report yourself → `422`.

## 7. Media

### POST /api/media/sign — Admin (Phase 1); User from P2
```json
{ "type": "IMAGE" | "VIDEO", "bytes": 123456, "mimeType": "image/jpeg" }
```
Validates against MEDIA-01…03 (`413 PAYLOAD_TOO_LARGE`, `400 UNSUPPORTED_MEDIA_TYPE`). Returns `{ "uploadUrl", "signature", "timestamp", "apiKey", "folder", "resourceType" }` for a direct Cloudinary upload. Rate limit: 30 / hour / user (PROPOSED).

### POST /api/media — Admin (P1)
`{ "publicId": "…", "altText": "…" }` → server fetches asset metadata from Cloudinary, re-validates type/size/dimensions/duration, creates `MediaAsset` → `201 Media`. Mismatch → deletes Cloudinary asset and returns `400`.

### PATCH /api/media/{id} — Owner/Admin
`{ "altText": "…" }`.

Avatar uploads for regular users in P1 (profile editing) **require user access to media signing** for type IMAGE with folder `avatars/`. PROPOSED: allow `User` for `purpose: "avatar"` only.

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
| `PATCH /api/admin/skills/{id}` | Edit description/cover/status (hide custom skills) |
| `PUT /api/admin/skills/{id}/related` | Set related skills |
| `GET /api/admin/reports?status=OPEN&cursor=` | List reports |
| `POST /api/admin/reports/{id}/action` | `{ "action": "HIDE_TARGET" \| "DISMISS" }` — hides skill / profile or dismisses; audited |

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
Every mutation writes an `AuditLog` entry.

**Seed file format** (`seed-content/posts/<seedKey>.json`) = the admin body above plus `seedKey` and local `mediaFiles: [{ "path": "…", "altText": "…" }]` instead of `mediaIds`.

---

## 9. Later Phases (to be specified)

P2: posts (user create/edit/delete), projects & entries, comments, likes, follows, notifications, reports, blocks. P3: communities, conversations/messages (polling: `GET /api/conversations/{id}/messages?after=<cursor>`), help requests, sessions. P4: AI endpoints (see AI_INTEGRATION.md).
