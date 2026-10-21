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

### 2.4 Sessions
- Cookies: `HttpOnly`, `Secure` (in production), `SameSite=Lax`.
- JWT callback rejects tokens whose `sessionVersion` ≠ DB value and for deleted/disabled users. (DB check per request: CONFIRMED; cache acceptable later.)
- Session max age: CONFIRMED 30 days rolling.
- Expired session → `401` from API; UI redirects to sign-in with return URL (validated as same-origin relative path to prevent open redirects).

### 2.5 Account enumeration
Register, password reset and sign-in responses must not reveal whether an email exists (identical messages and comparable response times).

### 2.6 Google OAuth
- Use `state`/PKCE as handled by Auth.js.
- Google profile data (CONFIRMED): the Google **name** pre-fills `Profile.displayName`; the Google **photo is not imported** and `User` has no name/image columns, so P1-04 overrides the adapter's `createUser`. Users upload their own avatar in Edit profile.
- Linking to existing password accounts (CONFIRMED, OD-09): automatic, because Google returns a verified email. Implemented in the Auth.js `signIn` callback (not via a blanket `allowDangerousEmailAccountLinking`): require Google `email_verified = true`; if the existing account's email was **unverified**, delete its `passwordHash`, mark the email verified and bump `sessionVersion` — this closes the account pre-hijacking attack.

### 2.7 Age
**18+ (CONFIRMED)** — dodoi is for adults only. Method (CONFIRMED, OD-07): date of birth entered at sign-up (and once after first Google sign-in); age computed server-side; only `ageConfirmedAt` is stored and the date of birth is discarded (never logged). Under-18: registration blocked, nothing stored (a Google account created moments earlier is deleted). Because every account holder is an adult, DPDP's children's-data obligations do not apply to permitted users, and the personalised feed can use behaviour signals.

## 3. Authorization

- Roles: `USER`, `ADMIN` (P1). `MODERATOR` (P2).
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

`User*` = signed-in users only, **except** published post detail and related posts, which are Public read-only (OD-29).

## 4. Input Handling and Web Vulnerabilities

| Vulnerability | Control |
|---|---|
| Injection (SQL) | Prisma parameterized queries; raw SQL only via tagged `$queryRaw` (never `$queryRawUnsafe` with user input) |
| XSS | React escaping; no `dangerouslySetInnerHTML` with user content; user text rendered as plain text; static Content Security Policy without nonces (CONFIRMED, OD-35 option A): `default-src 'self'`; scripts/styles `'self' 'unsafe-inline'` (required by Next.js without nonces); images/media from Cloudinary; uploads to `api.cloudinary.com`; `form-action` `'self'` + Google sign-in; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`; `upgrade-insecure-requests` on hosted environments. `next dev` additionally allows `'unsafe-eval'` and `ws:` for hot reload. Revisit with nonces if user-written HTML is ever rendered |
| CSRF | Auth.js CSRF for its routes; `SameSite=Lax` cookies; mutation route handlers verify `Origin` header matches app origin |
| Open redirect | Return URLs must be relative same-origin paths |
| Mass assignment | Zod schemas whitelist writable fields; never spread request bodies into Prisma calls |
| IDOR | Actor-scoped queries; 404 for invisible resources; integration tests for each protected endpoint |
| Clickjacking | `X-Frame-Options: DENY` / CSP `frame-ancestors 'none'` |
| Security headers | HSTS (production), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal |
| Unbounded requests | Body size limits; pagination max 50; search query max length |

**Implemented in P1-29:** headers in `src/lib/security-headers.ts` (applied in `next.config.ts`, resolved per `APP_ENV` at build time; `poweredByHeader: false`); `Permissions-Policy` disables accelerometer, autoplay, camera, display-capture, geolocation, gyroscope, magnetometer, microphone, payment and usb; every mutation through `withRouteHandler` is checked by `isSameOriginRequest()` (`Origin` vs public host, else `Sec-Fetch-Site`; non-browser clients allowed) and rejected with 403 `CROSS_ORIGIN_REQUEST`; return URLs pass through `toSafeReturnPath()`. CSP in `buildContentSecurityPolicy()` (same file as the headers).

## 5. Media Upload Security

- Only **signed** uploads; unsigned upload presets disabled in Cloudinary.
- Signature scoped to folder, resource type and short expiry.
- Server re-validates asset metadata from Cloudinary after upload (type, bytes, dimensions, duration) and deletes non-compliant assets.
- Allowed formats and limits: PRODUCT_REQUIREMENTS §5.8b (MEDIA-01…05).
- Strip EXIF/location metadata on delivery (Cloudinary transformation) — PROPOSED; important for privacy of user photos from P2.
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

1. User requests deletion (re-authentication required) → account **deactivated immediately**: sessions revoked (`sessionVersion`++), profile hidden from everyone, excluded from search.
2. **14-day grace period**: signing in shows "Your account is scheduled for deletion on {date}" with *Cancel deletion*.
3. After 14 days a scheduled job **hard-deletes**: User, Profile, Accounts, tokens, UserSkills, Saves, Collections, PostProgress, feed sessions/feedback, Reports filed by the user, and the Cloudinary avatar.
4. Kept, de-identified: custom skills they created (`createdById` = null), audit-log rows (`actorId` = null).
5. **Invited creators:** their seeded posts are unpublished and their media deleted from Cloudinary.
6. Unverified accounts older than 30 days (OD-08) are hard-deleted by the same job without a grace period.

## 8. Community Safety

| Phase | Controls |
|---|---|
| P1 | Admin can hide custom skills, hide profiles and unpublish posts; audit log. User reporting of custom skills and profiles (CONFIRMED, OD-12; PRODUCT_REQUIREMENTS §5.11) |
| P2 | Report posts/comments/profiles; block users (blocked users cannot see/interact; content hidden both ways); moderation queue; `ModerationAction` audit trail; MODERATOR role |
| P3 | Report messages; messaging rate limits and spam prevention; message access only for participants; community rules and moderation |
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
