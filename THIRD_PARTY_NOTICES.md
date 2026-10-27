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
