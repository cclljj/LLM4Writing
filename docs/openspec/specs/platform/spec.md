# Platform Specification

## Scope

This domain describes system boundaries, roles, storage modes, configuration sources, LLM behavior, core data expectations, and durable system invariants.

## Requirements

### Requirement: Role-Based Product Surface

The system SHALL provide separate student, teacher, and admin capabilities for the writing-learning platform.

#### Scenario: Student learning access

- **GIVEN** an authenticated user with role `student`
- **WHEN** the user enters the student area
- **THEN** the user can view eligible class courses, join allowed activities, participate in the 10-step workflow, save personal artifacts, and view personal history

#### Scenario: Teacher class management

- **GIVEN** an authenticated user with role `teacher`
- **WHEN** the user enters the teacher area
- **THEN** the user can manage visible students, visible class tasks, groups, course state, step switching, and learning monitor views

#### Scenario: Admin global management

- **GIVEN** an authenticated user with role `admin`
- **WHEN** the user enters the admin area
- **THEN** the user can manage global accounts, activities, diagnostics, and audit logs

### Requirement: Dual-Mode Persistence

The system SHALL use PostgreSQL when configured and SHALL fall back to memory or file-backed storage when database access is not available.

#### Scenario: Database-backed runtime

- **GIVEN** `SUPABASE_DB_URL`, `POSTGRES_URL`, or `DATABASE_URL` is configured and reachable
- **WHEN** the app reads or writes sessions, users, domain data, diagnostics, or audit logs
- **THEN** the corresponding PostgreSQL-backed store is used

#### Scenario: Fallback runtime

- **GIVEN** no database is configured or the relevant database operation cannot be used safely
- **WHEN** the app reads or writes supported runtime data
- **THEN** the app falls back to memory or file storage without blocking local development and tests

### Requirement: Session Data Integrity

The system MUST preserve session core payload, messages, artifacts, reports, events, participants, LLM events, and learning events as separable persisted concerns when PostgreSQL is enabled.

#### Scenario: Version-aware save

- **GIVEN** two writers attempt to update the same session
- **WHEN** the store detects a version conflict
- **THEN** it reads the latest version, merges once, and avoids silently overwriting newer session data

#### Scenario: Participant index query

- **GIVEN** a student requests overview or history data
- **WHEN** PostgreSQL is enabled
- **THEN** the system uses the participant index instead of scanning every session payload in application memory

#### Scenario: Participant index compatibility fallback

- **GIVEN** legacy sessions exist but participant-index rows are missing or incomplete
- **WHEN** a participant-scoped query returns no rows from the index path
- **THEN** the system falls back to payload participants and student-message evidence to recover participation history

### Requirement: Prompt Configuration Source

The system SHALL load prompt configuration from `src/config/system-prompt-config.json` and SHALL NOT allow prompt configuration writes through the UI or API.

#### Scenario: Activity-specific question bank

- **GIVEN** an activity has an essay identifier or matching title
- **WHEN** prompt configuration is resolved for that activity
- **THEN** activity-specific question banks under `writingTasks` are preferred when available

#### Scenario: Read-only prompt API

- **GIVEN** a teacher or admin calls a prompt configuration write endpoint
- **WHEN** the endpoint receives the request
- **THEN** it rejects writes with `prompt_config_readonly_use_filesystem_json`

### Requirement: Remote LLM Fallback

The system SHALL call a remote OpenAI-compatible LLM only when `LLM_URL`, `LLM_KEY`, and `LLM_MODEL` are all configured, and SHALL provide safe fallback responses otherwise.

#### Scenario: Fully configured LLM

- **GIVEN** all required LLM environment variables are present
- **WHEN** a learning step needs AI output
- **THEN** the app calls the configured remote LLM and persists the AI response where required

#### Scenario: Missing or failing LLM

- **GIVEN** LLM configuration is incomplete or the remote call fails after retry/fallback handling
- **WHEN** a learning step needs AI output
- **THEN** the app returns a student-readable fallback and does not leave the workflow permanently blocked

### Requirement: Student-Visible Text Hygiene

The system MUST sanitize AI-generated text before showing it to students.

#### Scenario: Structured output leakage

- **GIVEN** an LLM returns JSON wrappers, code fences, field names, or partial structured output
- **WHEN** the response is prepared for a student-facing view
- **THEN** the system removes development-format residue or falls back to a safe readable message

### Requirement: Durable Invariants

The system MUST preserve the core invariants documented by the implementation spec.

#### Scenario: Class ownership invariant

- **GIVEN** a school and class number already belong to one teacher
- **WHEN** another teacher attempts to create or update a student into the same school/class pair
- **THEN** the system rejects the operation with a class ownership conflict

#### Scenario: Prompt invariant

- **GIVEN** a runtime flow needs prompts
- **WHEN** prompt content is resolved
- **THEN** the content comes from file-backed prompt configuration, not from mutable database state

#### Scenario: Monitor privacy invariant

- **GIVEN** a teacher views monitor summaries
- **WHEN** Step6 or Step8 artifacts are included in diagnostics
- **THEN** the monitor exposes summary diagnostics and not full draft text
