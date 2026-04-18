# Vercel-native Migration Plan (Implemented Baseline)

## Objective

Convert the project from Java/Wicket monolith deployment model to Vercel-native architecture.

## What Has Been Migrated Now

- New Vercel-native app created at repo root
- Next.js App Router pages:
  - `/`
  - `/student`
  - `/teacher`
- Serverless APIs implemented:
  - `GET /api/health`
  - `GET /api/spec`
  - `POST /api/session/start`
  - `GET /api/session/:sessionId`
  - `POST /api/chat/send`
  - `POST /api/teacher/step`
- Core interaction engine implemented for all 10 steps with 4 interaction modes
- Session store upgraded to Postgres persistence (`llm4writing_sessions`)

## Rule Mapping from SPEC

1. Teacher-controlled step switching
- Implemented via `POST /api/teacher/step`

2. Interaction mode constraints
- Step mode table implemented in `src/lib/spec.ts`

3. Group interaction response gate (steps 1/2/4)
- AI response only after all participants replied once

4. Non-interactive steps (5/7/10)
- Automatically generate one-shot report after step switch

5. Personal reflection step (9)
- System asks fixed questions; no AI reply

## Persistence Status

- Primary: Postgres via `postgres` driver (Vercel/Neon compatible)
- Table auto-init on first access:
  - `llm4writing_sessions(id text primary key, payload jsonb, created_at, updated_at)`
- Local fallback: memory store when `POSTGRES_URL`/`DATABASE_URL` is not set

## Remaining Work to Reach Full Production

1. Add authentication and role-based authorization
2. Port teacher/student management screens from legacy app
3. Migrate essay/tree/report data models and historical logs
4. Add test suites for step transitions and mode constraints
5. Add observability and retention policy for logs/session data

## Legacy Code Status

- Legacy Java/Wicket modules are preserved:
  - `libs/`
  - `llm4class-web/`
- They are no longer required for Vercel deployment path.
