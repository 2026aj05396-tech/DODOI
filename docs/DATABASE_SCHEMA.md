# Database Schema

**Engine:** PostgreSQL (CONFIRMED) · **ORM:** Prisma (CONFIRMED)

This document is the source of truth for `prisma/schema.prisma`. Phase 1 models are specified in detail; later-phase entities are listed and will be specified before their phase begins. Changes to the schema must update this document in the same change.

Markers: **CONFIRMED** / **PROPOSED** / **OPEN**.

---

## 1. Conventions

| Rule | Value |
|---|---|
| Primary keys | `String @id @default(cuid())` (CONFIRMED) — stable, non-sequential, not guessable |
| Table names | Prisma model names in PascalCase; mapped to snake_case tables via `@@map` (CONFIRMED) |
| Column names | camelCase in Prisma, `@map` to snake_case |
| Timestamps | `createdAt @default(now())`, `updatedAt @updatedAt`; stored as `timestamptz` (UTC); displayed in user's local time zone |
| Soft delete | Only where stated (`deletedAt`) |
| Foreign keys | Always declared; `onDelete` behavior explicit on every relation |
| Enums | Prisma enums for closed sets |
| Text limits | Enforced in Zod and with `@db.VarChar(n)` where a hard limit is decided |
| Authorization | IDs are never authorization; every query is scoped by actor in the service layer |
| Exact definition | `prisma/schema.prisma` (built in P1-01). Listings below are the logical spec; implementation differences are recorded in §4.8 |
| Model listings below | Logical drafts. Some Prisma back-relation fields (e.g. on `MediaAsset` for avatars, skill covers, step media, theme covers) and `@map` attributes are omitted for readability and must be added so `prisma validate` passes |

## 2. Entity Relationship Overview (Phase 1)

```
User 1─1 Profile
User 1─* Account (OAuth)            User 1─* AuthToken
User 1─* UserSkill *─1 Skill        Skill *─* Skill (SkillRelation)
User 1─* Save *─1 Post
User 1─* Collection 1─* CollectionItem *─1 Save
Post 1─* PostSkill *─1 Skill
Post 1─* PostMedia *─1 MediaAsset
Post 1─* PostStep         Post 1─* PostMaterial
Post 1─1 PostAttribution (seed content)
Theme 1─* ThemePost *─1 Post
User 1─* FeedSession 1─* FeedImpression *─1 Post
User 1─* FeedFeedback *─1 Post
User 1─* AuditLog (as actor)
```

## 3. Enums

```prisma
enum Role              { USER ADMIN }                         // MODERATOR added in P2
enum ExperienceLevel   { CURIOUS BEGINNER INTERMEDIATE EXPERIENCED }   // CONFIRMED
enum ProfileVisibility { PUBLIC PRIVATE }                      // default PUBLIC (CONFIRMED)
enum CollectionVisibility { PRIVATE PUBLIC }                   // default PRIVATE (CONFIRMED)
enum SkillOrigin       { PREDEFINED CUSTOM }
enum SkillStatus       { ACTIVE HIDDEN }                       // HIDDEN = removed by admin after report
enum PostStatus        { DRAFT PUBLISHED UNPUBLISHED }
enum PostType          { FIRST_ATTEMPT TUTORIAL WORK_IN_PROGRESS JOURNAL FINISHED TIP }  // CONFIRMED (design labels + Tip)
enum MediaType         { IMAGE VIDEO }
enum SourceType        { TEAM_ORIGINAL INVITED_CREATOR STOCK_LICENSED CREATIVE_COMMONS USER_UPLOAD }   // CC BY / BY-SA only; USER_UPLOAD from P2
enum AuthTokenType     { EMAIL_VERIFICATION PASSWORD_RESET }
enum FeedbackType      { NOT_INTERESTED }
enum SkillAccent       { BUTTER BLUSH LAVENDER MINT SKY CORAL }   // design accents (UI_UX_GUIDELINES §2.3)
```

