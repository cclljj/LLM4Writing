---
name: llm4writing-standard-workflow
description: "Use for every llm4writing repository code, documentation, configuration, or behavior change that should follow the project standard workflow: create a GitHub issue with requirements and acceptance criteria, implement, verify, check README/SPEC/OpenSpec, commit and push, then close the issue."
---

# LLM4Writing Standard Workflow

Use this workflow for project edits unless the user explicitly asks to skip it.

## Workflow

1. Open a GitHub issue before changing files.
   - Describe the background, requested work, scope, and acceptance criteria.
   - Include the planned verification commands when they are known.
   - If a related issue already exists, reuse it instead of opening a duplicate.

2. Implement the change.
   - Keep the implementation focused on the issue scope.
   - Do not revert unrelated user or collaborator changes.
   - Keep code, tests, and applicable docs in the same change when feasible.

3. Verify against the acceptance criteria.
   - Run targeted checks first when useful.
   - Run `npm run test` for workflow and regression coverage.
   - Run `npm run build` when behavior, routing, or TypeScript contracts change.
   - Run `npm run lint` when code style, React hooks, or TypeScript cleanup is part of the work.
   - If verification fails, return to step 2, fix, and verify again.

4. Check documentation impact.
   - Inspect whether `README.md`, `docs/SPEC.md`, and `docs/openspec/` need updates.
   - Update docs when behavior, API contracts, permissions, data models, workflows, or user-visible operations change.
   - If no documentation update is needed, record the reason in the issue summary.

5. Commit and push to GitHub.
   - Review `git diff` and `git status` before staging.
   - Commit with a concise message that reflects the change.
   - Pull with `git pull --ff-only origin main` before pushing when working on `main`.
   - Push to the project fork remote, not the upstream source repo.

6. Close the GitHub issue.
   - Comment with implementation summary, docs decision, verification results, commit hash, and push status.
   - Close the issue only after the commit has been pushed successfully.

## Notes

- Project source of truth: `docs/SPEC.md` for behavior, `docs/openspec/` for OpenSpec documentation, `README.md` for human-facing overview, and `TASK.md` for repository workflow.
- Prefer exact issue references in commits or issue comments when useful.
- If the user asks for emergency investigation only, gather evidence first; open/update the issue before making code changes.
