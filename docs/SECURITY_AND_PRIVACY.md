# Security and Privacy

Applies from the first line of code. Security requirements are end-to-end: a feature with UI but missing server-side authorization is **not done**.

Markers: **CONFIRMED** / **PROPOSED** / **OPEN**.

---

## 1. Threat Model Summary (Phase 1)

| Asset | Threats |
|---|---|
| Accounts | Credential stuffing, brute force, account enumeration, session theft |
| Private data (email, private collections, saves, interests) | IDOR (changing IDs in URLs/requests), over-exposed API fields |
| Admin capabilities | Privilege escalation, CSRF on admin actions |
| Media pipeline | Malicious uploads, oversized files, unsigned uploads to our Cloudinary account |
| Custom interests / profiles (public UGC) | Offensive text, spam, XSS via stored text |
| Secrets | Leakage to client bundle, logs or repository |

## 2. Authentication

### 2.1 Mechanism (CONFIRMED)
Auth.js with Credentials (email/password) and Google. JWT session strategy (CONFIRMED — required by the Credentials provider).

### 2.2 Passwords
- Hash with Argon2id (CONFIRMED; bcrypt cost ≥ 12 only if the native build fails). Never store or log plaintext.
- Policy (CONFIRMED, NIST-aligned): **minimum 10 characters**, maximum 128, no composition rules, reject the user's email as password. Breached-password check: OPEN.
- Password change and reset increment `sessionVersion` → other sessions invalidated.

### 2.3 Tokens (email verification, password reset)
- 32+ bytes from a CSPRNG, URL-safe encoded; only the SHA-256 hash is stored.
- Single-use (`usedAt`), short expiry (CONFIRMED: 24h verification / 1h password reset).
- Issuing a new reset token invalidates previous unused ones.
- Reset requests do the account lookup, token and email after the response (Next.js `after()`), so the response time is the same for known and unknown emails (PROPOSED, P1-06).
- Using a reset link marks an unverified email as verified, since it proves the person owns the inbox (PROPOSED, P1-06).
- Password change keeps the device that made it signed in (fresh session cookie) and signs out all others; attempts limited to 5 / 15 min / user (PROPOSED, P1-06).

### 2.4 Sessions
- Cookies: `HttpOnly`, `Secure` (in production), `SameSite=Lax`.
- JWT callback rejects tokens whose `sessionVersion` ≠ DB value and for deleted/disabled users. (DB check per request: CONFIRMED; cache acceptable later.)
- Session max age: CONFIRMED 30 days rolling.
- Expired session → `401` from API; UI redirects to sign-in with return URL (validated as same-origin relative path to prevent open redirects).

### 2.5 Account enumeration
Password reset and sign-in responses must not reveal whether an email exists (identical messages and comparable response times). Exception (CONFIRMED by PO): a password sign-in for an account that has no password (Google sign-up) answers "Looks like you signed up with Google, so there's no password for this account. Continue with Google instead." — this reveals that the email is registered and uses Google; accepted for UX, limited by the sign-in rate limits.

**Registration exception (CONFIRMED by PO, P1-05):** registering with a taken email answers `409 EMAIL_ALREADY_REGISTERED` ("This email is already registered.", with a "Sign in instead" link) or `409 EMAIL_REGISTERED_WITH_GOOGLE` ("Looks like you signed up with Google.", with a "Continue with Google" button), and a new user is signed in straight away (F-02, OD-08). Both reveal whether an email has a dodoi account; accepted for a clearer sign-up, limited by the register rate limit (5/hour/IP).

### 2.6 Google OAuth
- Use `state`/PKCE as handled by Auth.js.
- Google profile data (CONFIRMED): the Google **name** pre-fills `Profile.displayName`; the Google **photo is not imported** and `User` has no name/image columns, so the users module creates Google users itself (P1-04). Users upload their own avatar in Edit profile. OAuth access/refresh/id tokens are not stored, since dodoi calls no Google APIs (PROPOSED in P1-04).
- Linking to existing password accounts (CONFIRMED, OD-09): automatic, because Google returns a verified email. Implemented in the Auth.js `signIn` callback (not via a blanket `allowDangerousEmailAccountLinking`): require Google `email_verified = true`; if the existing account's email was **unverified**, delete its `passwordHash`, mark the email verified and bump `sessionVersion` — this closes the account pre-hijacking attack.