## 4. Phase 1 Models

### 4.1 Identity and auth

```prisma
model User {
  id             String    @id @default(cuid())
  email          String    @unique               // stored lowercased
  emailVerified  DateTime?
  passwordHash   String?                         // null for Google-only accounts
  role           Role      @default(USER)
  sessionVersion Int       @default(0)           // bump to invalidate JWTs
  onboardingCompletedAt DateTime?
  onboardingStep        Int       @default(1) // 1–3, step to resume at (P1-10, PO decision)
  ageConfirmedAt DateTime?                       // set when DOB check passes (18+); DOB itself is never stored (OD-07)
  deletionRequestedAt DateTime?                  // deactivated now; hard delete 14 days later (OD-22)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  profile     Profile?
  accounts    Account[]
  authTokens  AuthToken[]
  skills      UserSkill[]
  saves       Save[]
  collections Collection[]
  feedSessions FeedSession[]
  feedFeedback FeedFeedback[]
  createdSkills Skill[]   @relation("SkillCreator")
  auditLogs   AuditLog[]
}

// Google account links (Auth.js account fields; OAuth tokens are not stored)
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
  @@index([userId])
}

model AuthToken {
  id        String        @id @default(cuid())
  userId    String
  type      AuthTokenType
  tokenHash String        @unique      // SHA-256 of the raw token; raw token only in the email
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime      @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, type])
}
```

Notes:
- Auth.js `Session` and `VerificationToken` models: not needed with JWT sessions and custom verification. Include only if the adapter version requires them (verify at scaffold time).
- Token expiry durations: CONFIRMED 24h (verification), 1h (reset).

### 4.2 Profile and skills

```prisma
model Profile {
  userId      String   @id
  username    String   @unique          // 3–20, [a-z][a-z0-9_-]*, auto-generated at sign-up (OD-11, DC-26)
  usernameChangedAt DateTime?           // enforce max one change per 30 days
  usernamePromptDismissedAt DateTime?   // "Pick your username" dismissed (DC-26, P1-14)
  displayName String   @db.VarChar(50)  // limit CONFIRMED
  bio         String?  @db.VarChar(300) // limit CONFIRMED
  avatarMediaId String? @unique
  visibility  ProfileVisibility @default(PUBLIC)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  user   User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  avatar MediaAsset? @relation(fields: [avatarMediaId], references: [id], onDelete: SetNull)
}

model Skill {
  id             String      @id @default(cuid())
  name           String                       // display form, e.g. "Pipe cleaner art"
  normalizedName String      @unique          // lowercased, trimmed, collapsed whitespace
  slug           String      @unique
  description    String?
  hint           String?   @db.VarChar(40)    // editor-set skill card tag, e.g. "Pairs with drawing" (SRCH-08); limit CONFIRMED
  pitch          String?   @db.VarChar(140)   // "New to you" one-liner, admin-authored (FEED-14); limit CONFIRMED
  origin         SkillOrigin @default(PREDEFINED)
  status         SkillStatus @default(ACTIVE)
  accent         SkillAccent                  // BUTTER | BLUSH | LAVENDER | MINT | SKY | CORAL (design accents)
  coverMediaId   String?
  createdById    String?                      // set for CUSTOM skills
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  createdBy  User?  @relation("SkillCreator", fields: [createdById], references: [id], onDelete: SetNull)
  coverMedia MediaAsset? @relation(fields: [coverMediaId], references: [id], onDelete: SetNull)
  userSkills UserSkill[]
  postSkills PostSkill[]
  relatedFrom SkillRelation[] @relation("from")
  relatedTo   SkillRelation[] @relation("to")
  @@index([origin, status])
}

model SkillRelation {                // admin-curated "related skills"
  fromSkillId String
  toSkillId   String
  from Skill @relation("from", fields: [fromSkillId], references: [id], onDelete: Cascade)
  to   Skill @relation("to",   fields: [toSkillId],   references: [id], onDelete: Cascade)
  @@id([fromSkillId, toSkillId])
}

model UserSkill {
  userId       String
  skillId      String
  isInterest   Boolean          @default(false)
  canHelp      Boolean          @default(false)
  wantsToLearn Boolean          @default(false)
  level        ExperienceLevel?           // null = not specified
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  skill Skill @relation(fields: [skillId], references: [id], onDelete: Restrict)
  @@id([userId, skillId])
  @@index([skillId])
}
```

