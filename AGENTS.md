# AGENTS.md

This repository uses `AGENTS.md` as the short operating guide for coding agents.

## Project Context

- Product/system behavior is documented in `docs/SPEC.md`.
- Change workflow is documented in `TASK.md`.
- Project workflow skill lives in `.codex/skills/llm4writing-standard-workflow/`.
- `README.md` is the human-facing project overview.

## Working Rules

- Before changing behavior, check whether `docs/SPEC.md` needs to be updated.
- Keep implementation, tests, and relevant spec updates in the same change whenever possible.
- Do not use `AGENTS.md` as the product specification; keep it concise and operational.

## Verification

- Run `npm run test` for workflow and regression tests.
- Run `npm run build` when behavior, routing, or TypeScript contracts change.
