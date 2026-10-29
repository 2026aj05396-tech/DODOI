# UI / UX Guidelines

**Stack (CONFIRMED):** Tailwind CSS + shadcn/ui (Radix primitives), light theme only in MVP, tokens structured for future dark mode.

**Visual source of truth (CONFIRMED):** Claude Design project, file `dodoi App v3.dc.html`
- Local copy: [`docs/design/dodoi-app-v3.dc.html`](design/dodoi-app-v3.dc.html) (open in a browser next to `support.js`)
- Original: `https://claude.ai/design/p/7bc04d20-a82d-44c5-9de4-1c61b310f3d5` (standalone Claude Design closes by 14 Dec 2026 — the local copy is authoritative)
- Screen IDs used below (`1a`–`1i` mobile, `2a`–`2c` web) match the labels in the design file.

Values in §2 are **extracted from the design** and therefore CONFIRMED, except where marked. Where the design conflicts with the requirements, the conflict is logged in §10 as `DC-xx` and is **OPEN** until the product owner decides.

---

## 1. Design Direction

"A thoughtfully curated creative magazine combined with a friendly community." Not an enterprise dashboard, not a technical social network.

From the design notes:
- **Pastel palette on a dotted cream paper base.** Soft coral for actions, lavender stripes for "New to you", and butter, blush, lavender, mint and sky tiles carrying **craft-inspired patterns** (polka dots, ticking stripes, gingham, scallops, checks).
- **No public scores or like counts.** Post types (First attempt, Work in progress, Journal…) are first-class labels.
- **AI is a context-aware pill, not a separate app.**

**The artwork is the hero.** Interface chrome stays quiet; real photos replace the patterned placeholder tiles.

## 2. Design Tokens

Defined once as CSS custom properties in `src/styles/tokens.css`, mapped into the Tailwind theme. Components use **semantic** tokens only — never raw hex.

### 2.1 Palette tokens (from design)

| Token | Value | Where the design uses it |
|---|---|---|
| `--palette-paper` | `#FFF8F0` | App background, cards, sheets, nav bars |
| `--palette-paper-dots` | `rgba(214,170,190,.28)` 1px dots on 16px grid | Dotted paper texture over `paper` on every screen |
| `--palette-sand` | `#F3EADF` | Subtle fills: meta chips (Beginner, 45 min), nav hover, inner dividers, project tag |
| `--palette-sand-input` | `#F4ECE1` | Search/input fill, inactive filter chip (mobile), AI uncertainty note |
| `--palette-line` | `#EADFD3` | Borders, dividers, card outlines |
| `--palette-line-strong` | `#DCCFC2` | Unselected chip borders, suggestion chips, AI input border |
| `--palette-ink` | `#2B2233` | Primary text, outline-button borders, active filter chip, step numbers, AI FAB |
| `--palette-ink-2` | `#5A4E5E` | Secondary text, body copy on tiles |
| `--palette-ink-muted` | `#7A6E78` | Meta text, overlines, placeholders, inactive tabs |
| `--palette-ink-faint` | `#B3A8AE` | Dashed "+ Add" borders and dashed "Coming soon" borders (decorative/disabled only — not for active control borders) |
| `--palette-coral` | `#F4A79D` | **Primary action background** (ink text on it), selected chips, user chat bubble, Create button |
| `--palette-coral-hover` | `#EE948A` | Primary hover |
| `--palette-coral-deep` | `#E98A7E` | Selected chip border, saved-bookmark fill |
| `--palette-brick` | `#C04A37` | Logo wordmark, links, text actions (Follow, See all, Offer help), active tab/nav, notification dot |
| `--palette-butter` | `#FBE7A1` | Tile accent (polka dots) |
| `--palette-butter-strong` | `#F5C96B` | Logo dot, "In progress" status dot |
| `--palette-blush` | `#F9D0D3` | Tile accent (diagonal stripes), active sidebar item |
| `--palette-lavender` | `#E2D9F7` | Tile accent (gingham), skill chip bg, overline pill bg |
| `--palette-lavender-strong` | `#D6C8F5` | "New to you" card (animated stripes) |
| `--palette-plum` | `#5B3F8F` | Text on lavender, AI sparkle icon |
| `--palette-mint` | `#CDE8D6` | Tile accent (scallops), session card |
| `--palette-sky` | `#CFE3F5` | Tile accent (checks) |
| `--palette-leaf` | `#4F7A3A` | "Open" status (success) |
| `--palette-ai-surface` | `#F8F3FB` + `rgba(170,150,220,.25)` dots | AI companion background (P4) |
| `--palette-danger` | `#B3261E` | Error text, error borders, error icons (design `3b`) |
| `--palette-danger-surface` | `#FBE3E0` | Error banner background |
| `--palette-danger-line` | `#F2C4BE` | Error banner/swatch border |
| `--palette-checkbox` | `#7A6E78` | Unchecked checkbox border (DC-14 fix; same value as ink-muted) |

### 2.2 Semantic tokens

Implemented in `src/styles/tokens.css` and mapped to Tailwind utilities in `src/styles/globals.css` (P0-04). Names follow shadcn/ui conventions so its components use dodoi colours. Use the utility in components, e.g. `bg-primary text-primary-foreground`.

