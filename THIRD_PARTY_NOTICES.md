# Third-Party Notices

## List of Dirty, Naughty, Obscene, and Otherwise Bad Words

- Source: https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words (English `en` and Hindi `hi` lists, retrieved 2026-10-21)
- License: Creative Commons Attribution 4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/
- Used in: `src/server/modules/skills/blocklist-data/ldnoobw.ts` to reject offensive custom interest names.
- Changes: lists are stored unmodified; a reviewed set of craft-safe exceptions is excluded at runtime in `src/server/modules/skills/blocked-terms.ts`.
