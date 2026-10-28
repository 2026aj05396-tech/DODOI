<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## dodoi project rules

Read [docs/AI_DEVELOPMENT_RULES.md](docs/AI_DEVELOPMENT_RULES.md) before any change. Two rules apply to every change, however small:

- **Docs in the same change.** Every request, flow change, copy change, design update or decision the product owner mentions is written into the docs in the same change as the code — README §2 for decisions, then the documents in the map in AI_DEVELOPMENT_RULES §13.
- **No git writes.** Leave every change uncommitted; the product owner does all git operations (§11).
