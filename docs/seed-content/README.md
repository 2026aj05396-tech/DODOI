# Seed Content Template (P1-19)

How to write the launch seed posts. Copy this folder's layout into your own seed folder (default `./seed-content`, which git ignores, PO decision P1-18), write one JSON file per post, check it, then import it.

```
seed-content/
├── posts/
│   └── granny-square-first.json   # one file per post; file name = seedKey + ".json"
└── media/
    └── granny-square-first/        # any layout you like; paths in the JSON are relative to seed-content/
        ├── cover.jpg
        └── round-1.jpg
```

The four files in [`posts/`](posts/) are complete examples, one per source type. Their media files are not included, so copy a file, rename it, point it at your own photos and change the text.

## Workflow

1. Write the post file and put its photos/videos next to it.
2. `pnpm seed:content seed-content --check` — validates every file without uploading or saving, then prints **coverage against the launch minimums** (what is still missing).
3. Fix what it reports. A failing file changes nothing.
4. `pnpm seed:content seed-content` — imports into the database in `.env.local` (test site: run it with the test site's variables). Re-running updates posts to match their files.
5. Assign posts to themes in `/admin/themes`, then check **`/admin/coverage`** — it shows skills, post types **and themes** from what is published.

## Launch minimums (OD-31, PO decision 2026-10-28)

Counted from **published** posts. A post counts toward every skill it lists. Hidden and custom skills don't need content.

| What | Minimum |
|---|---|
| Every active predefined skill (51 at launch) | 2 posts |
| Launch-focus skills: Drawing, Sketching, Doodling, Watercolor, Acrylic painting, Calligraphy, Crochet, Amigurumi, Knitting, Embroidery, Punch needle, Pottery, Polymer clay, Origami, Journaling | 6 posts, of which 2 tutorials |
| Every post type (First attempt, Tutorial, Work in progress, Journal, Finished, Tip) | 5 posts |
| Every published theme | 6 posts |

The numbers and the focus list live in `src/lib/constants/seed-coverage.ts`.

## Fields

| Field | Required | Notes |
|---|---|---|
| `seedKey` | yes | Lowercase letters, numbers, dashes. Must equal the file name. Never change it after import (it is how re-runs find the post). |
| `publish` | no (default `false`) | `true` publishes (all publish rules must pass); `false` keeps a draft, or unpublishes. |
| `type` | yes | `FIRST_ATTEMPT` · `TUTORIAL` · `WORK_IN_PROGRESS` · `JOURNAL` · `FINISHED` · `TIP` |
| `title` | yes | ≤ 120 characters. Warm and plain (UI_UX_GUIDELINES §6). |
| `description` | no | ≤ 10,000 characters. |
| `skills` | yes | 1–10 skill **slugs** (`crochet`, `punch-needle`); see `prisma/seed/skills.json`. |
| `primarySkill` | yes | One of `skills`. Decides the card's skill label and the placeholder colour. |
| `mediaFiles` | yes | 1–10 `{ "path", "altText" }`, gallery order. Every image needs alt text describing what is shown. |
| `difficulty` | no | `CURIOUS` · `BEGINNER` · `INTERMEDIATE` · `EXPERIENCED` |
| `estimatedMinutes` | no | Whole minutes; shown on tutorial cards ("Tutorial · 45 min"). |
| `materials` | no | ≤ 50 `{ "name", "note" }`; people tick them off on the post page. |
| `steps` | no | ≤ 50 `{ "text", "mediaFile" }` (`mediaFile` optional). Tutorials should have steps. |
| `attribution` | yes | See below. |
| `authorUsername` | invited creators only | The creator's real dodoi username; `null` otherwise. |

Media: images JPEG, PNG, WebP or HEIC, ≤ 10 MB, at least 600 px on the short side; videos MP4, MOV or WebM, ≤ 60 s, ≤ 50 MB. Unknown keys are rejected. Full contract: API_SPECIFICATION §8.

## Attribution by source

| `sourceType` | `license` | Also required | Shown as |
|---|---|---|---|
| `TEAM_ORIGINAL` | e.g. `Owned by dodoi` | `attributionText` | "via dodoi editors" |
| `INVITED_CREATOR` | e.g. `Used with permission` | `authorUsername` (real account), `attribution.permissionRef` (where the written permission is kept) | Creator row with their profile |
| `STOCK_LICENSED` | e.g. `Unsplash License` | `originalUrl` (the photo's page) | "via dodoi editors" + source link |
| `CREATIVE_COMMONS` | **only** `CC BY` or `CC BY-SA` (with version, e.g. `CC BY 4.0`) | `originalAuthor`, `originalUrl` | "via dodoi editors" + "Adapted from … by …" |

No NC or ND licences, no screenshots of other platforms, nothing without a licence you can name.

## Before you import — checklist

- [ ] File name = `seedKey` + `.json`; `primarySkill` is in `skills`.
- [ ] Every image has alt text that describes it ("Three granny squares in coral and cream on a wooden table").
- [ ] Attribution matches the source table above; links open the original.
- [ ] Tutorials have materials and steps; time and difficulty are honest for a beginner.
- [ ] `--check` passes, and the coverage report moves toward 0 gaps.