### 2.7 Age
**18+ (CONFIRMED)** — dodoi is for adults only. Method (CONFIRMED, OD-07): date of birth entered at sign-up (and once after first Google sign-in); age computed server-side; only `ageConfirmedAt` is stored and the date of birth is discarded (never logged). Under-18: registration blocked, nothing stored (a Google account created moments earlier is deleted). Because every account holder is an adult, DPDP's children's-data obligations do not apply to permitted users, and the personalised feed can use behaviour signals.

## 3. Authorization

- Roles: `USER`, `ADMIN` (P1). `MODERATOR` (P2, built P2-08): works the reports queue only; everything else in `/admin` and `/api/admin/*` answers 404 to moderators; the proxy lets moderators open `/admin/reports` only. Blocks hide content both ways (profile, posts, comments, feed, search, notifications) and are read through the users module.
- **Every service function checks authorization** using the actor and the resource (ownership, visibility, role). Route handlers never rely on client-provided user IDs or roles.
- Policy functions live in `server/modules/<module>/policies.ts` and are unit tested.
- Resources not visible to the actor return **404** (private collections, unpublished posts, admin routes for non-admins).
- Queries are scoped at the data layer, e.g. `where: { id, userId: actor.id }` — never fetch-then-forget-to-check.

### Phase 1 permission matrix

| Resource | Read | Create | Update | Delete |
|---|---|---|---|---|
| Own account / profile / skills | Owner | — | Owner | Owner |
| Public profile | User* | — | — | — |
| Skill | User* | User (custom) | Admin | — (hide: Admin) |
| Post (published) | User* | Admin | Admin | Admin |
| Post (draft/unpublished) | Admin | — | Admin | Admin |
| Save | Owner | Owner | — | Owner |
| Collection (private) | Owner | Owner | Owner | Owner |
| Collection (public) | User* | — | Owner | Owner |
| Theme | User* (published) | Admin | Admin | Admin |
| Media asset | Via parent resource | Admin (+ User for avatar, PROPOSED) | Owner/Admin | Owner/Admin |
| Audit log | Admin | System | — | — |
| AI usage numbers and the companion kill switch (P4-05) | Admin only (moderators get 404) | — | Admin (switch), audited as `ai.switch_on` / `ai.switch_off` | — (usage rows hold no text and are purged after 12 months) |

`User*` = signed-in users only, **except** published post detail and related posts, which are Public read-only (OD-29).

### Phase 2 permission matrix (CONFIRMED — P2-00)

`Verified` = signed in with a verified email (OD-08). Every row also excludes users blocked either way (404). Hidden (`hiddenAt`) posts and comments are visible only to their author and Moderators.