| Token (CSS var) | Tailwind utility | Maps to |
|---|---|---|
| `--background` | `bg-background`, `bg-paper` (with dot texture) | paper |
| `--foreground` / `--foreground-secondary` / `--muted-foreground` | `text-foreground` / `text-foreground-secondary` / `text-muted-foreground` | ink / ink-2 / ink-muted |
| `--card`, `--popover` | `bg-card`, `bg-popover` | paper |
| `--muted`, `--secondary`, `--accent` | `bg-muted`, `bg-secondary`, `bg-accent` | sand |
| `--field` | `bg-field` | sand-input |
| `--primary` / `--primary-foreground` / `--primary-hover` | `bg-primary text-primary-foreground hover:bg-primary-hover` | coral / ink / coral-hover |
| `--selected-border` | `border-selected-border` | coral-deep |
| `--link` | `text-link` (links, active nav, text actions) | brick |
| `--inverse` / `--inverse-foreground` | `bg-inverse text-inverse-foreground` | ink / white |
| `--border` / `--border-strong` / `--border-faint` | `border-border` / `border-border-strong` / `border-border-faint` | line / line-strong / ink-faint |
| `--input` / `--checkbox` | `border-input` / `border-checkbox` | line-strong / `#7A6E78` |
| `--ring` | global `:focus-visible` (3px outline, 2px offset), `ring-ring` | plum |
| `--destructive` / `--destructive-surface` / `--destructive-border` | `text-destructive`, `bg-destructive-surface` | danger / danger-surface / danger-line |
| `--success` | `text-success` | leaf |
| Accents | `bg-butter`, `bg-blush`, `bg-lavender`, `bg-lavender-strong`, `bg-mint`, `bg-sky`, `bg-coral`, `text-plum` | tile accents |
| Patterns | `bg-pattern-{butter,blush,lavender,mint,sky,coral,new-to-you}`, `bg-ai-paper` | §2.3 |

Type scale: `text-hero`, `text-hero-web`, `text-title`, `text-title-web`, `text-greeting(-web)`, `text-section`, `text-card-title(-web)`, `text-body-lg(-web)`, `text-body`, `text-meta(-web)`, `text-chip`, `text-overline`, `text-tab`. Radii: `rounded-xs/sm/md/card/lg/xl/full`. Shadows: `shadow-hover/float/frame`. Motion: `animate-dd-up/pop/stripe/twinkle/pulse/pulse-soft` (no `float`: removed 2026-10-28), easing `ease-soft`.

**Contrast notes (computed from design values, to be re-verified with a checker):**
- Ink on paper, ink on coral (primary buttons), muted on paper, brick on paper, leaf on paper: pass WCAG AA for normal text.
- ~~Fail: brick text on lavender~~ → fixed in design: skill chips use **plum `#5B3F8F` on lavender** (DC-14).
- ~~Fail: faint checkbox border~~ → fixed in design: unchecked checkbox border **`#7A6E78`** (DC-14).
- Pastel accents are decorative backgrounds only; text on them uses ink, ink-2 or plum.

### 2.3 Craft patterns (from design)

Each accent has a signature pattern. Used for: media placeholders/fallbacks (FEED-10), skill accents, theme cards, default avatars, collection covers.

| Accent | Pattern | CSS (design) |
|---|---|---|
| butter | Polka dots | `radial-gradient(rgba(255,255,255,.75) 2px, transparent 2.5px) 0 0/14px 14px` |
| blush | Ticking stripes (45°) | `repeating-linear-gradient(45deg, rgba(255,255,255,.5) 0 5px, transparent 5px 13px)` |
| lavender | Gingham | two `linear-gradient(… rgba(255,255,255,.45) 50%, transparent 50%) 0 0/18px 18px` |
| mint | Scallops | `radial-gradient(circle at 50% 100%, transparent 7px, rgba(255,255,255,.65) 7.5px 9.5px, transparent 10px) 0 0/22px 11px` |
| sky | Checks | `conic-gradient(rgba(255,255,255,.45) 25%, transparent 0 50%, rgba(255,255,255,.45) 0 75%, transparent 0) 0 0/22px 22px` |
| coral | Small dots | `radial-gradient(rgba(255,255,255,.4) 1.5px, transparent 2px) 0 0/10px 10px` |
| lavender-strong | Animated stripes ("New to you" only) | `repeating-linear-gradient(-45deg, rgba(255,255,255,.55) 0 8px, transparent 8px 18px)` + `ddStripe` |

Implement as Tailwind utilities (`bg-pattern-butter`, …). Skill accent assignment stored on Skill (`accent`: BUTTER | BLUSH | LAVENDER | MINT | SKY | CORAL).

### 2.4 Typography (from design)

| Role | Design | Status |
|---|---|---|
| All UI and headings | **DM Sans** (Google Fonts, SIL Open Font License — free) 400 / 500 / 700 + 400 italic, optical-size axis 9–40; fallback `system-ui, sans-serif`. Load with `next/font/google` (self-hosted at build, no runtime Google request) | CONFIRMED (design updated from Calibri) |

Single typeface; hierarchy comes from size, weight and tight letter-spacing (`-0.02em` on headings, `-0.03em` on hero).

| Token | Mobile (390) | Web (1280) | Weight | Use |
|---|---|---|---|---|
| `text-hero` | 36/1.05 | 68/0.98 | 700 | Welcome / landing headline |
| `text-title` | 28–32/1.05 | 40/1.02 | 700 | Post title, page title (onboarding, Explore, Community) |
| `text-greeting` | 22 | 34 | 700 | Feed greeting ("What will you make tonight, Aanya?") |
| `text-section` | 18 | 16–22 | 700 | Section headings (Themes this week, Skills to try) |
| `text-card-title` | 15 | 17 | 700 | Feed card titles |
| `text-body-lg` | 16 | 20 | 400 | Intro paragraphs |
| `text-body` | 15/1.45 | 15/1.45 | 400 | Body, steps, chat |
| `text-meta` | 13 | 14 | 400 | "Meera · Crochet", timestamps |
| `text-chip` | 12–14 | 13–15 | 400/700 | Chips, badges |
| `text-overline` | 11, uppercase, `0.16em` tracking | same | 700 | MATERIALS, STEPS, NEW TO YOU, HELP REQUEST |
| `text-tab` | 11 | — | 400/700 | Bottom tab labels |

Minimum body size 15px in design; inputs must be ≥ 16px on mobile to avoid iOS zoom (design search fields are 15px → adjust to 16px, PROPOSED).

