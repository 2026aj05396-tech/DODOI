# Third-Party Notices

## List of Dirty, Naughty, Obscene, and Otherwise Bad Words

- Source: https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words (English `en` and Hindi `hi` lists, retrieved 2026-10-21)
- License: Creative Commons Attribution 4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/
- Used in: `src/server/modules/skills/blocklist-data/ldnoobw.ts` to reject offensive custom interest names.
- Changes: lists are stored unmodified; a reviewed set of craft-safe exceptions is excluded at runtime in `src/server/modules/skills/blocked-terms.ts`.

## DM Sans (static TTF instances)

- Source: Google Fonts DM Sans v1.200 static instances, via the `@expo-google-fonts/dm-sans@0.2.3` package on jsDelivr (retrieved 2026-10-27)
- Copyright 2014-2017 Indian Type Foundry, with Reserved Font Name 'Poppins'; Copyright 2019 Google LLC (DM Sans)
- License: SIL Open Font License 1.1, https://openfontlicense.org
- Used in: `assets/fonts/DMSans_400Regular.ttf` and `DMSans_700Bold.ttf`, read at build time by `src/app/(marketing)/opengraph-image.tsx` to draw the landing page's share image (the app itself loads DM Sans through `next/font`); `assets/fonts/DMSans_800ExtraBold.ttf` (current Google Fonts DM Sans, via `@expo-google-fonts/dm-sans@0.4.2`, retrieved 2026-10-27), read by `scripts/generate-icons.ts` to draw the app icon.
- Changes: none.

## Craft photos (Unsplash)

- Source: Unsplash (retrieved 2026-10-28). Photo IDs, at `https://images.unsplash.com/<id>`:
  - `crochet.jpg` — `photo-1648005539099-709d5be525fb`
  - `sketchbook.jpg` — `photo-1495232416988-d26458b7a5fb`
  - `embroidery-blossom.jpg` — `photo-1695668148100-987abc5841ea`
  - `clay.jpg` — `photo-1764507768797-5b7de6eedcb7`
  - `watercolour.jpg` — `photo-1601049320268-42a9b275068c`
  - `punch-needle.jpg` — `photo-1643190919067-6aab5356bc85`
  - `more-crafts.jpg` — `photo-1604095879468-03fd4a4afaf2`
- License: Unsplash License, https://unsplash.com/license (free for commercial use; attribution not required; photos may not be sold unaltered or used to build a competing service)
- Used in: `public/images/crafts/`, shown on the landing and welcome tiles (`src/components/marketing/craft-tiles.tsx`) and the empty home feed (`src/components/feed/empty-feed-art.tsx`).
- Changes: resized to at most 900 px and re-encoded as JPEG.