| Resource | Read | Create | Update | Delete |
|---|---|---|---|---|
| Own post (draft) | Owner | User | Owner | Owner |
| Post (published, user's) | User* | Verified (publish) | Owner | Owner, Admin |
| Project / entries (private) | Owner | User | Owner | Owner |
| Project (public) | User* | — | Owner | Owner |
| Comment | User* (on visible posts) | Verified | Owner | Owner, the post's author |
| Like | Own state: liker; count: post's author | Verified | — | Liker |
| Follow | Lists: profile owner | Verified (public profiles only) | — | Follower |
| Block | Blocker | User | — | Blocker |
| Notification / preferences | Recipient | System | Recipient | System (90 days; built P2-07 — every read, mark-read and preference call is scoped to the signed-in user) |
| Reports queue | Moderator, Admin | User (report) | Moderator, Admin (action) | — |
| Help requests and responses (P3-03) | Signed-in members (not blocked either way; hidden ones: asker and moderators only) | Verified members (a response not on your own request) | Asker: status, helpful, delete; moderators: hide / restore via reports | Asker deletes the request with its replies and photos; account deletion removes the member's requests and responses |
| Report of an AI answer (P4-02) | Moderator, Admin: that answer's text only | The member who received it, in their own chat | Dismiss only | Report stays after the chat is deleted or purged; the text does not |
| User role | Admin | — | Admin (USER ↔ MODERATOR) | — |
| AI conversation / messages (P4) | Owner | Verified (own) | — | Owner (and the 30-day job) |
| AI consent (P4) | Owner | Owner | Owner (withdraw) | — |
| AI usage (P4) | Admin (no content) | System | — | System (12 months) |
| Media asset (post, entry) | Via parent resource | User (own) | Owner | Owner |

## 4. Input Handling and Web Vulnerabilities

| Vulnerability | Control |
|---|---|
| Injection (SQL) | Prisma parameterized queries; raw SQL only via tagged `$queryRaw` (never `$queryRawUnsafe` with user input) |
| XSS | React escaping; no `dangerouslySetInnerHTML` with user content; user text rendered as plain text; static Content Security Policy without nonces (CONFIRMED, OD-35 option A): `default-src 'self'`; scripts/styles `'self' 'unsafe-inline'` (required by Next.js without nonces); images/media from Cloudinary; `connect-src` allows uploads to `api.cloudinary.com` and delivery from `res.cloudinary.com` (the service worker fetches images to cache them, P1-27); `form-action` `'self'` + Google sign-in; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`; `upgrade-insecure-requests` on hosted environments. `next dev` additionally allows `'unsafe-eval'` and `ws:` for hot reload. Revisit with nonces if user-written HTML is ever rendered |
| CSRF | Auth.js CSRF for its routes; `SameSite=Lax` cookies; mutation route handlers verify `Origin` header matches app origin |
| Open redirect | Return URLs must be relative same-origin paths |
| Form data in URLs | Every form sends with JavaScript, but declares `method="post"`: a submit before the page's JavaScript has loaded then only reloads the page, instead of putting passwords or a date of birth in the address bar, history and server logs (found 2026-10-27; `form-method.spec.ts`). Search is the only GET form, and its field has no name |
| Mass assignment | Zod schemas whitelist writable fields; never spread request bodies into Prisma calls |
| IDOR | Actor-scoped queries; 404 for invisible resources; integration tests for each protected endpoint |
| Clickjacking | `X-Frame-Options: DENY` / CSP `frame-ancestors 'none'` |
| Security headers | HSTS (production), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal |
| Unbounded requests | Body size limits; pagination max 50; search query max length |

**Implemented in P1-29:** headers in `src/lib/security-headers.ts` (applied in `next.config.ts`, resolved per `APP_ENV` at build time; `poweredByHeader: false`); `Permissions-Policy` disables accelerometer, autoplay, camera, display-capture, geolocation, gyroscope, magnetometer, microphone, payment and usb; every mutation through `withRouteHandler` is checked by `isSameOriginRequest()` (`Origin` vs public host, else `Sec-Fetch-Site`; non-browser clients allowed) and rejected with 403 `CROSS_ORIGIN_REQUEST`; return URLs pass through `toSafeReturnPath()`. CSP in `buildContentSecurityPolicy()` (same file as the headers).

## 5. Media Upload Security

- Only **signed** uploads; unsigned upload presets disabled in Cloudinary.
- Signature scoped to folder, resource type and short expiry.
- Server re-validates asset metadata from Cloudinary after upload (type, bytes, duration; no minimum dimensions since 2026-10-29) and deletes non-compliant assets.
- Allowed formats and limits: PRODUCT_REQUIREMENTS §5.8b (MEDIA-01…05).
- Strip EXIF/location metadata on delivery (Cloudinary transformation): every delivery URL uses `f_auto,q_auto`, which re-encodes the file without EXIF/location data (P1-03).
- The Cloudinary API key has full account access (free plan keys cannot be folder-scoped), so the app only registers files under the purpose's `dodoi/<APP_ENV>/…` folder and the client refuses to delete anything outside `dodoi/` (P1-03).
- Alt text required for content images.

## 6. Rate Limiting and Abuse

| Action | Limit (CONFIRMED) |
|---|---|
| Sign-in | 10 / 15 min / IP + 5 / 15 min / email |
| Register | 5 / hour / IP |
| Password reset request | 5 / hour / IP, 3 / hour / email |
| Resend verification | 3 / hour / user |
| Custom skill creation | 10 / day / user |
| Search | 60 / min / user |
| Media signing | 30 / hour / user |
| Publish post (P2) | 20 / day / user |
| Comment (P2, built P2-04) | 30 / hour / user (`comment-create`) |
| Follow, like (P2) | 200 / hour / user each (built as `like` P2-05 and `follow` P2-06: each counts both directions together) |
| Block (P2) | 50 / day / user |
| AI messages (P4, CONFIRMED) | 30 / day and 10 / min / user (photos: 5 / day); global `AI_DAILY_REQUEST_CAP` |

Storage backend (CONFIRMED, OD-27): PostgreSQL `RateLimitBucket` table (fixed window), behind the limiter interface; expired rows purged daily. Implemented in `src/server/lib/rate-limit.ts` (P1-08): atomic `INSERT … ON CONFLICT` increment, and bucket keys are `<rule>:<sha256(subject)>` so emails and IPs are never stored in plain text. Custom-interest text rules and blocklist: PRODUCT_REQUIREMENTS §5.2 (OD-13). Additional limit: reports 10 / day / user.

## 7. Privacy

### 7.1 Data inventory (Phase 1)

| Data | Visibility | Purpose |
|---|---|---|
| Email | Private (owner, system) | Auth, transactional email |
| Password hash | Never exposed | Auth |
| Age confirmation | Private | Eligibility |
| Username, display name, avatar, bio | Public (profile default PUBLIC) | Identity |
| Skills/levels/help/learn lists | Public with profile | Discovery, recommendations |
| Saves, private collections | Private | Saving |
| Public collections | Public | Sharing |
| Feed impressions & feedback | Private, internal | Recommendations |
| Google account ID/tokens | Private | OAuth |

### 7.2 Principles
- Collect only what is needed. No phone, no address, no real name requirement.
- Explain in UI which profile fields are public.
- Public endpoints use explicit `select` projections — never return whole DB rows.
- Logs never include passwords, tokens, email addresses (use userId), private content.
- No third-party analytics or tracking scripts until OD-20 is decided; then disclose in privacy policy.
- Email is used only for transactional messages in P1 (no marketing).
- Account deletion (CONFIRMED, OD-22): see §7.3.
- Privacy policy and terms of service: OPEN (OD-26) — required before any public launch. Launch market is **India first** (CONFIRMED) → the Digital Personal Data Protection Act, 2023 and its Rules apply (consent notices, purpose limitation, data-principal rights to access/correct/erase, grievance contact, breach notification, children's data). Other markets' laws to be reviewed before expanding. Minimum age is 18+ (OD-28 resolved), so children's-data obligations are avoided for permitted users; the age-gate method (OD-07) should still be reviewed so it is a reasonable measure.

### 7.3 Account deletion lifecycle (CONFIRMED, OD-22)

1. User requests deletion (re-authentication required: the password, or for Google-only accounts a fresh Google sign-in within the last 5 minutes) → account **deactivated immediately**: sessions revoked (`sessionVersion`++), profile hidden from everyone, excluded from search. Admin accounts can't be deleted from settings.
2. **14-day grace period**: signing in is allowed but every page shows only "Your account is scheduled for deletion" (`/account-deletion`) with *Cancel deletion* and *Sign out*; every API call except cancelling answers `403 ACCOUNT_DELETION_SCHEDULED`.
3. After 14 days a scheduled job **hard-deletes**: User, Profile, Accounts, tokens, UserSkills, Saves, Collections, PostProgress, feed sessions/feedback, Reports filed by the user, and the Cloudinary avatar.
4. Kept, de-identified: custom skills they created (`createdById` = null), audit-log rows (`actorId` = null).
5. **Invited creators:** their posts are deleted, with their media deleted from Cloudinary (PO decision 2026-10-27: deleting rather than unpublishing leaves no attribution text naming them).
6. Unverified accounts older than 30 days (OD-08) are hard-deleted by the same job without a grace period.
7. Implemented in P1-28: `users/account-deletion.ts` (request, cancel), `jobs/account-cleanup.ts` (hard delete, run by `pnpm jobs:daily`). The hard delete re-checks inside its transaction, so a deletion cancelled while the job runs deletes nothing.

## 8. Community Safety

| Phase | Controls |
|---|---|
| P1 | Custom-interest blocklist matcher (`src/server/modules/skills/blocklist.ts`: whole words and phrases with character-swap folding; list = LDNOOBW English + Hinglish minus reviewed craft-safe exceptions in `blocked-terms.ts`, OD-36). Admin can hide custom skills, hide profiles and unpublish posts; audit log. User reporting of custom skills and profiles (CONFIRMED, OD-12; PRODUCT_REQUIREMENTS §5.11) |
| P2 | Report posts/comments/profiles; block users (blocked users cannot see/interact; content hidden both ways); moderation queue; `ModerationAction` audit trail; MODERATOR role |
| P3 | Report messages; messaging rate limits and spam prevention; message access only for participants; community rules and moderation. **P3-00 proposals (2026-10-30, PROPOSED):** (1) a conversation is readable by its two participants only, anyone else gets `404`, and messages never appear in logs; (2) message rate limits 30 an hour and 5 new conversations a day, 3 messages until the other side replies, and a "who can message me" setting; (3) a block ends a conversation, hides community posts and help requests both ways and cancels open sessions; (4) a message report shows the moderator only the reported message and up to 5 before it, and moderator views are audited; (5) community owners and moderators act only inside their community, every action goes to the community log (no content), and site moderators can hide a whole community; (6) names, descriptions and rules use the existing blocked-word check; (7) session links must be `https://`, are shown only to the two participants once accepted, carry an "opens another site" warning and are erased 24 hours after the session; dodoi never records or hosts calls; (8) photos in help requests and communities use new media purposes (`help`, `community`, images only, same limits as posts) and are deleted with their content; (9) account deletion removes the member's messages, requests, responses and discussion posts, and hands owned communities over (COM-08) | **Built P3-04 (sessions):** only the two people see a session (anyone else gets 404, as does a pair that blocked each other); the meeting link is shown only to them, only once accepted, and removed 24 hours after the end (a read stops showing it even before the daily job runs); links must be `https://` with a real host and no embedded password, are opened with `target="_blank" rel="noopener noreferrer"` and the note "Opens another site. Only join if you're comfortable."; dodoi never hosts, records or monitors calls; 5 waiting proposals per member; a block cancels open sessions; misuse is reported as a profile report. **Built P3-02 (messages):** only the two participants read a conversation (others and blocked pairs get 404); message text is never logged; 30 messages an hour, 5 new conversations a day, 3 before a reply; the "who can message me" setting is checked server-side on start and send; deleting a message erases its text; a report shows moderators only the reported message and up to 5 before it, each view is audited (`message.view`), and a message can only be dismissed, not hidden; account deletion removes conversations and messages. **Built P3-01 (communities):** names, descriptions and rules use the blocked-word check; moderators act only inside their own community (a role in another community, or none, answers `403 NOT_MANAGER`); every moderator action is logged without content; hidden communities and posts are not found; blocked members' posts and replies are hidden both ways; discussion photos use the `community` purpose and are deleted with their post; account deletion hands over or deletes owned communities (COM-08). Posts and replies are limited to 30 an hour per member (PO to confirm)
| P4 | AI moderation and safety per AI_INTEGRATION.md |

## 9. Secrets Management

- `.env.local` is git-ignored; `.env.example` contains placeholders only.
- Server-only modules import `server-only`; client code may read only `NEXT_PUBLIC_*`.
- Every environment (local, test, production) has its own secrets; a secret is never reused across environments. Hosted secrets live only in the host's secret store.
- Rotate any secret that is accidentally committed; enable GitHub secret scanning and push protection on the repository (OD-24: GitHub).

## 10. Security Checklist per Feature (copy into PR/summary)

- [ ] Inputs validated with Zod at route boundary
- [ ] Authentication required where needed
- [ ] Authorization enforced in service, actor-scoped queries
- [ ] Private resources return 404 to non-owners
- [ ] Public responses use explicit field selection
- [ ] Rate limit applied if the action is abusable
- [ ] No secrets or sensitive data in logs or client
- [ ] Integration test for unauthorized access

### AI companion safety and privacy (P4-00, approved 2026-10-29)

- **Free tier: local and test only (PO, changed 2026-10-29 from "local only"):** Google's free ("unpaid") Gemini quota lets Google use submitted content to improve its products and human reviewers may read it. The test site may use it with testers who are told so (a notice in the companion and in the consent sheets while `AI_TIER=free`); no real users' data goes through it, because the test site has none. The server refuses `AI_TIER=free` when `APP_ENV=production`, which needs `AI_TIER=paid` (no-training terms).
- Provider keys are server-only; the browser never calls the provider. Logs never contain prompt text, answers or images (usage rows hold counts only).
- Photos go to the provider only after `AI_IMAGES` consent and are shrunk first; profile context only after `AI_PROFILE_CONTEXT` consent. Private collections, messages, emails and other users' private data are never in a prompt (PO). Authorization runs before anything is placed in a prompt.
- Provider safety filters are on for every request (block medium and above). A blocked request returns a neutral message, is stored as BLOCKED and counted in usage.
- Prompt injection: user text, post text and skill text are delimited as data; the system prompt says to ignore instructions inside them; answers are length-limited and links are limited to dodoi skill pages.
- Retention 30 days (deletable anytime); the retention job, deletion of photos with conversations, and removal on account deletion are covered by tests.