### 2.5 Radius, elevation, motion (from design)

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 2px | Project status tag (`1g`) |
| `--radius-sm` | 6–8px | Checkboxes, small thumbnails, AI note |
| `--radius-md` | 12px | Sidebar items, list containers, small tiles |
| `--radius-card` | 14px | Feed media (mobile), help/rail cards, skill cards |
| `--radius-lg` | 16–18px | Theme cards, feed media (web), chat bubbles (16 with one 4px corner) |
| `--radius-xl` | 20–22px | Landing tiles, web post hero media |
| `--radius-pill` | 999px | All buttons, chips, inputs, search, badges |

| Shadow | Value | Use |
|---|---|---|
| `--shadow-hover` | `0 8px 20px rgba(110,60,40,.10)` | Card hover lift |
| `--shadow-float` | `0 8px 24px rgba(43,34,51,.25)` | Floating "Ask dodoi" pill |
| `--shadow-frame` | `0 12px 32px rgba(110,60,40,.10)` | Large surfaces (design frames) |

| Motion | Value | Use |
|---|---|---|
| Press | `scale(.96)`, 150ms ease | All buttons |
| Hover lift | `translateY(-4px)` cards, `-2px` list cards, 250ms `cubic-bezier(.2,.8,.2,1)` | Feed, skill, help cards |
| `ddUp` | fade + rise 16px, 550ms, staggered 80ms | Feed card entrance, chat messages |
| `ddPop` | scale .6 → 1.18 → 1, 300–350ms | Save toggle, chip select |
| ~~`ddFloat`~~ | **Removed** (PO, 2026-10-28). Craft tiles on landing, welcome and auth screens stay still; never add a looping float or drift to photos or image tiles | — |
| `ddStripe` | stripe drift 2.5s loop | "New to you" card |
| `ddTwinkle` | sparkle rotate/scale 2.4s | AI icon |
| `ddPulse` / `ddPulseSoft` | ring pulse | Notification dot, current journal entry |
| Reduced motion | `prefers-reduced-motion: reduce` disables **all** animation and transitions (design rule) | Global |

### 2.6 Sizing

| Element | Height |
|---|---|
| Primary/secondary button (mobile) | 50–52px |
| Button (web) | 44–48px; hero CTAs 56px |
| Filter chip | 36px (mobile) / 38px (web) |
| Interest chip | 40px |
| Suggestion chip | 34–36px |
| Search input | 46–48px |
| Icon buttons / touch targets | 44×44px min (design complies) |
| Bottom tab bar | 84px incl. safe area |

Spacing: page gutter 20px mobile (24px onboarding/welcome), 28px web feed, 56px landing. Masonry gap 10px (mobile) / 16px (web).

### 2.7 Breakpoints and columns

| Viewport | Designed | Feed columns |
|---|---|---|
| Mobile (390) | Yes (`1a`–`1i`) | 2 |
| Tablet (768–1279) | Yes (`3c`, 834 portrait) | 2 — 76px icon rail, **no right rail** |
| Desktop (≥ 1280) | Yes (`2a`–`2c`) | 3 (between 232px sidebar and 300px right rail) |

## 3. Layout and Navigation (from design)

### 3.1 Mobile
- **Header (feed):** wordmark "dodoi" (brick, butter dot) left; bookmark (Saved) and bell (notifications) icons right.
- **Bottom tab bar (5):** Home · Explore · **Create** (raised coral square, centre) · Community · Profile. Active tab = brick + bold.
- **Floating "Ask dodoi" pill** (ink, sparkle) above the tab bar on Home.
- Detail screens: full-bleed hero media with round paper back/overflow buttons; sticky bottom action bar.
- Phase gating (CONFIRMED): items for unbuilt features stay in the layout as **"coming soon"** (PRODUCT_REQUIREMENTS NAV-01…05). **Cards/sections** (design `3b`): dashed `ink-faint` border, muted (`ink-2`) text, butter **"Coming soon"** pill, `aria-disabled`, not tappable. **Nav tabs, icons and small buttons** (DC-21): normal shape in muted color with a small butter **"Soon"** pill/dot; activating shows only a tooltip "Coming soon"; accessible name "{label}, coming soon"; no navigation, no API call.

### 3.2 Desktop (≥ 1280)
- **Sidebar everywhere (DC-12, CONFIRMED).**
- **Home (`2b`):** full left sidebar 232px (Home, Explore, Community, Messages + badge, Saved, Journal, Profile, Create button, "Ask dodoi" card at bottom, then **Log out** — danger red, bold, hover danger-surface, opens the log-out confirmation) · centre feed with search bar, bell, avatar · right rail 300px.
- **Right rail in Phase 1 (DC-20/DC-22, CONFIRMED):** "New to you" card · **"Help other makers"** coming-soon card ("Answer questions in skills you know") that lists the user's *can help with* skills as chips when they chose any in onboarding step 3 · **"Live sessions"** coming-soon card ("Book a 30-min call with a maker · We'll let you know when this opens.").
- **Post detail (`2c`):** two-column content (media | details). **Built (P1-20, PO decisions 2026-10-26):** mobile `1e` full screen (no header/tab bar; Back + Share over the media; sticky bar "Ask about this" + "Save to collection", both coming soon); tablet (built from system, PO review) media above details in a centred column; from 1024px side by side with sticky media. Gallery: swipe with dots and "n / total" on mobile, arrows + thumbnails from 768px; frame takes the first item's shape (4:5–4:3, mobile capped at 56svh) so nothing shifts; videos play inline after a tap. Save is coming soon until P1-25; Share uses the Web Share API, else copies the link with a toast. Signed-out visitors (OD-29) see a slim bar (wordmark, Log in with return, Sign up) instead of the app shell. Skill chips and the creator row link out once skill pages (P1-26) and profiles (P1-14) exist. **Phase 1: full 232px sidebar** (DC-23). From Phase 4, when the AI companion (380px) docks, the sidebar collapses to the **76px icon rail** (monogram "d.", Home, Explore, Community, Saved, Profile, Create). Icon-only items need accessible names (`aria-label`).