Rules:
- One `UserSkill` row per (user, skill); the three flags keep **interest / can help / want to learn** distinct (PRF-02). A row with all flags false is deleted.
- Custom skill creation: normalize → look up `normalizedName` → reuse if exists, else create with `origin = CUSTOM` (CONFIRMED immediately public).
- `onDelete: Restrict` on Skill: skills are hidden, not deleted, once referenced.

### 4.3 Content

```prisma
model Post {
  id            String     @id @default(cuid())
  authorId      String?                     // set for invited-creator posts; null for team/stock/CC posts (OD-18)
  type          PostType
  status        PostStatus @default(DRAFT)
  title         String     @db.VarChar(120) // limit CONFIRMED
  description   String?    @db.Text
  difficulty    ExperienceLevel?
  estimatedMinutes Int?
  publishedAt   DateTime?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  // searchVector tsvector — added via raw SQL migration (see §6)
  author      User?            @relation(fields: [authorId], references: [id], onDelete: SetNull)
  skills      PostSkill[]
  media       PostMedia[]
  steps       PostStep[]
  materials   PostMaterial[]
  attribution PostAttribution?
  saves       Save[]
  themePosts  ThemePost[]
  @@index([status, publishedAt(sort: Desc)])
  @@index([authorId])
}

model PostSkill {
  postId    String
  skillId   String
  isPrimary Boolean @default(false)   // exactly one primary per post (service-enforced)
  post  Post  @relation(fields: [postId], references: [id], onDelete: Cascade)
  skill Skill @relation(fields: [skillId], references: [id], onDelete: Restrict)
  @@id([postId, skillId])
  @@index([skillId])
}

model MediaAsset {
  id           String    @id @default(cuid())
  ownerId      String?                       // uploader
  type         MediaType
  provider     String    @default("cloudinary")
  publicId     String    @unique             // Cloudinary public_id
  format       String
  width        Int
  height       Int
  bytes        Int
  durationSec  Float?                        // video only
  altText      String?   @db.VarChar(300)    // required for content images (service-enforced)
  createdAt    DateTime  @default(now())
  postMedia PostMedia[]
}

model PostMedia {
  postId   String
  mediaId  String
  position Int
  post  Post       @relation(fields: [postId], references: [id], onDelete: Cascade)
  media MediaAsset @relation(fields: [mediaId], references: [id], onDelete: Restrict)
  @@id([postId, mediaId])
  @@unique([postId, position])
}

model PostStep {
  id       String  @id @default(cuid())
  postId   String
  position Int
  text     String  @db.Text
  mediaId  String?
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  @@unique([postId, position])
}

model PostMaterial {
  id       String  @id @default(cuid())
  postId   String
  position Int
  name     String  @db.VarChar(120)
  note     String? @db.VarChar(200)       // e.g. quantity, alternative
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  @@unique([postId, position])
}

model PostAttribution {                   // required for all seeded posts (ADM-03)
  postId          String     @id
  sourceType      SourceType
  license         String                  // e.g. "Owned", "Pexels License", "Creator permission 2026-10"
  attributionText String                  // shown in AttributionBlock
  originalAuthor  String?
  originalUrl     String?
  permissionRef   String?                 // internal reference to written permission (invited creators)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
}

model Theme {                             // admin-curated explore themes (CONFIRMED entity)
  id          String   @id @default(cuid())
  slug        String   @unique
  title       String
  description String?
  coverMediaId String?
  isPublished Boolean  @default(false)
  position    Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  posts ThemePost[]
}

model ThemePost {
  themeId  String
  postId   String
  position Int
  theme Theme @relation(fields: [themeId], references: [id], onDelete: Cascade)
  post  Post  @relation(fields: [postId], references: [id], onDelete: Cascade)
  @@id([themeId, postId])
}
```

