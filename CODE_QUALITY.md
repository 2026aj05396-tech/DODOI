# Code Quality Standards — dodoi

**Status:** Adopted before implementation. The repository contains documentation only; there is no `package.json`, `tsconfig.json` or lint config yet. These standards are written against the stack recorded in [README §2](README.md#2-confirmed-decisions-decision-log) and [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) and become enforceable from task **P0-01** (scaffold).

**Scope:** every line of code written or changed in this repository, by a person or an AI agent.

**Relationship to other docs**
- This file is the single source of truth for *how code is written*.
- [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) defines *what the system is* (stack, modules, data flow). If the two disagree, stop and ask — do not pick one silently.
- [docs/AI_DEVELOPMENT_RULES.md](docs/AI_DEVELOPMENT_RULES.md) defines *how agents work* (workflow, honesty, definition of done) and must be followed together with this file.
- [docs/UI_UX_GUIDELINES.md](docs/UI_UX_GUIDELINES.md) defines tokens, components and visual rules.

**Markers:** **CONFIRMED** — decided. **PROPOSED** — depends on a tool or library not yet approved (SYSTEM_ARCHITECTURE §3); follow the rule's intent, enforce it once the tool is approved.

### Stack baseline

| Concern | Choice | Status |
|---|---|---|
| Framework | Next.js App Router | CONFIRMED |
| Language | TypeScript, `strict: true` | CONFIRMED |
| Styling | Tailwind CSS + shadcn/ui (Radix) | CONFIRMED |
| Backend | Route Handlers + service layer in the same app (modular monolith) | CONFIRMED |
| Database | PostgreSQL + Prisma | CONFIRMED |
| Auth | Auth.js (Credentials + Google) | CONFIRMED |
| Tests | Vitest + Testing Library, Playwright + axe | CONFIRMED |
| Package manager | pnpm | CONFIRMED |
| Runtime validation | Zod | CONFIRMED |
| Client data fetching / cache | TanStack Query | CONFIRMED |
| Forms | React Hook Form | CONFIRMED |
| Lint / format | ESLint (Next config) + Prettier + `prettier-plugin-tailwindcss` + `eslint-plugin-import` | CONFIRMED |

---

## 1. Core Engineering Principles

These are mandatory. When two principles conflict, the earlier one in this list wins.

| # | Principle | Apply it when | Do not use it to justify |
|---|---|---|---|
| 1 | **Consistency over preference** | Always. Match the existing pattern even if you would personally write it differently. | Keeping a pattern that is documented as wrong — raise it instead. |
| 2 | **Readability over cleverness** | Always. Code is read far more than written; optimise for the next reader (often an AI agent with no context). | Verbose code — clear and short beats clear and long. |
| 3 | **Simplicity over abstraction** | Start with the most direct implementation that meets the requirement. | Copy-pasting logic that is already duplicated twice (see DRY). |
| 4 | **Single responsibility / separation of concerns** | Each file, function, component and module has one reason to change. | Splitting a 20-line function into five 4-line helpers that are only used once. |
| 5 | **DRY, without overengineering** | The *same knowledge* (a business rule, a constant, a type, a validation) exists in more than one place. | Merging code that merely *looks* similar but represents different concepts (see §10). |
| 6 | **Explicit dependencies, predictable behaviour** | Functions receive what they need as parameters (e.g. `actor`, `clock`, `db`); no hidden globals, no hidden side effects. | Dependency-injection frameworks — plain parameters and module imports are enough. |
| 7 | **SOLID, where it fits** | Mainly *S* (single responsibility) and *D* (depend on interfaces for replaceable integrations: email, media, AI — SYSTEM_ARCHITECTURE §4.8). | Class hierarchies, interfaces with one implementation that will never be swapped, or factories for plain objects. |
| 8 | **No premature optimisation** | Optimise after measuring (Core Web Vitals, query plans, profiler). | Skipping obvious efficiency basics: pagination, indexes for real queries, responsive images. |

### When abstraction is *not* justified
- It has one caller and no second caller is planned in the current or next roadmap phase.
- Its interface is harder to understand than the code it hides.
- It needs boolean flags or many optional parameters to serve its callers (`isAdmin`, `variant`, `mode`, `skipX`…) — that usually means two different things were merged.
- It exists "for the future". Build for the documented roadmap, not for imagined requirements.

**Rule of three:** first time, write it. Second time, note the duplication. Third time (or the second time for business rules, validation and types), extract it.

---

## 2. Naming Conventions

Names must say what a thing **is** or **does**, in plain English, without the reader opening the implementation. Prefer domain words from the docs: *post, skill, interest, collection, save, theme, feed session, attribution, profile*.

### 2.1 General rules
- No ambiguous abbreviations. Allowed: `id`, `url`, `api`, `db`, `ui`, `env`, `props`, `ref`, `min`/`max`, `config`. Not allowed: `usr`, `coll`, `pst`, `btn`, `msg`, `cb`, `res`/`req` outside route-handler signatures, `tmp`, `obj`.
- Avoid generic names when a precise one is practical: `data`, `item`, `value`, `info`, `result`, `stuff`, `manager`, `helper`, `handle`, `process`, `doStuff`.
- A name must not lie. `getPost` must not create anything; `isValid` must not mutate.
- Use the same word for the same concept everywhere. It is a **save** (not bookmark/favourite/pin); a **skill** (an *interest* is a user's relation to a skill); a **collection** (not board/folder); a **post** (not pin/item/content).
- Singular for one, plural for many: `post`, `posts`, `postIds`.

### 2.2 Files and folders

| Kind | Convention | Good | Bad |
|---|---|---|---|
| Folders | `kebab-case` | `feed-session/`, `collections/` | `FeedSession/`, `feed_session/` |
| TS / TSX files | `kebab-case` | `post-card.tsx`, `rank-feed.ts` | `PostCard.tsx`, `rankFeed.ts` |
| One React component per file | file named after the component | `post-card.tsx` → `export function PostCard` | `components.tsx` with 6 exports |
| Next.js special files | framework names, unchanged | `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`, `manifest.ts`, `middleware.ts` | `PostPage.tsx` inside `app/` |
| Dynamic route segments | `[camelCaseParam]` | `p/[postId]/`, `u/[username]/` | `p/[id]/`, `p/[post_id]/` |
| Route groups | `(kebab-case)` | `(auth)/`, `(app)/` | `(Auth)/` |
| Server module files (fixed set) | `index.ts`, `service.ts`, `repository.ts`, `schemas.ts`, `policies.ts`, `types.ts` | `server/modules/collections/policies.ts` | `collections-utils.ts`, `helpers.ts` |
| Tests | `<file>.test.ts(x)` next to the file; E2E `<flow>.spec.ts` in `tests/e2e/` | `rank-feed.test.ts`, `save-and-collect.spec.ts` | `test-feed.ts`, `__tests__/a.ts` |
| Styles | `kebab-case.css` | `tokens.css` | `Tokens.css` |

### 2.3 Code identifiers

| Kind | Convention | Good | Bad |
|---|---|---|---|
| Variables | `camelCase`, noun | `savedPosts`, `nextCursor` | `sp`, `data2` |
| Booleans (vars, props, state) | `is`/`has`/`can`/`should` + adjective/verb | `isSaved`, `hasMore`, `canEdit`, `shouldShowAttribution` | `saved`, `flag`, `edit` |
| Module constants | `SCREAMING_SNAKE_CASE` | `MAX_PAGE_SIZE`, `FEED_DISCOVERY_QUOTA` | `maxPageSize` (for a true constant) |
| Constant objects/maps | `SCREAMING_SNAKE_CASE` + `as const` | `POST_TYPE_LABELS` | `labels` |
| Functions | `camelCase`, verb first | `rankFeedCandidates`, `normalizeSkillName` | `feed`, `skillNameNormalizer` |
| Event handler (inside component) | `handle` + subject + event | `handleSaveClick`, `handleFilterChange` | `handle`, `onClick2`, `clickHandler` |
| Event prop (component API) | `on` + subject + event/verb | `onSave`, `onFilterChange` | `handleSave` as a prop, `callback` |
| React components | `PascalCase`, noun | `PostCard`, `CollectionPicker` | `RenderPost`, `postCard` |
| Custom hooks | `use` + subject, file `use-*.ts` | `useSavedPosts` in `use-saved-posts.ts` | `savedPostsHook`, `useData` |
| Types / interfaces | `PascalCase`, no `I`/`T` prefix | `PostCard`, `FeedItem`, `Actor` | `IPost`, `TPost`, `PostInterface` |
| Component props type | `<Component>Props` | `PostCardProps` | `Props` exported from many files |
| Union string literal values | `SCREAMING_SNAKE_CASE` when they mirror Prisma enums; otherwise `kebab-case` for URL-facing keys | `"WORK_IN_PROGRESS"`, `"new-to-you"` | `"wip"`, `"NewToYou"` |
| Generics | descriptive when more than one, `T` acceptable for a single obvious one | `TItem`, `TCursor` | `A`, `B`, `X` |

### 2.4 Server, API and data naming

| Kind | Convention | Good |
|---|---|---|
| Service functions | verb + noun, matching intent | `getPostDetail`, `listSavedPosts`, `createCollection`, `deleteCollection`, `resolveCustomSkill` |
| Repository functions | data-access verbs | `findPostById`, `findManyPublishedPosts`, `insertSave`, `deleteSaveByUserAndPost` |
| Policy functions | `can` + action | `canViewCollection(actor, collection)` |
| Verb vocabulary | `get` = one, throws `NotFoundError` if missing · `find` = one or `null` · `list` = many (paginated) · `create`/`update`/`delete` · `resolve` = find-or-create | — |
| Zod schemas | `camelCase` + `Schema` | `createCollectionInputSchema` |
| Types inferred from schemas | `PascalCase`, same stem | `CreateCollectionInput = z.infer<typeof createCollectionInputSchema>` |
| Request body types | `<Action><Resource>Input` | `UpdateProfileInput` |
| Response types | named after the view of the resource (API_SPECIFICATION §2) | `PostCard`, `PostDetail`, `SkillSummary` |
| Error classes | `PascalCase` + `Error` | `ForbiddenError`, `RateLimitError` |
| Error codes (API) | `SCREAMING_SNAKE_CASE` | `USERNAME_TAKEN` |
| API paths | plural, `kebab-case` | `/api/feed/feedback`, `/api/me/skills` |
| JSON fields | `camelCase` | `nextCursor`, `isSaved` |

### 2.5 Environment variables
- `SCREAMING_SNAKE_CASE`, grouped by prefix of the service: `AUTH_*`, `CLOUDINARY_*`, `RESEND_*`, `SMTP_*`.
- Only variables prefixed `NEXT_PUBLIC_` reach the browser; they must never contain secrets.
- Every variable is declared in `.env.example` and validated once in `src/server/lib/env.ts` (client-safe ones in `src/lib/env-client.ts`). Code imports from those modules, never reads `process.env` directly elsewhere.

### 2.6 Database (Prisma)
- Models: `PascalCase`, singular (`Post`, `CollectionItem`), mapped to `snake_case` tables with `@@map`.
- Fields: `camelCase`, mapped to `snake_case` columns with `@map`.
- Foreign keys: `<relation>Id` (`authorId`, `postId`).
- Booleans: `is`/`has` prefix (`isPrimary`, `isPublished`).
- Timestamps: `createdAt`, `updatedAt`, `<event>At` (`publishedAt`, `deletionRequestedAt`).
- Enum names `PascalCase`, values `SCREAMING_SNAKE_CASE` (`PostStatus.PUBLISHED`).
- Source of truth for names: [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md).

### 2.7 Tests
- `describe` = the unit under test (`describe("rankFeedCandidates")`); `it` = behaviour in plain English (`it("excludes posts already served in the session")`).
- Factories: `build<Model>` returns an in-memory object; `create<Model>` persists it (`buildPost`, `createUser`).
- Fakes: `Fake<Interface>` (`FakeEmailProvider`). Test helpers live in `tests/helpers/`.

---

## 3. Project Structure and Module Organization

### 3.1 Folder structure

This matches [SYSTEM_ARCHITECTURE §5](docs/SYSTEM_ARCHITECTURE.md#5-folder-structure). The three folders marked **(added)** were approved and added to SYSTEM_ARCHITECTURE §5 in P0-01.

```
src/
├── app/                         # Routing only: pages, layouts, route handlers
│   ├── (marketing)/ (auth)/ (app)/ admin/
│   └── api/                     # Route handlers: authenticate → validate → call service → respond
├── components/
│   ├── ui/                      # shadcn primitives, restyled with tokens. No domain knowledge.
│   ├── layout/                  # App shell: header, bottom tab bar, sidebar, right rail
│   └── <domain>/                # feed/, post/, collections/, profile/, onboarding/, skills/, admin/
│                                #   domain components + their hooks (use-*.ts) + local helpers
├── hooks/                       # (added) Hooks with no domain knowledge: use-media-query, use-online-status
├── server/                      # Server-only. Never imported by client components.
│   ├── auth/                    # Auth.js config, session helpers, password hashing
│   ├── db/                      # Prisma client singleton
│   ├── modules/<module>/        # Business modules (users, skills, content, feed, search, collections, admin)
│   ├── integrations/<kind>/     # email/, media/, ai/ — interface (types.ts) + provider implementation
│   └── lib/                     # errors, logger, env, rate-limit, pagination, route-handler wrapper
├── lib/                         # Shared by client and server; must be safe in both
│   ├── api-client/              # (added) Typed fetch wrapper + one file per API area (feed.ts, saves.ts…)
│   ├── schemas/                 # Zod schemas = API contracts (imported by route handlers and forms)
│   ├── types/                   # Shared types not owned by a schema (e.g. FeedItem view types)
│   ├── constants/               # (added) Cross-cutting constants: routes, limits, post-type labels
│   └── utils/                   # Pure helpers: cn(), format-date, format-duration
└── styles/                      # globals.css, tokens.css
prisma/                          # schema.prisma, migrations/, seed/
tests/                           # integration/, e2e/, helpers/
```

### 3.2 Server module layout (fixed)

Every `server/modules/<module>/` uses the same files. Create only the ones the module needs.

| File | Responsibility | May import |
|---|---|---|
| `index.ts` | **Public API** of the module — the only file other code may import | `service.ts`, `types.ts` |
| `service.ts` | Business rules, orchestration, authorization calls | own `repository`, `policies`, `schemas`, `types`; other modules' `index.ts`; `server/lib`; `server/integrations/*/types` |
| `repository.ts` | Prisma queries for this module's tables only | `server/db`, own `types` |
| `policies.ts` | Pure authorization functions `can…(actor, resource)` | own `types` |
| `schemas.ts` | Module-internal validation (API contracts live in `src/lib/schemas`) | `zod` |
| `types.ts` | Module types | — |
| `*.test.ts` | Tests next to the code | anything in the module |

### 3.3 Placement rules

| Thing | Put it in | Not in |
|---|---|---|
| Component used by one domain | `components/<domain>/` | `components/ui/` |
| Component used by 2+ domains, domain-free | `components/ui/` (primitive) or `components/layout/` (shell) | copied into each domain |
| Component used by 2+ domains but domain-aware (e.g. `PostCard` in feed, search, saved) | the owning domain (`components/post/`) and imported from there | `components/ui/` |
| Hook tied to a domain | next to its components: `components/<domain>/use-*.ts` | `hooks/` |
| Domain-free hook | `hooks/` | a domain folder |
| Business rule | `server/modules/<module>/service.ts` or `policies.ts` | components, route handlers, repositories |
| API request/response schema | `lib/schemas/<area>.ts` | inline in a route handler |
| Client call to an API endpoint | `lib/api-client/<area>.ts` | `fetch()` inside a component |
| Pure formatting helper | `lib/utils/` | a component file (if reused) |
| Constant used in one file | that file (top, `SCREAMING_SNAKE_CASE`) | `lib/constants/` |
| Constant used across areas | `lib/constants/` | duplicated literals |

### 3.4 Boundaries
- `app/` contains routing and composition only — no business logic, no Prisma, no raw `fetch` to third parties.
- A module never imports another module's `service.ts`, `repository.ts` or `policies.ts` — only its `index.ts`.
- A module never queries another module's tables. Need posts in the feed module? Call `content` module's public function.
- `components/<domainA>/` may import from `components/<domainB>/` only through that domain's exported components (no reaching into its local helpers).
- `components/ui/`, `hooks/` and `lib/` never import from `components/<domain>/`, `server/` or `app/`.
- `server/**` never imports from `components/` or `app/`.
- No circular imports, at any level.
- Maximum folder depth under `src/`: 4 levels as a guideline (`src/server/modules/feed/service.ts`). Deeper usually means a missing module boundary.
- No `index.ts` barrel files except a server module's public `index.ts` and `components/ui/` if shadcn tooling requires it. Barrels elsewhere hide dependencies and cause cycles.

---

## 4. Architecture and Separation of Concerns

### 4.1 Layers and allowed dependency direction

```
           Client                                   Server
┌─────────────────────────────┐        ┌───────────────────────────────────────┐
│ app/ pages & layouts        │        │ app/api/* route handlers               │
│   (Server Components)       │──────► │   authenticate · validate · respond    │
│        │                    │ reads  │                │                      │
│        ▼                    │ via    │                ▼                      │
│ components/<domain>/        │ module │ server/modules/<m>/index → service     │
│   (Client Components)       │ index  │        │            │                  │
│        │                    │        │        ▼            ▼                  │
│        ▼                    │        │   repository    policies              │
│ lib/api-client ── HTTP ─────┼──────► │        │                               │
│ hooks/ · components/ui/     │        │        ▼                               │
│ lib/schemas · lib/utils     │        │ server/db · server/integrations · lib  │
└─────────────────────────────┘        └───────────────────────────────────────┘
          Arrows point from caller to callee. Never the reverse.
```

Allowed:
- Server Component page → server module `index.ts` (reads). → components (render).
- Client Component → `lib/api-client` → `/api/*` (reads and all mutations).
- Route handler → server module `index.ts`.
- Service → own repository, policies; other modules' `index.ts`; integrations via interface.

Forbidden:
- Any client file → `server/**` (enforced by `import "server-only"` in server entry files).
- Route handler or page → `repository.ts` or Prisma.
- Repository → service (repositories are dumb data access).
- Service → `NextRequest`/`NextResponse`/cookies (services are framework-free and testable with plain arguments).

Mutations use `/api/*` route handlers; **Server Actions are not used** (SYSTEM_ARCHITECTURE §4.5).

### 4.2 Responsibilities

| Layer | Owns | Must not |
|---|---|---|
| **`components/ui/`** (presentational primitives) | Look, states, accessibility of a generic control | Know about posts, users, API, routes |
| **Domain components** | Rendering a domain concept, wiring user events to hooks | Contain business rules, call `fetch`, transform API data beyond display formatting |
| **Pages / layouts** (`app/`) | Composition, reading data via module `index.ts` in Server Components, metadata | Contain business logic or reusable UI |
| **Hooks** | Reusable client state and side effects (queries, mutations, optimistic updates) | Render UI; contain server rules |
| **`lib/api-client`** | HTTP calls, parsing responses, turning error JSON into a typed `ApiError` | Show toasts or navigate |
| **Route handlers** | Authenticate, parse input with Zod, call one service function, map result/errors to HTTP | Contain business rules or Prisma calls |
| **Services** | Business rules, authorization (with explicit `actor`), orchestration, transactions | Know about HTTP |
| **Policies** | Pure yes/no permission decisions | Query the database |
| **Repositories** | Prisma queries, explicit `select` projections | Make permission or business decisions |
| **Integrations** | Talking to Cloudinary, Resend or SMTP, (AI) behind an interface | Leak provider types into services |
| **`server/lib`** | Errors, logger, env, rate limiting, pagination, route wrapper | Contain domain logic |

### 4.3 Authentication, authorization, route protection
- **Middleware** redirects unauthenticated users away from `(app)` and `admin` route groups. It is a convenience, not a security boundary.
- **Route handlers** obtain the session and build an `Actor` (`{ id, role }` or `null`).
- **Services** receive `actor` as the first parameter and call policies. Every query is scoped (`where: { id, userId: actor.id }`).
- Invisible resources throw `NotFoundError` (→ 404), never reveal existence.
- Client-side checks (hiding a button) are UX only and never replace server checks.

### 4.4 Error handling and logging (summary — details §9)
- Services throw `AppError` subclasses; the single route wrapper maps them to the API error format.
- Unknown errors → logged with `requestId`, returned as generic 500.
- Logs go through `server/lib/logger.ts`; `console.log` is not allowed in committed code.

### 4.5 Keeping the architecture from degrading
- New feature = new module folder or extension of an existing module; never "misc" or "common" folders.
- If you need something from another module that its `index.ts` does not expose, add a function to that module's public API — don't reach in.
- If a rule here blocks a reasonable change, propose a change to this document instead of working around it.
- Boundary rules are enforced by tooling (§12) and checked in review (§17).

---

## 5. Reusable Component Standards

### 5.1 Three kinds of components

| Kind | Location | Example | Rules |
|---|---|---|---|
| **Shared primitive** | `components/ui/` | `Button`, `Chip`, `SearchField`, `Sheet`, `Skeleton` | Domain-free, fully token-styled, variants via shadcn's `cva` pattern, no data fetching |
| **Shared shell** | `components/layout/` | `BottomTabBar`, `Sidebar`, `RightRail`, `ComingSoonItem` | App-wide structure, no domain data |
| **Domain component** | `components/<domain>/` | `PostCard`, `CollectionPicker`, `InterestPicker`, `FeedFilterBar` | Knows the domain type, composes primitives, gets data through props or a domain hook |
| **Page composition** | `app/**/page.tsx` | feed page | Arranges domain components; holds no reusable UI |

Before creating a component, check `components/ui/`, the domain folder and [UI_UX_GUIDELINES §4](docs/UI_UX_GUIDELINES.md#4-components-from-design). Reuse first, extend second, create third.

### 5.2 Rules
- **Props are explicit and typed** with an exported `<Component>Props` type. No `any`, no spreading unknown objects into DOM elements except `...rest` of a documented native element type (`ComponentPropsWithoutRef<"button">`).
- **Prefer composition over configuration.** Accept `children` or slot props instead of growing boolean flags.
- **Warning sign:** more than ~8 props, or 3+ boolean props that change layout → split or compose.
- **Controlled where state is shared**, uncontrolled only for purely local UI state.
- **Every data-driven component handles its states**: loading (skeleton matching final size), empty, error (with retry), disabled, success. Use the shared `Skeleton`, `EmptyState`, `ErrorState` components — do not hand-roll new ones.
- **Accessible by default:** semantic element, label, keyboard support, visible focus, `aria-*` where a native element is not enough.
- **Responsive by default:** mobile-first Tailwind classes; no fixed pixel widths except where the design defines them (sidebar 232px, rail 300px).
- **Styled with tokens only** (§11).
- **No data fetching inside `components/ui/`.** Domain components fetch via hooks; primitives never fetch.

### 5.3 Good boundaries

```tsx
// components/post/post-card.tsx — domain component, composes primitives
export type PostCardProps = {
  post: PostCard;               // API view type from lib/types
  onSaveToggle: (postId: string, nextIsSaved: boolean) => void;
};

export function PostCard({ post, onSaveToggle }: PostCardProps) {
  return (
    <article className="flex flex-col gap-2">
      <PostMedia media={post.coverMedia} />
      <PostTypeBadge type={post.type} />
      <SaveButton isSaved={post.isSaved} onToggle={(next) => onSaveToggle(post.id, next)} />
      <h3 className="text-card-title">{post.title}</h3>
      <PostMeta creator={post.creator} attribution={post.attribution} skills={post.skills} />
    </article>
  );
}
```

```tsx
// Bad: one component fetching, deciding permissions, transforming and rendering
export function PostCard({ id }: { id: string }) {
  const [data, setData] = useState<any>();
  useEffect(() => { fetch(`/api/posts/${id}`).then(r => r.json()).then(setData); }, []);
  const canSave = data?.status === "PUBLISHED" && session?.user;   // business rule in UI
  ...
}
```

### 5.4 When similar UI should stay separate
Keep two components separate when they represent **different concepts that may evolve independently**, even if they look alike today:
- `ThemeCard` (curated theme tile) vs `CollectionTile` (user collection with mosaic cover and privacy label).
- `HelpRequestCard` vs `PostCard`.
- The "New to you" `SkillSuggestionCard` vs `PostCard` in the feed.

Share the *primitives* underneath (pattern tile, chip, card container) instead of forcing one generic `Card` with a `type` prop.

---

## 6. TypeScript and Type Safety

### 6.1 Compiler baseline (set in P0-01, never weakened)

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": false,   // PROPOSED: keep off unless the team opts in
    "forceConsistentCasingInFileNames": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

Weakening any option to make code compile is not allowed. Fix the code.

### 6.2 Rules
- **No `any`.** Use precise types, generics, or `unknown` + narrowing. (`@typescript-eslint/no-explicit-any`: error.)
- **No unsafe assertions.** `as` only after a runtime check, or for well-known library typing gaps — with a comment. Never `as unknown as X`.
- **No non-null `!`** unless an invariant guarantees it, with a short comment explaining why.
- **No `@ts-ignore`.** `@ts-expect-error` only with a reason and a task/issue reference.
- **One source per type.**
  - API contracts: Zod schema in `lib/schemas` → `z.infer` type. Do not hand-write a duplicate interface.
  - Database types: Prisma generated types stay **inside repositories/services**. API responses use the view types (`PostCard`, `PostDetail`), produced by explicit mapping — Prisma models never leak to the client.
  - Domain-wide view types: `lib/types`.
- **Nullable and optional are explicit.** `string | null` means "known to be empty"; `?:` means "may not be provided". Handle both at the point of use; no truthiness checks on numbers/strings where `0`/`""` are valid.
- **Validate at boundaries:** request bodies and query strings (Zod in route handlers), environment variables (at startup), third-party responses (Cloudinary metadata), `localStorage`, URL params. Inside the boundary, trust the types.
- **Exhaustive switches** over unions use a `never` check:
  ```ts
  function assertNever(value: never): never { throw new Error(`Unhandled value: ${String(value)}`); }
  ```
- **Return types:** explicit on exported service, repository and api-client functions; inferred elsewhere.
- Prefer `type` aliases; use `interface` only when declaration merging is required (e.g. Auth.js session augmentation).
- Prefer string literal unions (or Prisma enums) over TS `enum`.

---

## 7. Functions, Components, and File Size

No absolute line limits. These are **review thresholds**: crossing one requires either a split or a one-line justification in the PR/session summary.

| Unit | Review when… | Usual fix |
|---|---|---|
| Function | > ~40 lines, > 3 levels of nesting, > 4 parameters | Early returns; extract a named step; pass an options object |
| Component | > ~150 lines of JSX+logic, > 5 `useState`, > 2 `useEffect` | Extract a hook; split into child components |
| File | > ~300 lines, or two unrelated reasons to change | Split by responsibility |
| Module `service.ts` | > ~400 lines | Split into `service/<capability>.ts` files re-exported by `index.ts` |
| Props | > ~8, or 3+ layout-changing booleans | Composition (§5.2) |

Guidelines:
- **One level of abstraction per function.** `rankFeed` calls `scoreCandidate`, `applyDiscoveryQuota`, `applyDiversity` — it does not also build SQL.
- **Early returns** over nested `if/else`.
- **Name complex conditions:** `const isOwnPrivateCollection = …` instead of a 4-part inline expression.
- **Pure functions** for ranking, scoring, normalization, formatting — they are easiest to test.
- **Extract only when it helps**: reuse, testability, or a name that explains intent. A one-line wrapper around a library call that adds nothing is not allowed.
- **No flag arguments** that switch behaviour (`createPost(input, true)`); write two functions or use a named option.

---

## 8. State Management and React Practices

### 8.1 Server vs Client Components (App Router)
- Components are **Server Components by default.** Add `"use client"` only to the smallest component that needs state, effects, browser APIs or event handlers.
- Do not mark a whole page `"use client"` to make one button interactive — extract the button.
- Server Components read data through server module `index.ts`; Client Components through hooks backed by `lib/api-client`.

### 8.2 Where state lives

| State | Tool |
|---|---|
| Server data (feed, saves, collections, profile) | Server Component props for first render; **TanStack Query** for client caching, pagination, optimistic updates (PROPOSED) |
| URL-representable state (search query, active feed filter, tab) | URL search params — shareable and survives refresh |
| Form state | React Hook Form + Zod resolver (PROPOSED) |
| Local UI state (open sheet, hover, input text) | `useState` in the component that owns it |
| Session | Auth.js session helpers |
| App-wide client state | Avoid. If truly needed, a small React Context with a narrow purpose (e.g. online status). No global store library unless approved. |

### 8.3 Rules
- **Don't duplicate derived state.** Compute it during render (`const selectedCount = interests.filter(...).length`), memoize only if measured as expensive.
- **Effects are for syncing with external systems** (subscriptions, browser APIs). Not for: transforming data for render, reacting to a user event (do it in the handler), or fetching (use the query layer).
- **Correct dependencies, always.** `react-hooks/exhaustive-deps` is an error. Never silence it; restructure instead.
- **Clean up** subscriptions, timers, listeners and in-flight requests (`AbortController`) in effect cleanup.
- **Stable keys:** the entity id (`post.id`). Never array index for lists that can reorder, filter or paginate.
- **Prop drilling:** fine for 2 levels. Beyond that, prefer composition (pass rendered children) before Context.
- **Re-renders:** don't add `useMemo`/`useCallback`/`memo` by default. Add them when profiling shows a problem or when a stable reference is required by a dependency array or memoized child.
- **Optimistic updates** only for low-risk reversible actions (save, unsave, not interested), always with rollback and a toast on failure (UI_UX §5).
- **Custom hooks** return a small, named API (`{ posts, isLoading, error, loadMore, hasMore }`), not a raw tuple of 6 values.

---

## 9. API, Data, and Error Handling

### 9.1 Server side
- **One route-handler wrapper** (`server/lib/route-handler.ts`) handles: request id, auth/session lookup, Zod parsing, `AppError` → HTTP mapping, logging. Every handler uses it.
- Handler shape — thin and identical everywhere:
  ```ts
  export const POST = withRouteHandler({ auth: "user", body: createCollectionInputSchema },
    async ({ actor, body }) => created(await collections.createCollection(actor, body)));
  ```
- **Error format** is defined once (API_SPECIFICATION §1.2). Never return ad-hoc `{ message }` shapes.
- **Never expose internals:** no stack traces, SQL, Prisma error messages or provider errors in responses.
- **Explicit `select`** in repositories for anything returned to clients.
- **Pagination** via the shared cursor helpers; max page size enforced server-side.
- **Idempotency** where the API spec requires it (PUT/DELETE saves, feedback).

### 9.2 Client side
- **All HTTP goes through `lib/api-client/http.ts`**: base URL, JSON headers, credentials, timeout, `AbortSignal` support, parsing the error format into a typed `ApiError { code, message, fields, requestId, status }`.
- One file per API area (`lib/api-client/saves.ts` exporting `saveApi.save(postId)`, etc.). Components never call `fetch` directly.
- **Parse untrusted responses** where shape matters (Zod or a type guard). Unexpected shape → treated as an error, not cast.
- **Cancel** stale requests (search-as-you-type, filter changes) via `AbortController` or the query layer.
- **User-facing messages** come from a single map `API_ERROR_MESSAGES` keyed by error code, falling back to the server `message` (already safe) and then to a generic friendly message. Copy follows UI_UX §6 voice.
- Field errors (`fields`) map to form inputs.

### 9.3 Errors and logs
- **Never swallow errors.** Every `catch` either handles the error meaningfully (retry, fallback, user message) or rethrows. An empty `catch {}` is not allowed.
- Log once, at the boundary (route wrapper on the server; error boundary / query error handler on the client) — not at every layer.
- Logs never contain passwords, tokens, email addresses, private content, full request bodies or cookies. Use `userId` and `requestId`.
- Use Next.js `error.tsx` boundaries per route group for unexpected render errors, rendering the shared `ErrorState`.

---

## 10. Code Duplication and Reusability

### 10.1 Must be single-sourced (extract on the **second** occurrence)
- Business rules (e.g. "deleting a collection keeps saves", skill-name normalization, feed ranking weights).
- Validation (Zod schemas shared by route handler and form).
- Types for API contracts and domain views.
- Constants with meaning: limits, page sizes, rate limits, route paths, post-type labels, error-code messages, design tokens.
- Authorization decisions (policies).

### 10.2 May be duplicated until the third occurrence
- Small UI arrangements (a flex row with an icon and text).
- Test setup that differs per test.

### 10.3 Must **not** be merged
- Code that looks the same but encodes different concepts or rules (§5.4). Ask: *if one changes, must the other change too?* If not, keep them separate.

### 10.4 A good abstraction
- Has a name that describes the concept, not the mechanics (`formatEstimatedTime`, not `formatNumberWithSuffix2`).
- Has a small interface with no mode flags.
- Lives in the narrowest folder that contains all its callers (§3.3).
- Is covered by tests if it contains logic.

### 10.5 Where shared code goes

| Shared thing | Location |
|---|---|
| Constant | `lib/constants/<topic>.ts` |
| Pure utility | `lib/utils/<verb-noun>.ts` |
| Type | `lib/types/<area>.ts` or `z.infer` from `lib/schemas` |
| Server-only helper | `server/lib/` |
| UI primitive | `components/ui/` |

---

## 11. Styling and UI Consistency

dodoi is visually rich (patterned tiles, pastel accents, playful motion). Consistency comes from **tokens and components**, not from restricting expressiveness.

- **Tokens only.** Colors, radii, shadows, font sizes, motion durations come from `styles/tokens.css` mapped into the Tailwind theme (UI_UX_GUIDELINES §2). No hex, rgb or hsl literals in components.
- **No arbitrary Tailwind values** (`bg-[#F4A79D]`, `p-[13px]`, `rounded-[18px]`) when a token exists. If the design needs a value with no token, add the token (and update UI_UX_GUIDELINES) instead of hardcoding.
- **Semantic tokens in components** (`bg-primary`, `text-muted`), palette tokens only inside `tokens.css`.
- **Craft patterns** are Tailwind utilities (`bg-pattern-butter`), defined once.
- **Variants** of primitives via shadcn's `cva` pattern inside `components/ui/`; feature code picks a variant, it does not re-style.
- **Class merging** with the shared `cn()` helper (`lib/utils/cn.ts`).
- **No inline `style={{}}`** except for genuinely dynamic values that Tailwind cannot express (e.g. image aspect ratio from data).
- **No CSS-in-JS**, no per-component CSS files, no global overrides of component styles outside `globals.css`.
- **Class order** is formatted automatically by `prettier-plugin-tailwindcss` (PROPOSED).
- **Mobile-first** responsive classes; breakpoints per UI_UX §2.7.
- **Motion** uses the shared animation tokens and must be disabled under `prefers-reduced-motion`.
- **Never copy** inline styles or the `support.js` runtime from `docs/design/`; rebuild with tokens and components.
- Undesigned screens are built only from existing tokens and components and flagged for review (UI_UX §8 rule).

---

## 12. Imports and Dependency Management

### 12.1 Import style
- **Absolute imports via `@/`** for anything outside the current folder (`@/components/ui/button`). Relative imports (`./post-media`) only within the same folder.
- **No `../../` chains.**
- **Order** (enforced by formatter/linter, PROPOSED: `eslint-plugin-import` or `prettier-plugin-organize-imports`):
  1. Side-effect imports (`import "server-only"`)
  2. Node built-ins
  3. External packages (`react`, `next/*`, `zod`)
  4. Internal `@/` imports
  5. Relative imports
  6. Type-only imports use `import type`.
- Named exports only (except where Next.js requires a default export: `page.tsx`, `layout.tsx`, etc.). Named exports keep names consistent across the codebase.

### 12.2 Boundaries enforced by tooling
| Rule | Enforcement |
|---|---|
| Client code cannot import `server/**` | `import "server-only"` at the top of server entry files (CONFIRMED) + ESLint `no-restricted-imports` |
| No imports of another module's internals (`@/server/modules/*/service`, `/repository`, `/policies`) | ESLint core `no-restricted-imports` patterns (no extra dependency) |
| `components/ui`, `hooks`, `lib` do not import domain or server code | ESLint `no-restricted-imports` with per-folder overrides |
| No circular dependencies | `import/no-cycle` (PROPOSED, needs `eslint-plugin-import`) or `madge --circular` in CI (PROPOSED) |
| No unused imports / variables | `@typescript-eslint/no-unused-vars` (error) |

### 12.3 Dependencies
- New packages follow AI_DEVELOPMENT_RULES §6: purpose, why existing tools are not enough, maintenance status, client bundle impact, license, approval.
- One library per job. No second date library, second icon set, second fetch wrapper, second validation library.
- No paid services.
- Keep `pnpm-lock.yaml` committed; never edit it by hand.
- Remove packages that become unused in the same change.

### 12.4 Dead code
- No commented-out code. Git keeps history.
- No unused exports, files, feature flags or components. Delete them.

---

## 13. Comments and Documentation

- **Code explains *what*; comments explain *why*.** Comment non-obvious decisions, constraints and trade-offs (e.g. "Credentials provider requires JWT sessions, so revocation uses sessionVersion").
- **Required comments:**
  - Business rules that are not obvious from names, with a requirement ID: `// COLL rule: deleting a collection keeps saves (PRODUCT_REQUIREMENTS §5.6)`.
  - Every `@ts-expect-error`, `as` assertion on unvalidated data, `!` assertion, eslint-disable line.
  - Workarounds for library or browser bugs, with a link.
- **TSDoc** on exported functions of `server/modules/*/index.ts`, `lib/utils`, `lib/api-client` and integration interfaces when behaviour is not obvious from the signature (errors thrown, side effects, units).
- **Not allowed:** comments restating code (`// increment i`), outdated comments, commented-out code, decorative banners, TODOs without a task ID or OD reference (`// TODO(P1-21): tune weights after baseline`).
- **Docs move with code.** A change to schema, API contract, architecture or conventions updates the matching file in `docs/` (or this file) in the same change.

---

## 14. Performance, Security, and Accessibility

### 14.1 Performance (targets: NFR-01 — LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75)
- Server Components first; keep client bundles small; lazy-load heavy client-only components (`next/dynamic`) such as the media viewer or admin editor.
- Images: Cloudinary `f_auto,q_auto` + `srcset`/`sizes`, stored `width`/`height` to prevent layout shift, `priority` only for the LCP image.
- Fonts via `next/font` (DM Sans), self-hosted at build.
- All lists paginated; never load unbounded data.
- Database: indexes for real query patterns (DATABASE_SCHEMA §5); avoid N+1 queries — fetch related data with `include`/`select` or batch.
- Don't optimise without measuring; record the measurement when you do.

### 14.2 Security (details: [docs/SECURITY_AND_PRIVACY.md](docs/SECURITY_AND_PRIVACY.md))
- Validate all input at the server boundary; never trust client-supplied ids, roles or ownership.
- Authorization in services with actor-scoped queries; 404 for invisible resources.
- No `dangerouslySetInnerHTML` with user content; user text renders as text.
- Raw SQL only via tagged `$queryRaw`.
- Secrets only in server code (`server-only`), never logged, never committed.
- Mutation route handlers verify the `Origin` header.

### 14.3 Accessibility (target WCAG 2.2 AA)
- Semantic HTML first (`button`, `a`, `nav`, `main`, headings in order); ARIA only to fill gaps.
- Every input has a visible label; errors linked via `aria-describedby`.
- Keyboard: everything reachable and operable; visible focus ring; focus returned after dialogs.
- Touch targets ≥ 44×44 px.
- Images have meaningful `alt`; decorative pattern tiles are `aria-hidden`.
- Never rely on color alone.
- Respect `prefers-reduced-motion`.
- "Coming soon" items use `aria-disabled` with an explanation (NAV-03).

### 14.4 PWA
- Mobile-first layouts; offline behaviour exactly as the approved offline matrix (SYSTEM_ARCHITECTURE §9) — no feature may pretend to work offline.

---

## 15. Testing and Quality Gates

Tools and full strategy: [docs/TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md). No new test dependencies beyond those listed there.

### 15.1 What must be tested
| Code | Test |
|---|---|
| Business logic, policies, ranking, normalization, utilities | Unit (Vitest) |
| Zod schemas | Unit: valid + representative invalid inputs |
| Components with behaviour (state, events, conditional states) | Component (Testing Library), queried by role/label |
| Route handlers + services + DB | Integration against the test database, including 401/404 authorization cases |
| Critical user flows | E2E (Playwright) + axe |
| Every fixed bug | Regression test that fails before the fix |
| Error, empty and edge states | Where the behaviour differs from the happy path |

Presentational components with no logic do not need unit tests; they are covered by E2E and visual review.

### 15.2 Quality gates (all must pass before a change is "done")
```bash
pnpm lint          # ESLint, zero warnings allowed in CI (--max-warnings 0)
pnpm typecheck     # tsc --noEmit
pnpm format:check  # Prettier
pnpm test          # unit + component + integration
pnpm build         # production build
pnpm test:e2e      # when UI flows changed
```
- Never disable a lint rule, skip a test or weaken a type to pass a gate. If a gate is wrong, fix the gate in a separate, explained change.
- Report any gate that was not run, and why (AI_DEVELOPMENT_RULES §9).

---

## 16. Refactoring and Existing Code

- **Follow the surrounding code and this document.** If they disagree, follow this document and mention the inconsistency.
- **Stay in scope.** Improve nearby code only when it is directly relevant to the task (the code you must touch is hard to change safely, or the fix requires it).
- **No unrelated rewrites, renames or reformatting** in a feature change. They make review hard and hide bugs. Propose them as a separate task.
- **Refactor in separate commits** from behaviour changes: first a behaviour-preserving refactor (tests stay green), then the feature.
- **Tests before refactoring** logic that lacks coverage, so behaviour is pinned.
- **Leave it better, not different:** remove dead code and fix misleading names you touch; don't introduce a second pattern alongside the existing one.
- **Large refactors** (moving modules, changing a shared interface, changing conventions) require an approved plan and, if architectural, an ADR (`docs/adr/`).
- **Behaviour changes are never silent.** If a refactor changes behaviour, say so explicitly and update the docs.

---

## 17. Code Review Checklist

Use for every change (human or AI). Paste the result into the PR or session summary.

**Structure & architecture**
- [ ] Files are in the right place (§3.3) and named per §2
- [ ] Layer boundaries respected (§4.1); no imports of another module's internals
- [ ] No business logic in components, pages or route handlers
- [ ] No new pattern parallel to an existing one

**Code**
- [ ] Names are precise, consistent with domain vocabulary, no vague abbreviations
- [ ] Functions/components within review thresholds or justified (§7)
- [ ] No duplication of rules, validation, types or constants (§10)
- [ ] No over-generic abstraction or flag arguments
- [ ] No `any`, unsafe `as`, unexplained `!`, `@ts-ignore`
- [ ] Errors handled, not swallowed; user messages friendly; no internals leaked

**UI**
- [ ] Reused existing primitives/components first
- [ ] Tokens only, no arbitrary values or hex
- [ ] Loading, empty, error, disabled states present
- [ ] Accessible (labels, keyboard, focus, contrast) and responsive (mobile + desktop)

**Safety**
- [ ] Input validated at the boundary; authorization in service; actor-scoped queries
- [ ] No secrets or sensitive data in client code or logs

**Delivery**
- [ ] Tests added/updated; quality gates pass (§15.2) or skipped gates reported
- [ ] Docs updated for any schema, API, architecture or convention change
- [ ] No dead code, commented-out code or untracked TODOs

---

## 18. Enforcement Summary

| Standard | Enforced by | When available |
|---|---|---|
| Strict typing | `tsconfig.json` (§6.1), `pnpm typecheck` | P0-01 |
| Lint rules (no `any`, unused vars, hooks deps, restricted imports, no `console`) | ESLint config | P0-01/P0-02 (ESLint PROPOSED) |
| Formatting & Tailwind class order | Prettier + plugin | P0-02 (PROPOSED) |
| Server/client boundary | `server-only` package + ESLint | P0-01 |
| Circular dependencies | `import/no-cycle` or `madge` | After approval (PROPOSED) |
| Tests & coverage of required areas | Vitest, Playwright, axe | P0-06 |
| All gates on every change | CI | P0-09 (GitHub Actions) |
| Everything else | Review checklist (§17) | Always |

Changes to this document follow the same rule as other docs: proposed, approved by the product owner, and recorded in the same change that depends on them.