**Implemented in P1-26b:** `AppShell` (`src/components/layout/app-shell.tsx`) used by `src/app/(app)/layout.tsx`; pages that need the right rail wrap their content in `PageWithRail`. Coming-soon nav items use `ComingSoonTrigger`: accessible name = visible label + ", coming soon" (never a separate `aria-label`, so voice-control users can say what they see); visual badges are `decorative`. Tight spots (icon rail, mobile bell) use the butter **dot**; elsewhere the "Soon" pill. Preview at `/shell-preview` (local only).

### 3.3 Tablet (768–1279, design `3c`)
- 76px icon rail (same as `2c`), no right rail, 2-column feed, search + avatar header, filter chips wrap, floating "Ask dodoi" pill bottom-right. No Log out on the rail (design `3c`); tablet users log out from their profile (`1i` account card).
- **Landing (`2a`):** top bar (Discover · Learn · Community · Companion; Log in / Join free), hero left, animated mosaic right. **Built:** each tile shows a craft photo (`public/images/crafts/`) over its pattern, fading in once loaded; white label on a bottom scrim; "+ 40 more crafts" keeps a coral tint. The pattern is the placeholder and the fallback (`components/marketing/craft-photo.tsx`).

## 4. Components (from design)

Primitives live in `src/components/ui/` (built in P0-10 on Radix via the `radix-ui` package, icons from **Lucide**). Preview them at `/dev/ui` in local development: Button, Tag / ToggleChip / ActionChip, Input, Label, FieldError, ErrorBanner, SearchField, Tabs, Dialog (dialog + sheet layouts), Toaster / `showToast()`, Skeleton, EmptyState, ErrorState, ComingSoonCard / ComingSoonBadge, PatternTile, Wordmark. Product components in `src/components/<domain>/`.

| Component | Design ref | Spec |
|---|---|---|
| **Wordmark** | all | "dodoi" 24–28px bold brick, `-0.02em`, butter dot 7–8px |
| **Button** | all | Pill. Variants: `primary` (coral bg, ink text, hover coral-hover), `outline` (1.5px ink border, transparent/paper bg), `inverse` (ink bg, white), `destructive` (danger bg, white — confirming Log out), `text` (brick, bold). Press scale .96 |
| **Chip** | 1b, 1c, 1e | Variants: `filter` (inactive: sand-input/paper + line border; active: ink bg, white bold), `interest` (unselected: paper + line-strong border, hover brick border; selected: coral bg + coral-deep border + check icon + pop), `meta` (sand bg: Beginner, 45 min), `skill` (lavender bg, plum bold), `suggestion` (paper + line-strong border), `dashed-add` (+ Add your own) |
| **PostCard** | 1c, 2b | Patterned/photo media (radius card/lg) with **type badge** top-left (paper pill, bold) and **save button** top-right (paper circle, bookmark; saved = coral-deep fill + pop); below: title (bold) and `creator · skill` meta. Hover lift. Entrance `ddUp` staggered. **Built (P1-20/P1-22):** `components/posts/post-card.tsx`; badge `text-badge` without letter-spacing so "Tutorial · 45 min" fits 2-column mobile cards; failed images fall back to the skill's pattern (FEED-10); videos show play + duration and play muted on tap (FEED-12); feed cards add a "⋯" menu at the end of the byline |
| **MasonryGrid** | 1c, 2b | CSS `columns` (2 mobile / 3 web), `break-inside: avoid` |
| **DiscoveryCard "New to you"** | 1c, 2b | Lavender-strong animated stripes; overline, skill name, one-line pitch, "Try it →" |
| **HelpRequestCard** | 1c, 1h, 2b | P3 |
| **SessionCard** | 2b | P3 |
| **ThemeCard** | 1d | 180×160 patterned tile, "12 ideas" overline, title; hover lift + rotate(-1.5deg) |
| **SkillCard** | 1d | Bordered card, 40px accent swatch, name + **hint line = editor-set tag** ("Beginner friendly", "Pairs with drawing", "Under ₹300 to start") — Phase 1 (DC-09) |
| **SearchField** | 1b, 1d, 2b | Pill, sand-input (mobile) / paper + line border (web), search icon, muted placeholder |
| **MaterialsList** | 1e, 2c | Bordered list; each row is a full-width toggle button (min 46px) with checkbox (checked = coral square + check + pop; unchecked = `#7A6E78` border). Header "Materials · {n} of {total} · saved to your account". **Checks persist per user and sync across devices** (DC-07) |
| **StepList** | 1e, 2c | Each step has a tappable numbered circle that toggles **done** (filled + check, pop animation; tap again to undo). Next unfinished step = ink-filled circle; others outlined. A **"Next step"** button scrolls to the next unfinished step. Header "Step {completed} of {total} · progress saved". Persisted per user (DC-07, DC-24) |
| **CreatorRow** | 1e, 2c | Avatar, name, "helps with …", Follow / Following (live from P2-06: brick text action, `aria-pressed`, hidden for your own post and private profiles; signed-out visitors go to sign-in). Shown only when the post has a dodoi author (invited creator). For stock/Creative Commons posts it is replaced by a muted line **"via dodoi editors"** (DC-27) |
| **AttributionBlock** | 1e | Below the steps on every seeded post: sand-input box, overline "SOURCE", "Adapted from \"{title}\" by {author} on {site link}", "License: {license} · Added by dodoi editors" (DC-10) |
| **ComingSoonCard** | 3b, 1d, 2b | Dashed `ink-faint` border, radius card, muted title + one-line description, butter "Coming soon" pill, `aria-disabled`, not tappable (DC-19) |
| **FieldError / ErrorBanner** | 3b | Input with 1.5px danger border; message below in danger with round "!" icon; banner = danger-surface box with ink text (DC-15) |
| **IconRail** | 2c, 3c | 76px column, 48×48 items radius 12, active = blush bg, Create = coral circle |
| **PostMetaHeader** | 1e, 2c | Chips row (skill, level, time), title, creator row (avatar, name · "helps with …", Follow) |
| **StickyActionBar** | 1e, 1g | Paper bar with top border; outline + primary buttons |
| **CollectionTile** | 1i | 120px mosaic cover (2fr/1fr grid of 3 images), name, "18 saved · Private"; "+ New collection" dashed tile. **Built (P1-25):** `components/collections/collection-tile.tsx`; empty slots show craft patterns; the API returns `previewMedia` (3 newest covers) |
| **ProfileHeader** | 1i | 72px avatar, display name, `@username`, bio. **P2-06 (PO review at 390/834/1280):** others' public profiles get an outline Follow / Following button beside Report; the owner sees "{n} followers  {n} following" under the username, each opening its list (`/profile/followers`, `/profile/following`: avatar, name, @username; Following has a Following button to unfollow; empty states "No followers yet" / "You're not following anyone yet") |
| **SkillGroups** | 1i | Overline groups with chips: Interests (with level) · Can help with · Want to learn |
| **Tabs** | 1h, 1i | Text tabs, active = brick bold + 2px brick underline |
| **OnboardingProgress** | 1b | 3 segments 28×4px (active coral, rest line). "Skip" link only on steps 2 and 3 (DC-28) |
| **BottomTabBar** | 1c… | 5 columns, raised Create button |
| **Sidebar / RightRail** | 2b | As §3.2 |
| **LogOutDialog** | 1i | `sheet` dialog: grab handle (mobile), "Log out of dodoi?", "Your collections, journal and progress stay saved. Log back in anytime.", `destructive` Log out + outline Cancel. `components/auth/log-out-dialog.tsx` |
| **Profile account card** | 1i | Own profile, below 1280px: bordered paper card, 52px rows — "Settings and privacy" (→ `/settings`) · "Log out" (danger, bold) |
| **EmptyFeedArt** | — | Built from system (PO request): mood board of three craft prints (washi tape = craft patterns), coral thread drawn in with `animate-dd-draw`, `dd-twinkle` sparkles; fans out on hover; scaled to 0.84 below 640px. `components/feed/empty-feed-art.tsx` |
| **AI pill / companion panel / chat bubbles** | 1c, 1e, 1f, 2c | P4 |
| **JournalTimeline** | 1g | P2 |
| **EmptyState / ErrorState / OfflineBanner / Skeleton / Toast / CollectionPicker** | — | Not designed — build from system (DC-11 rule) |