### 4.4 Saves and collections

```prisma
model Save {
  id        String   @id @default(cuid())
  userId    String
  postId    String
  createdAt DateTime @default(now())
  user  User @relation(fields: [userId], references: [id], onDelete: Cascade)
  post  Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  collectionItems CollectionItem[]
  @@unique([userId, postId])
  @@index([userId, createdAt(sort: Desc)])
}

model Collection {
  id         String               @id @default(cuid())
  userId     String
  name       String               @db.VarChar(80)   // limit CONFIRMED
  visibility CollectionVisibility @default(PRIVATE)
  createdAt  DateTime             @default(now())
  updatedAt  DateTime             @updatedAt
  user  User @relation(fields: [userId], references: [id], onDelete: Cascade)
  items CollectionItem[]
  nameNormalized String          // lowercased, trimmed — uniqueness per user (OD-17)
  @@unique([userId, nameNormalized])
  @@index([userId])
}

model CollectionItem {
  collectionId String
  saveId       String
  addedAt      DateTime @default(now())
  collection Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  save       Save       @relation(fields: [saveId], references: [id], onDelete: Cascade)
  @@id([collectionId, saveId])
  @@index([saveId])
}
```

Rules (CONFIRMED unless marked):
- Deleting a `Collection` cascades only to `CollectionItem`; `Save` rows remain → posts stay in "All saved".
- Deleting a `Save` cascades to its `CollectionItem`s → unsave removes from all collections (CONFIRMED).
- `CollectionItem` references `Save`, so an item can only be in a collection if it is saved, and always belongs to the collection owner's save (service also checks `save.userId == collection.userId`).
- Collection names are unique per user, case-insensitive (`nameNormalized`, CONFIRMED OD-17); max 100 collections per user and 1,000 items per collection (service-enforced).

### 4.5 Feed

```prisma
model FeedSession {
  id        String   @id @default(cuid())
  userId    String
  filter    String   @default("for-you")   // for-you | skill:<slug> | new-to-you (FEED-13)
  createdAt DateTime @default(now())
  expiresAt DateTime
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  impressions FeedImpression[]
  @@index([userId, createdAt(sort: Desc)])
}

model FeedImpression {                     // + page, position (P1-22): repeat requests for a page return the same posts
  sessionId String
  postId    String
  servedAt  DateTime @default(now())
  session FeedSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@id([sessionId, postId])
}

model FeedFeedback {
  userId    String
  postId    String
  type      FeedbackType
  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([userId, postId, type])
  @@index([userId, createdAt(sort: Desc)])
}
```

### 4.5b Tutorial progress (POST-11, POST-12)

```prisma
model PostProgress {                       // shape and behaviour CONFIRMED (DC-07)
  userId               String
  postId               String
  checkedMaterialIds   String[]            // PostMaterial ids ticked by the user
  completedStepPositions Int[]             // steps marked done (DC-24); "Step n of N" = count
  updatedAt            DateTime @updatedAt
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  @@id([userId, postId])
}
```
Rules: private to the user; positions outside the post's step range are rejected; stale material ids (material removed by admin) are ignored on read and dropped on next write. Replacing a post's materials (admin edit, seed import) keeps the id of every material whose name is unchanged, so ticks survive edits (P1-20b). Steps are matched by position, so reordering steps moves "done" marks with the position.

