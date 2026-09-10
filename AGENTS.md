# AGENTS.md

This repository uses `AGENTS.md` as the short operating guide for coding agents.

## Project Context

- Product/system behavior is documented in `docs/SPEC.md`.
- OpenSpec documentation lives in `docs/openspec/`.
- Change workflow is documented in `TASK.md`.
- Project workflow skill lives in `.codex/skills/llm4writing-standard-workflow/`.
- `README.md` is the human-facing project overview.

## Working Rules

- Before changing files, open or reuse a GitHub Issue that records the background, scope, and acceptance criteria.
- Before changing behavior, check whether `docs/SPEC.md` and `docs/openspec/` need to be updated.
- Keep implementation, tests, and relevant spec updates in the same change whenever possible.
- If no spec or OpenSpec update is needed, record the reason in the closing Issue comment.
- Do not use `AGENTS.md` as the product specification; keep it concise and operational.

## Verification

- Run `npm run test` for workflow and regression tests.
- Run `npm run build` when behavior, routing, or TypeScript contracts change.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