## 5. Interaction Rules

- Optimistic UI only for low-risk reversible actions (save, unsave, not interested). Revert with a toast on failure.
- Destructive actions require confirmation and state consequences explicitly.
- Every async action shows pending state; disable submit buttons while pending.
- No rating scales, public scores or like counts (design and PP-4 agree).
- Missing optional content renders nothing (POST-10).
- Images: Cloudinary `f_auto,q_auto` + `srcset`; patterned accent tile as placeholder and as fallback for failed media.
- Video: no autoplay in the feed; poster + play icon + duration badge; plays on tap, muted first (OD-15).

## 6. Voice and Microcopy (from design)

Warm, plain, a little playful, beginner-safe. Examples from the design:
- "What will you make tonight, Aanya?"
- "Pick as many as you like, including ones you're only curious about. You can change these any time."
- "Share progress, not perfection." · "No experience needed." · "Already making with us? Log in"
- "Like embroidery, but faster and fluffier." · "Currently bad at crochet and loving it."
- AI uncertainty: "I can't see the stitch count clearly in this photo, so this is my best guess."

Error messages: what happened + what to do next. No blame, jargon or codes in the main message.

## 7. Accessibility (target WCAG 2.2 AA — PROPOSED)

- Semantic landmarks, one `h1` per page, logical headings.
- Meaningful `alt` for content images; decorative pattern tiles `aria-hidden`.
- Full keyboard operability; focus ring per design `3b`: 3px plum outline, 2px offset, `:focus-visible` only.
- Dialog/sheet focus management (Radix).
- Visible labels on inputs (design search fields rely on placeholder text — add accessible labels).
- Touch targets ≥ 44×44px (design complies).
- `prefers-reduced-motion` disables all animation (design complies).
- Never convey info by color alone (design status indicators pair dot + text — keep this).
- Live regions for toasts and offline status.
- Contrast fixes from DC-14 applied in design (plum on lavender, `#7A6E78` checkbox border).

## 8. Screen Coverage