### 4.6 Admin

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  action     String               // e.g. "post.publish", "skill.hide"
  targetType String
  targetId   String
  metadata   Json?                // no sensitive content
  createdAt  DateTime @default(now())
  actor User? @relation(fields: [actorId], references: [id], onDelete: SetNull)
  @@index([targetType, targetId])
  @@index([createdAt(sort: Desc)])
}
```

### 4.7 Reports (OD-12) and rate limits (OD-27)

```prisma
enum ReportTargetType { SKILL PROFILE }                 // POST, COMMENT, MESSAGE added in later phases
enum ReportReason     { OFFENSIVE SPAM IMPERSONATION OTHER }
enum ReportStatus     { OPEN ACTIONED DISMISSED }

model Report {
  id          String           @id @default(cuid())
  reporterId  String?
  targetType  ReportTargetType
  targetId    String
  reason      ReportReason
  note        String?          @db.VarChar(500)
  status      ReportStatus     @default(OPEN)
  resolvedById String?
  resolvedAt  DateTime?
  createdAt   DateTime         @default(now())
  reporter   User? @relation("ReportReporter", fields: [reporterId], references: [id], onDelete: Cascade)
  @@index([status, createdAt(sort: Desc)])
  @@index([targetType, targetId])
}
// One OPEN report per reporter+target: enforced in the service (partial unique index via raw SQL, PROPOSED).

