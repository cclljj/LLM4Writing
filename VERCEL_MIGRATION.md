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

## Not Yet Production-Grade

- Persistence is currently in-memory (`src/lib/store.ts`)
- Multi-instance consistency is not guaranteed
- Authentication and role-based authorization are not added yet
- Legacy DB schema (MySQL/Mongo) has not been fully migrated to a Vercel-friendly data layer

## Recommended Next Migration Steps

1. Replace in-memory store with managed DB (Vercel Postgres/Neon + Prisma)
2. Add auth (NextAuth/Auth.js or custom JWT)
3. Port teacher/student management screens from legacy app
4. Migrate essay/tree/report data models and historical logs
5. Add test suites for step transitions and mode constraints

## Legacy Code Status

- Legacy Java/Wicket modules are preserved:
  - `libs/`
  - `llm4class-web/`
- They are no longer required for Vercel deployment path.