| Screen (Phase 1) | Design | Notes |
|---|---|---|
| Landing (web) | `2a` | Built in P1-07 at `/` from 1024px. Tile radius 20px → `rounded-lg` (18px) and "Punch needle" 24px → `text-greeting` (22px), the nearest tokens |
| Welcome + auth entry (mobile) | `1a` | Google / email / Log in on the welcome screen. Built in P1-07 at `/` (below 1024px; `2a` above); the Google button uses Google's official "G" logo (PO decision, branding guidelines) |
| Sign up (email form), Sign in, Check email, Verify, Forgot/Reset password, Date of birth, Verify-email banner | — | Not designed — built from system in P1-07 following `1a` (wordmark top-left, 448px column); PO review pending |
| Onboarding: interests | `1b` | |
| Onboarding steps 2 (familiarity) and 3 (skills you can help with) | — | Defined in DC-18, not drawn — built from system in P1-11 (level chips per interest; can-help picker). Step headings: design 32px → `text-title` (28px) mobile, `text-title-web` (40px) from 768px; PO review pending |
| Home feed | `1c`, `2b` | Empty state not designed — built from system: mood-board art + "Explore crafts" (PO review) |
| Explore | `1d` | Web not designed. **Built (P1-26, PO review):** designed sections first, then Popular skills / New on dodoi (skill chip rows) and Beginner-friendly projects (masonry); "See all" → `/explore/skills`; search results, skill and theme pages built from the system |
| Search results, Skill page, Theme page | — | Not designed |
| Post / tutorial detail | `1e`, `2c` | Attribution block, persisted materials/steps (DC-07, DC-10) |
| Home (tablet) | `3c` | |
| Error, focus, coming-soon patterns | `3b` | |
| Saved / collections | `1i` (profile tab) | Collection detail, picker not designed. **Built (P1-25, PO review):** `/saved` = collections row (sideways on mobile, grid from 768px) then All saved masonry; `/saved/{id}` collection page; picker = `sheet` dialog (checkbox per collection, "New collection" inline, Done) |
| Public profile | `1i` | Own profile ends with the account card (Settings and privacy · Log out) below 1280px, per design v3. **Tabs (P2-02/P2-03, 2026-10-29):** Projects · Collections · Posts as `Tabs`; Posts opens first when there are posts, then Projects; Projects = project cards (owner also sees private ones, with a lock); the owner sees "Your drafts" (sideways strip, "Draft" badge) above the post masonry; empty Posts for the owner = "Share something you made" + Create a post |
| Edit profile, Settings, Account deletion | — | Not designed. **Built (P1-14, PO review):** `/settings` list → Edit profile, Your skills, Privacy, Account (single centred column, back link); profile `/u/{username}` per `1i` with DC-08 groups (Can help with = coral, Want to learn = butter, Interests = outline, level after the name); **account deletion (P1-28, PO review):** Account → *Delete account* → `/settings/account/delete` (what happens, then password or *Confirm with Google*, destructive button) → in-place confirmation; `/account-deletion` blocking screen in the auth frame (*Cancel deletion* / *Sign out*) |
| Admin posts/themes/skills | — | Not designed — built from system in P1-17 (`/admin`, top bar + sections in cards, sticky action bar); PO review pending |
| Admin Coverage (`/admin/coverage`) | — | Not designed — built from the admin system (P1-19): summary box (gaps count, danger-surface; mint when 0), then Skills · Post types · Themes, each "n of m met" + its rule; cards show name (+ lavender "Focus" pill), counts, and status as icon + text ("Met" / "6 more posts, 2 more tutorials"); rows below minimum first. PO review pending |

**Rule for undesigned screens (CONFIRMED):** build them only from the tokens (§2), components (§4), layout (§3) and voice (§6) in this document — no new colors, fonts, radii or component styles. Each such screen is a review item: the agent reports it as "built from system, needs product-owner review" with screenshots at mobile, tablet and desktop (390 / 834 / 1280px), and the screen is not done until reviewed. **Every screen is built for all three widths in the same task** (PO instruction, 2026-10-24) — never mobile-only.
| Empty, error, offline, not found, skeletons | — | Not designed (design's own "Try next" lists these) |

| Screen (Phase 2, CONFIRMED — P2-00) | Design | Notes |
|---|---|---|
| Create post: media, details, skills and tags, materials and steps, preview | — | Not designed. **PO request (2026-10-28): must be really interactive, attractive and easy** — see §8.1. **Built (P2-02, 2026-10-29; PO review at 390/834/1280):** full screen at `/create` and `/create/{id}`, outside the app shell (like onboarding); header ×/← · step name + "Saved as draft" · Next/Share/Save; phones repeat the action in a bottom bar. Pick = butter mood-board drop area, then a 4:5 preview (4:3 from 768px) on ink with the thumbnail strip (progress rings, mint check, × remove, dashed "Add") and "Pick up where you left off" drafts under the empty drop area. Arrange = cards with thumbnail + "Cover" band, alt-text field, arrows (drag handle from 768px), counter pill butter → mint. Details = cover beside a borderless greeting-size title, story field, rows (Type · Crafts · Tags · Materials and steps · Difficulty and time) with a coral dot when needed and a danger-surface row on errors; feed-card preview from 1024px (inert, hidden from assistive tech). Sheets use the shared `sheet` dialog (bottom on phones, centred panel from 768px — not side panels); Type = six pattern-backed cards; Crafts = the onboarding picker plus starred main-skill chips. Own-work tick in a butter box. Celebration = 36 confetti pieces in the six accents (`animate-dd-confetti`, once; hidden with reduced motion) and a "Posted!" card with Share it / See your post. Step photos (2026-10-29): "Add a photo" under each step in the Materials and steps sheet → progress ring → 64px thumbnail with × and a "Describe the photo" field. **Deviation, PO to confirm:** sheets are centred panels (not side panels) from 1024px |
| Journal: project list, project page, add entry | `1g` | **Built (P2-03, 2026-10-29; PO review at 390/834/1280):** project page per `1g` at `/projects/{id}` (full screen on phones like `1e`, bottom bar "Add progress entry" + "Share"; from 768px the two buttons sit under the header): sand overline label "Project · in progress / finished", title-size heading, meta line, materials checklist card, timeline — 14px dot (coral on the newest, paper with brick ring on older) and a 2px lavender-gingham line, "Entry n · when" meta, 17px entry title, one photo full width or 2-up grid, body; owner ⋯ menu. List `/journal`: In progress / Finished sections of 4:3 project cards (newest entry's photo or the craft's pattern, status label, lock when private). Entry sheet: title, text, 4-photo grid with progress rings. **Deviations, PO to confirm:** the newest dot doesn't pulse (no looping motion, 2026-10-28 decision); entries have an optional title (design shows one; spec had none) |
| Comments, like heart, Follow button | — | Built from the system: **Heart built (P2-05, 2026-10-29; PO review at 390/834/1280):** 44px round outline icon button — left of Save to collection in the tablet/desktop action row, left of the two buttons in the phone bar — filled coral when liked, `aria-pressed`, "Like" / "Unlike" labels; the post's author also sees "{n} likes" above the description. Follow replaces the coming-soon button in place. **Comments built (P2-04, 2026-10-29; PO review at 390/834/1280):** "Comments (n)" section — below "More like this" under 1024px, in the details column below the steps from 1024px (`CommentsSection` mounts only the placement that fits). Field "Add a comment" + Post at the top, comments oldest first as avatar (initial on butter when none), name (links to the profile), "today / 3 days ago" and "· edited", text, "Reply"; replies indented under a 2px line with the first 3 shown and "View n more replies"; "Reply" opens a field under the thread starting with @username; ⋯ menu with Edit and Delete (own) or Delete (post author on others'), Delete asks "Delete this comment?"; a deleted comment with replies reads "Comment deleted" in muted italic. States: skeleton, "No comments yet. Be the first to say something.", error banner with Try again, "Show more comments" (20 at a time). Signed out: the count and "Sign in to read and join the comments."; unverified: "Verify your email to comment." Report and Block join the menu with P2-08 |
| Notifications page, bell dot, notification settings | — | Built from the system; bell keeps its `1c` position and gains a coral dot. **Built (P2-07, 2026-10-29; PO review at 390/834/1280):** the bell is a link ("Notifications" / "Notifications, new") with a 10px coral dot, in the phone header and the feed header from 768px (there is no designed bell elsewhere at tablet/desktop — **PO to confirm**). `/notifications`: single centred column, Back, "Notifications" title, rows of avatar + sentence ("Asha commented on …", "Ravi and 3 others liked …", "Meera followed you") + "today / 3 days ago", unread rows tinted with a coral dot, "Show more"; states: skeleton, "Nothing new yet", error banner with Try again. `/settings/notifications`: four switch rows in the Settings card style |
| Block dialog, blocked accounts, moderator reports view | — | Built from the system (P1 report dialog and admin reports list) |