model RateLimitBucket {
  key         String                 // e.g. "signin:ip:1.2.3.4"
  windowStart DateTime
  count       Int      @default(0)
  @@id([key, windowStart])
  @@index([windowStart])
}
```
Profile also gets `isHidden Boolean @default(false)` (admin action after a report).

### 4.8 Implementation notes (P1-01)

Differences between the listings above and `prisma/schema.prisma`, all following §1 conventions:

- **Relations added** for every foreign key the listings left implicit: `FeedImpression.post`, `FeedFeedback.post`, `MediaAsset.owner`, `PostStep.media`, `Theme.coverMedia`, `Report.resolvedBy` (named relations on `MediaAsset`: `ProfileAvatar`, `SkillCover`, `ThemeCover`).
- **`Skill.accent`** is the `SkillAccent` enum instead of a free-text `accentToken`.
- **`Profile.isHidden`**, **`Post.seedKey`** and **`Collection.nameNormalized`** are in the model.
- **Extra indexes** on foreign-key columns used for lookups and cascades (`save.post_id`, `post_media.media_id`, `feed_impression.post_id`, `feed_session.expires_at`, `report.reporter_id`, …).
- **One open report per reporter and target** is enforced in the reports service; no partial unique index (still PROPOSED).
- **Auth.js models:** `Session` and `VerificationToken` are not included (JWT sessions, custom verification). **Done in P1-04:** no Prisma adapter is used; the users module creates Google users itself (User + Profile + Account in one transaction): the Google name pre-fills `Profile.displayName`, the photo is not imported (no columns added), and the token columns of `Account` stay empty (PROPOSED: tokens not stored).

## 5. Indexes Summary (Phase 1 query patterns)

| Query | Index |
|---|---|
| Feed candidates by recency | `Post(status, publishedAt desc)` |
| Posts by skill | `PostSkill(skillId)` |
| User's saves, newest first | `Save(userId, createdAt desc)` |
| Is post saved by user | `Save @@unique(userId, postId)` |
| Collections of a user | `Collection(userId)` |
| Collections containing a save | `CollectionItem(saveId)` |
| Exclude served posts | `FeedImpression @@id(sessionId, postId)` |
| Exclude hidden posts | `FeedFeedback(userId, createdAt desc)` |
| Skill lookup / dedupe | `Skill.normalizedName` unique, `Skill.slug` unique |
| Profile by username | `Profile.username` unique |
| Full-text post search | GIN on `Post.search_vector` (raw SQL) |
| Partial post title search | GIN trigram on `Post.title` (raw SQL) |
| Skill / creator fuzzy search | GIN trigram on `Skill.name`, `Profile.username`, `Profile.display_name` |

## 6. Raw SQL Migration Items

Implemented in P1-01 (`prisma/migrations/*_init`). Prisma 7 can declare most of it, so drift detection stays clean:

| Item | Where |
|---|---|
| `CREATE EXTENSION IF NOT EXISTS pg_trgm;` | **Hand-added** at the top of the init migration (only manual SQL) |
| `post.search_vector tsvector` | `Post.searchVector Unsupported("tsvector")?` in the schema |
| `post_search_vector_idx` (GIN) | `@@index([searchVector], type: Gin)` |
| `post_title_trgm_idx`, `skill_name_trgm_idx`, `profile_username_trgm_idx`, `profile_display_name_trgm_idx` (GIN, `gin_trgm_ops`) | `@@index([field(ops: raw("gin_trgm_ops"))], type: Gin)` |

`search_vector` (title A, description B, skill names C) is written by the content service on save (PROPOSED approach) and queried with tagged `$queryRaw`. A follow-up `prisma migrate dev` after the init migration produces an empty migration (verified: no drift).

Text-search configuration: **`'simple'`** (CONFIRMED, OD-32) — language-neutral, so Hindi and mixed-language skill names match; no English stemming.

## 7. Data Lifecycle

| Data | Rule |
|---|---|
| User account deletion | CONFIRMED (OD-22): deactivate immediately, hard delete after 14 days (SECURITY §7.3). Cascades remove profile, accounts, skills, saves, collections, progress, feed data, tokens, reports filed. Custom skills remain (creator null); audit logs keep rows (actor null); invited creators' posts deleted with their media (PO decision 2026-10-27). Run by `pnpm jobs:daily` (P1-28/P1-33). |
| Unverified accounts | Hard-deleted after 30 days (OD-08) |
| Rate-limit buckets | Purged daily after their window expires |
| Auth tokens | Deleted after use or expiry by the daily jobs (P1-33) |
| Feed sessions/impressions | Deleted 7 days after expiry (CONFIRMED) |
| Feed feedback | Retained while account exists (PROPOSED) |
| Media assets | Deleted from Cloudinary when DB record deleted; orphans cleaned after 24h (CONFIRMED) |
| Unpublished posts | Retained; admin can delete |
| Audit logs | Retained; retention period OPEN |

## 8. Seed Data

- `prisma/seed/skills.json` — 51 approved predefined skills (OD-30) with description, pitch, hint, accent and 32 related pairs, loaded by `pnpm db:seed` → `seedPredefinedSkills()` (skills module). Idempotent: matches by `normalizedName`, keeps existing slugs and hidden status, stores related pairs in both directions, never deletes skills removed from the file. Validated by `src/server/modules/skills/seed-skills.test.ts`.
- `seed-content/posts/*.json` + media files — posts with attribution (schema and import rules in API spec §8). **Kept outside git** (PO decision, P1-18: licensed media must not go into the repository); `seed-content/` is git-ignored and the content lives in a shared drive. Imported with `pnpm seed:content [folder]` (default `./seed-content`; `--check` validates only; refuses production without `--confirm-production`). Seeded media have no owner (`ownerId` null). Template, field guide and example posts: `docs/seed-content/`; launch minimums (OD-31) and the coverage report: README §2, `/admin/coverage`.
- Admin user: the account whose verified email equals `SEED_ADMIN_EMAIL` is promoted to ADMIN when it signs in (P1-04), recorded in `AuditLog` as `user.promote_admin`. No account is created by the seed.
- Import is idempotent: posts keyed by a stable `seedKey` (CONFIRMED extra unique column `Post.seedKey String? @unique`).

## 9. Later-Phase Entities (to be specified before each phase)

| Phase | Entities |
|---|---|
| P2 | Specified in §9.1 (CONFIRMED, P2-00) |
| P3 | Community, Membership, CommunityPost, Conversation, ConversationParticipant, Message, HelpRequest, HelpResponse, Session (rename to `CreativeSession` to avoid clashing with Auth.js `Session`) |
| P4 | AIConversation, AIMessage, AIUsage (retention policy required) |

### 9.1 Phase 2 models (CONFIRMED — P2-00 approved 2026-10-28)

Requirements: PRODUCT_REQUIREMENTS §6.1. Changes to the earlier list: **Reaction → `PostLike`** (single like, no reaction types); **no `ModerationAction` table** — moderation is recorded in the existing `AuditLog` (as P1 reports are); **`Report` already exists** (P1) and gains target types. User posts reuse `Post` and its child tables unchanged.

```prisma
enum Role              { USER MODERATOR ADMIN }              // + MODERATOR
enum ReportTargetType  { SKILL PROFILE POST COMMENT }         // + POST, COMMENT
enum ReportReason      { OFFENSIVE SPAM IMPERSONATION NOT_MY_WORK OTHER }   // + NOT_MY_WORK (OD-05)
enum ProjectStatus     { IN_PROGRESS COMPLETED }
enum ProjectVisibility { PRIVATE PUBLIC }                     // default PRIVATE
enum NotificationType  { COMMENT REPLY FOLLOW LIKE }
// User posts have no PostAttribution row: authorId + ownWorkConfirmedAt identify them, so
// SourceType.USER_UPLOAD stays unused (removed in the P2 migration if still unused).

model Post {                    // added fields only
  ownWorkConfirmedAt DateTime?  // CRT-08; set on first publish by a user
  hiddenAt           DateTime?  // MOD-04; hidden after a report (null = visible)
  projectId          String?    // JRN-05; post shared from a project (onDelete: SetNull)
  tags     PostTag[]
  comments Comment[]
  likes    PostLike[]
}

model Tag {
  id             String  @id @default(cuid())
  name           String  @db.VarChar(30)          // as first typed, lowercased
  normalizedName String  @unique                  // NFKC + lowercase, as custom skills
  posts PostTag[]
}

model PostTag {
  postId String
  tagId  String
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Restrict)
  @@id([postId, tagId])
  @@index([tagId])
}

model Comment {
  id        String    @id @default(cuid())
  postId    String
  authorId  String?                             // null once the author's account is deleted ("Comment deleted" kept for its replies)
  parentId  String?                              // set on replies; a reply's parent has parentId null (service-enforced, OD-25)
  body      String    @db.VarChar(1000)
  editedAt  DateTime?
  deletedAt DateTime?                            // soft delete only when it has replies (CMT-02); otherwise hard delete
  hiddenAt  DateTime?                            // MOD-04
  createdAt DateTime  @default(now())
  post    Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  author  User?     @relation(fields: [authorId], references: [id], onDelete: SetNull)
  parent  Comment?  @relation("Replies", fields: [parentId], references: [id], onDelete: Cascade)
  replies Comment[] @relation("Replies")
  @@index([postId, parentId, createdAt])
  @@index([authorId])
}

model PostLike {
  postId    String
  userId    String
  createdAt DateTime @default(now())
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([postId, userId])
  @@index([userId])
}

model Follow {
  followerId String
  followeeId String
  createdAt  DateTime @default(now())
  follower User @relation("Following", fields: [followerId], references: [id], onDelete: Cascade)
  followee User @relation("Followers", fields: [followeeId], references: [id], onDelete: Cascade)
  @@id([followerId, followeeId])
  @@index([followeeId, createdAt(sort: Desc)])
}

model Block {
  blockerId String
  blockedId String
  createdAt DateTime @default(now())
  blocker User @relation("Blocking", fields: [blockerId], references: [id], onDelete: Cascade)
  blocked User @relation("BlockedBy", fields: [blockedId], references: [id], onDelete: Cascade)
  @@id([blockerId, blockedId])
  @@index([blockedId])
}

model Project {
  id           String            @id @default(cuid())
  ownerId      String
  title        String            @db.VarChar(80)
  skillId      String?
  sourcePostId String?                           // JRN-03 "Start as my project" (onDelete: SetNull)
  status       ProjectStatus     @default(IN_PROGRESS)
  visibility   ProjectVisibility @default(PRIVATE)
  completedAt  DateTime?
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  owner     User              @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  skill     Skill?            @relation(fields: [skillId], references: [id], onDelete: SetNull)
  entries   ProjectEntry[]
  materials ProjectMaterial[]
  @@index([ownerId, updatedAt(sort: Desc)])
}

model ProjectMaterial {                            // JRN-03 checklist copied from the tutorial
  id        String  @id @default(cuid())
  projectId String
  position  Int
  name      String  @db.VarChar(120)
  note      String? @db.VarChar(200)
  checked   Boolean @default(false)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@unique([projectId, position])
}

model ProjectEntry {
  id        String   @id @default(cuid())
  projectId String
  body      String?  @db.VarChar(2000)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  project Project             @relation(fields: [projectId], references: [id], onDelete: Cascade)
  media   ProjectEntryMedia[]
  @@index([projectId, createdAt(sort: Desc)])
}

model ProjectEntryMedia {
  entryId  String
  mediaId  String
  position Int                                     // 0–3 (JRN-02)
  entry ProjectEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  media MediaAsset   @relation(fields: [mediaId], references: [id], onDelete: Restrict)
  @@id([entryId, mediaId])
  @@unique([entryId, position])
}

model Notification {
  id          String           @id @default(cuid())
  recipientId String
  type        NotificationType
  actorId     String?                              // who commented / followed / liked (SetNull on deletion)
  postId      String?
  commentId   String?
  readAt      DateTime?
  createdAt   DateTime         @default(now())
  recipient User @relation("NotificationsReceived", fields: [recipientId], references: [id], onDelete: Cascade)
  @@index([recipientId, createdAt(sort: Desc)])
}

model NotificationPreference {                     // a row only when a type is switched off (NTF-04)
  userId  String
  type    NotificationType
  enabled Boolean @default(false)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([userId, type])
}
```

**Built (P2-03, migration `creative_journal`, 2026-10-29):** `Project`, `ProjectMaterial`, `ProjectEntry` (plus an optional `title` VarChar(80), design `1g`), `ProjectEntryMedia` (indexed on `media_id`), `Post.projectId` (SetNull) with the `ProjectPosts` / `ProjectSource` relations. The content module's orphan and unused-media queries treat entry photos as used (`entryMedia: { none: {} }`).

**Built so far (P2-02, migration `20261028165443_user_posts_tags`):** `Post.ownWorkConfirmedAt`, `Tag`, `PostTag` as listed (`Tag.normalizedName` = the lowercased name; no separate display case). Tag names join skill names at weight C in `search_vector`. The other §9.1 models come with their tasks.

**Rules**
- **"Own post"** = `authorId` is the user **and** the post has no `PostAttribution` row: invited creators' seeded posts also have an author, but always attribution, and stay admin-managed. An own post an admin unpublished is listed with the maker's drafts and can be shared again.
- Likes are grouped into one notification per post per day when read (NTF-01) at query time; rows stay one per like.
- Block filtering is applied in every read that returns another user's content (feed, search, post detail, comments, profiles, follower lists): a shared `notBlockedWith(actorId)` condition in the users module, used by the other modules through its public API.
- Search: `Post.searchVector` adds tag names at weight C, with skill names.
- Lifecycle additions to §7: notifications deleted after 90 days (daily job); deleting a post cascades comments, likes, tags and saves; account deletion removes likes, follows, blocks, notifications, projects and their media; the deletion job first turns the user's comments that have replies into "Comment deleted" (as CMT-02, so other people's replies stay) and deletes the rest.