### 8.1 Create post experience (PO request 2026-10-28, P2-02)

The PO asked for a Create post flow that is "really interactive, attractive and user catchy … easy peasy", and allowed going beyond the plain system screens. Direction (from upload-UX and composer references, see the P2-02 roadmap note):

**PO choice (2026-10-28): the Instagram flow.** Three screens, then Share — F-17.

1. **Photos first, uploading at once.** The Create button opens `/create` on the big drop area, whose "Choose photos" opens the system picker (a web page can't open the picker without a tap, nor draw the phone's gallery itself; Instagram web does the same); phones also get "Take a photo" (camera). Uploads start the moment files are picked, so the later screens never wait (Instagram's trick); each thumbnail shows its own progress ring, then a soft check.
2. **Pick → Arrange → Details → Post** (the last button is "Post", not "Share": PO decision 2026-10-29, "share" only means sending a link). *Pick*: big preview (4:5 on phones, the cover's real ratio from 768 px) with a thumbnail strip below. *Arrange*: reorder, cover, alt text. *Details*: Instagram's caption screen — cover thumbnail beside title and story, then rows (Type · Skills · Tags · Materials and steps · Difficulty and time) that open bottom sheets on phones and side panels from 1024 px. "Next" / "Share" sit top right as on Instagram, mirrored in a bottom bar on phones for thumb reach. No filters or crop in P2 (craft photos are shown as taken).
3. **Live preview.** From 1024 px the Details screen shows the post card beside the rows, updating as you type; on phones the "Preview" link opens the full post view.
4. **Type as a playful choice.** The six post types as large illustrated chips with a one-line meaning ("First attempt — you tried something new"); shown in the Type sheet; the choice shapes the Details rows (Tutorial adds steps and time).
5. **Smart help, never blocking.** Skills suggested from the maker's interests and recent posts; tag suggestions as chips; rotating title prompts ("My first …", "Halfway through …"); alt text asked per photo with a friendly counter ("2 of 3 photos described").
6. **Tactile editing.** Drag to reorder photos (arrows too, for keyboards), "Cover" badge on the first; steps and materials added inline with Enter; spring-light motion on add/remove using the motion tokens.
6b. **Photo editor (PO request 2026-10-29).** "Edit photo" (on the Pick preview and each Arrange card) opens a sheet: the photo in an ink-framed crop area with a rule-of-thirds guide; drag (pointer or arrow keys) to place it, zoom with the slider, −/+ or the wheel, rotate left/right; shapes Original · Square · 4:5 · 3:4 · 16:9 as filter-style chips; "Start over" and "Use this photo". The result (JPEG ≤ 2,400 px, from the picked file itself) replaces the photo in place and uploads again with its description. Photos under 600 px on the short side show a butter "Small photo" chip and a note on Arrange — never a block.
7. **Never lose work.** "Saved as draft · just now" in the screen header; leaving and coming back offers "Pick up where you left off".
8. **One celebration.** Publishing plays a short burst of craft-pattern confetti and "Posted! Share it?" (Web Share) — only there, never on each step.

Limits on the motion: `prefers-reduced-motion` turns every animation into a plain fade; no looping or floating images (PO decision 2026-10-28, §2.5); colours, type and radii stay the tokens. Any new library (e.g. drag-and-drop, confetti) needs PO approval first (AI_DEVELOPMENT_RULES §6) — the default is to build both with CSS and pointer events.

| Later-phase screens already designed | Phase |
|---|---|
|---|---|
|---|---|
| AI companion (`1f`, docked in `2c`) | P4 — **spec approved 2026-10-29 (PRODUCT_REQUIREMENTS §6.2, USER_FLOWS F-23…F-26)** |
| Creative journal (`1g`) | P2 |
| Community · help requests (`1h`) | P3 |
| Right-rail help/session cards (`2b`) | P3 |

## 9. Design Deliverables Status

| Item | Status |
|---|---|
| Palette | Done (design) — danger color and contrast fixes OPEN |
| Typeface | DM Sans — CONFIRMED |
| Product name / wordmark | "dodoi" — CONFIRMED |
| App icon (PWA 192/512/maskable) | OPEN |
| Patterns / placeholder style | Done (design) |
| Missing Phase 1 screens (§8) | OPEN |
| Tablet layout | Done (`3c`) |

## 10. Design ↔ Docs Conflicts Register

Each item is OPEN until the product owner decides. Resolved items move into the relevant section above and are marked CONFIRMED.

| ID | Conflict | Options |
|---|---|---|
| DC-01 | ~~Product name~~ | **Resolved:** "dodoi" |
| DC-02 | ~~Calibri licensing~~ | **Resolved:** design switched to DM Sans (free) |
| DC-03 | ~~Unbuilt features in nav~~ | **Resolved:** show as disabled "coming soon" |
| DC-04 | ~~Feed filter chips~~ | **Resolved:** Phase 1 (FEED-13) |
| DC-05 | ~~"New to you" card~~ | **Resolved:** Phase 1 (FEED-14) |
| DC-06 | ~~Post type labels~~ | **Resolved:** design set + Tip |
| DC-07 | ~~Materials/steps persistence~~ | **Resolved:** saved per user, synced across devices |
| DC-08 | ~~Profile skill groups~~ | **Resolved:** keep docs model — profile shows **Interests** (chip + level) · **Can help with** · **Want to learn**, reusing the design's overline + chip styling from `1i` |
| DC-09 | ~~Skill hints / use what you have~~ | **Resolved:** skill hints are editor-set tags in Phase 1; "Use what you have" is Phase 2, shown as coming soon in `1d` |
| DC-10 | ~~Attribution block~~ | **Resolved:** block below steps on every seeded post (`1e`) |
| DC-11 | ~~Undesigned Phase 1 screens~~ | **Resolved:** build from the design system; product owner reviews (see §8 rule) |
| DC-12 | ~~Sidebar vs top bar~~ | **Resolved:** sidebar everywhere; collapses to icon rail on detail pages with docked companion |
| DC-13 | ~~Tablet~~ | **Resolved:** `3c` — icon rail, 2-column feed, no right rail |
| DC-14 | ~~Contrast failures~~ | **Resolved:** plum on lavender; checkbox border `#7A6E78` |
| DC-15 | ~~Error color~~ | **Resolved:** `#B3261E` / `#FBE3E0` |
| DC-16 | ~~Focus state~~ | **Resolved:** 3px plum outline, 2px offset, `:focus-visible` |
| DC-17 | ~~Target market~~ | **Resolved:** India first (₹, IST default) |
| DC-19 | ~~Coming-soon treatment~~ | **Resolved:** dashed border, muted text, butter pill, not tappable (`3b`) |
| DC-20 | ~~Right rail in Phase 1~~ | **Resolved:** New to you + You could help with; Live sessions coming soon |
| DC-18 | ~~Onboarding steps~~ | **Resolved:** interests (min 3) → familiarity (optional) → skills you can help with (optional) |
| DC-21 | ~~Nav/small-control coming-soon look~~ | **Resolved:** muted icon/button + butter "Soon" pill, tooltip only. *Design file to be updated to match* |
| DC-22 | ~~"You could help with" in P1~~ | **Resolved:** "Help other makers" coming-soon card with user's can-help skills as chips |
| DC-23 | ~~Detail page sidebar in P1~~ | **Resolved:** full sidebar in P1; icon rail from P4 |
| DC-24 | ~~Step interaction~~ | **Resolved:** tap circle to mark done/undo + "Next step" button; count = completed steps. *Design file to be updated to match* |
| DC-25 | ~~Creative Commons~~ | **Resolved:** allowed source, CC BY and CC BY-SA only |
| DC-26 | ~~Username~~ | **Resolved:** auto-generated at sign-up, editable later, first-profile-visit prompt |
| DC-28 | ~~Skip on step 1~~ | **Resolved:** removed on step 1; kept on steps 2–3. *Design file to be updated to match* |
| DC-27 | ~~Creator row on seeded posts~~ | **Resolved:** invited creators = real accounts with creator row (Follow = coming soon in P1, live from P2-06); stock/CC posts = no creator row, "via dodoi editors" line + attribution block. *Design file to be updated to match* |

### 8.2 AI companion (P4-00, approved 2026-10-29)

Built from designs `1f` (mobile chat, image troubleshooting) and `2c` (docked companion on the post page); tablet and the Companion list/settings screens are built from the system; everything on `--palette-ai-surface` (`#F8F3FB` with lavender dots) per §2.

| Element | Spec |
|---|---|
| Entry points | "Ask dodoi" pill / sidebar card go live (leaving coming-soon, DC-21); "Ask about this" on posts; "What is this and how do I start?" on skill pages |
| Chat screen | Header "dodoi companion" with Back; context line "Looking at: {title}" (a chip with the post thumbnail); user bubbles on the right, assistant on the left with a small **AI** label; the answer ends with a muted uncertainty line when the model gave one; row of actions: Helpful / Not helpful, Report. Field "Ask about a technique…" with a photo button and send |
| Photo | Thumbnail in the user bubble; consent sheet before the first photo (sheet on phones, centred from 768px) |
| Plan card | Title, craft chip, materials checklist (read-only), numbered steps, **Start as my project** |
| Docked panel | From 1280px on post and skill pages: right column, "Talking about: {title}"; the sidebar becomes the 76px icon rail (DC-12) |
| States | Typing indicator; empty ("Ask me about a craft, a technique or what to try next"); quota, off, blocked and error messages (F-23 step 5); offline: the field is disabled with "You're offline" |
| Not built | "Show me a diagram" (in `1f`, not in scope); "Ask the crochet community" is a coming-soon button until P3-03 |
| Accessibility | Chat log is an `aria-live="polite"` region; the field keeps focus after sending; all controls 44px; reduced motion removes the typing animation |

**Settings → AI and privacy:** two switch rows (photos; interests and levels), conversations list with Delete, Delete all with confirmation; styled like the other Settings screens (§8 Settings rows).

