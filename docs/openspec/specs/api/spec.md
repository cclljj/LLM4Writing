# API Specification

## Scope

This domain describes externally visible API contracts, response shapes, route responsibilities, and important error behavior.

## Requirements

### Requirement: Auth API Contract

The system SHALL expose login, logout, current-user, health, and public workflow-spec endpoints with stable response behavior.

#### Scenario: Login success

- **GIVEN** valid credentials are submitted to `POST /api/auth/login`
- **WHEN** authentication succeeds
- **THEN** the response is `{ "ok": true, "user": ..., "redirectTo": ... }`

#### Scenario: Login failure

- **GIVEN** invalid credentials are submitted
- **WHEN** authentication fails
- **THEN** the response is HTTP 401 with `invalid_credentials`

#### Scenario: Login service failure secrecy

- **GIVEN** `POST /api/auth/login` encounters a database or auth service failure in production
- **WHEN** the response is returned to the unauthenticated client
- **THEN** the response uses HTTP 503 with a generic detail code
- **AND** the response does not include database credentials, raw PostgreSQL URLs, usernames, passwords, or hostnames from the underlying exception

#### Scenario: Current user absent

- **GIVEN** no valid authenticated session is present
- **WHEN** `GET /api/auth/me` is called
- **THEN** the response is HTTP 401 with `{ "authenticated": false }`

#### Scenario: Health secrecy

- **GIVEN** `GET /api/health` is called
- **WHEN** database status is returned
- **THEN** the response does not include database credentials or other secrets
- **AND** in production failure mode, `db.detail` is a generic code instead of low-level database error text

#### Scenario: Activity-scoped session query efficiency

- **GIVEN** an API route operates on a known `activityId`
- **WHEN** it needs session data for research export, course diagnostics, student join, or monitor activity views
- **THEN** it filters sessions by activity at the storage query layer before building full session payloads
- **AND** routes that only need student-activity existence use an existence or summary query instead of loading full messages, artifacts, and reports

### Requirement: Student Activity APIs

The system SHALL expose student course discovery, joining, and history APIs scoped to the authenticated student.

#### Scenario: Activity listing pagination

- **GIVEN** a student calls `GET /api/student/activities?limit=N&offset=N`
- **WHEN** the request is authorized
- **THEN** the response includes `activities`, `total`, `limit`, and `offset`

#### Scenario: Join active course

- **GIVEN** a student belongs to the activity's class and group
- **WHEN** the student calls `POST /api/student/join` for an in-progress course
- **THEN** the system returns an existing session if present or creates a `spec10` session
- **AND** repeated join calls for the same activity can be used by the client to restore in-progress state after page reload

#### Scenario: Join unavailable course

- **GIVEN** a course is not started, paused, ended, missing, or the student is not in the group
- **WHEN** the student attempts to join
- **THEN** the API returns the corresponding documented error code

#### Scenario: Course history detail

- **GIVEN** a student requests `GET /api/student/course-history/[activityId]`
- **WHEN** the student has participation records for that activity
- **THEN** the response includes viewer, activity, summary, latest session, latest work, and sessions

#### Scenario: Course history does not expose future-step artifacts early

- **GIVEN** a student's latest personal step is before Step4
- **WHEN** `GET /api/student/course-history/[activityId]` returns `latestWork`
- **THEN** Step4 outline content is not exposed from default template data before the student reaches Step4

#### Scenario: Legacy participation recovery

- **GIVEN** participant-index rows are missing for a student's historical sessions
- **WHEN** student overview or history endpoints query participation records
- **THEN** the API still returns participated courses by using compatibility fallback evidence from payload participants or student messages

### Requirement: Session And Chat APIs

The system SHALL expose session read, chat, artifact, and step-specific mutation APIs that enforce participant and step constraints.

#### Scenario: Conditional session read

- **GIVEN** a client calls `GET /api/session/:sessionId` with a matching `If-None-Match`
- **WHEN** the session has not changed
- **THEN** the response is HTTP 304 with no body

#### Scenario: Chat send identity

- **GIVEN** a student calls `POST /api/chat/send`
- **WHEN** the body includes any `userId`
- **THEN** the server uses the authenticated cookie identity and ignores the client-provided identity for authorization

#### Scenario: Step4 classroom discussion moderation

- **GIVEN** a student sends a Step4 peer-discussion message via `POST /api/chat/send`
- **WHEN** the message includes explicit abusive wording
- **THEN** the API rejects it with a student-facing error without appending the message to session history
- **AND** messages asking to use abusive language are also rejected
- **AND** clearly off-topic chatter without classroom relevance is rejected even when short
- **AND** short harmless messages and classroom-linked creative discussion remain allowed
- **AND** rejection messages include a classroom reminder telling students this area is for class discussion and should not go off-topic

#### Scenario: Artifact save

- **GIVEN** a session participant calls `POST /api/session/artifact/save`
- **WHEN** the type is `outline`, `draft6`, or `draft8`
- **THEN** the content is saved to that participant's corresponding artifact slot

#### Scenario: Makeup outline completion API

- **GIVEN** a participant has pending `需補個人結構圖`
- **WHEN** the participant calls `POST /api/session/makeup-outline/complete` with a valid structure tree
- **THEN** the API stores the outline and appends a `makeupWork.outlineEvents` record
- **AND** it does not write Step3 or Step4 group gate completion

#### Scenario: Step6 makeup guard

- **GIVEN** a participant has pending `需補個人結構圖`
- **WHEN** the participant calls Step6 suggest or Step6 complete
- **THEN** the API rejects the request with `makeup_outline_required`

#### Scenario: Step-specific guard

- **GIVEN** a student calls a step-specific endpoint outside the allowed personal or session step
- **WHEN** the endpoint validates the request
- **THEN** it rejects the request without advancing workflow state

### Requirement: SSE Endpoint Contract

The system SHALL use a consistent SSE event contract for step streaming endpoints.

#### Scenario: Streaming chunks

- **GIVEN** a streaming endpoint emits partial text
- **WHEN** a chunk is available
- **THEN** it sends `data: {"type":"chunk","text":"..."}`

#### Scenario: Streaming completion

- **GIVEN** a streaming endpoint finishes successfully
- **WHEN** final state is ready
- **THEN** it sends `data: {"type":"done","session":{...}}`

#### Scenario: Step3 streaming completeness retry

- **GIVEN** `POST /api/session/step3/stream` receives an LLM response with truncation-like quality risk
- **WHEN** the server validates the assembled response before chunk emission
- **THEN** it performs one regeneration attempt with stricter completeness instruction and streams the improved full reply

#### Scenario: Streaming error

- **GIVEN** a streaming endpoint cannot complete normally
- **WHEN** the error is handled
- **THEN** it sends `data: {"type":"error","error":"..."}`

### Requirement: Teacher Learning APIs

The system SHALL expose course control, step switching, monitor, and personal-progress APIs scoped by teacher/admin permissions.

#### Scenario: Step switch audit

- **GIVEN** a teacher or admin calls `POST /api/teacher/step`
- **WHEN** the step switch succeeds
- **THEN** the system writes an audit log with action `teacher_step_switch`

#### Scenario: Monitor summary

- **GIVEN** a teacher or admin calls `GET /api/teacher/monitor`
- **WHEN** no full detail is requested
- **THEN** the API returns summary data, not full messages and artifact payloads
- **AND** when `activityId` is provided, the response remains scoped to that activity so clients can restore monitor context after reload

#### Scenario: Monitor full detail

- **GIVEN** a teacher or admin calls monitor detail with `sessionId` and `detail=full`
- **WHEN** the session is in the authorized activity scope
- **THEN** the API returns full messages, outlines, and Step3 submitted outlines

#### Scenario: Teacher session waiting exclusion

- **GIVEN** a teacher or admin can access a session
- **WHEN** they call `POST /api/teacher/session-attendance`
- **THEN** the API updates only the session-level `本次不列入等待` state for the target participant
- **AND** it records an audit log
- **AND** Step3/4 marking may create `需補個人結構圖` without changing group membership or account data

#### Scenario: Research export includes makeup outlines

- **GIVEN** a course has ended and contains makeup outline records
- **WHEN** teacher/admin exports research data
- **THEN** the JSON schema is `research-student-inputs-v2`
- **AND** makeup outlines are included as `type="makeup_outline"` records
- **AND** anonymous mode does not include raw student accounts

#### Scenario: Course control transition

- **GIVEN** a teacher or admin calls `POST /api/teacher/course-control`
- **WHEN** the requested transition is valid
- **THEN** the course state changes according to `start`, `pause_resume`, or `end`

### Requirement: Admin And Course APIs

The system SHALL expose admin/course management APIs with role-sensitive visibility and documented mutation behavior.

#### Scenario: Diagnostics secrecy

- **GIVEN** an admin calls `GET /api/admin/diagnostics`
- **WHEN** diagnostics are returned
- **THEN** the response includes non-sensitive LLM, KPI, fallback, trend, and artifact health data and excludes secrets

#### Scenario: Diagnostics source clarity

- **GIVEN** an admin calls `GET /api/admin/diagnostics`
- **WHEN** fallback and KPI metrics are computed
- **THEN** the response explicitly indicates whether metrics come from persisted learning events or message-estimation fallback
- **AND** includes warnings when critical event tables are missing or event coverage is insufficient

#### Scenario: Diagnostics trend labels stay stable

- **GIVEN** diagnostics trend series are aggregated from persisted learning events with mixed metadata completeness
- **WHEN** later events contain placeholder labels (for example `—` or unnamed course) for the same class/course key
- **THEN** trend labels keep the best available school/class/course names instead of regressing to placeholders

#### Scenario: Diagnostics skips orphan placeholder rows

- **GIVEN** historical session/event records remain after an activity has been deleted
- **WHEN** trend metadata for those records is placeholder-only and cannot be resolved to meaningful school/class/course labels
- **THEN** diagnostics trend output skips those orphan rows instead of showing placeholder `-` items

#### Scenario: Step1/2 fallback reason completeness

- **GIVEN** Step1/2 fallback events are included in diagnostics samples
- **WHEN** a sample kind is `step12_feedback`, `step12_next_question`, or `step12_round` with `fallback_used=true`
- **THEN** the diagnostics sample includes a non-empty fallback reason category (for example `timeout`, `truncation`, `parse_fail`, or `other`)

#### Scenario: Step3/7/10 fallback reason completeness

- **GIVEN** Step3/7/10 fallback events are included in diagnostics samples
- **WHEN** fallback-used events are recorded for those steps
- **THEN** each sample includes a non-empty fallback reason category (at least `other`)

#### Scenario: Fallback sample error source and precedence

- **GIVEN** diagnostics recent fallback samples are generated
- **WHEN** the system resolves `error_category` for each sample
- **THEN** it uses the fallback event's own `error_category` first
- **AND** only when that field is empty it may match nearby `llm_events` for category hints
- **AND** each sample includes `sampleErrorSource` as `learning_event`, `matched_llm_event`, or `none`

#### Scenario: Recent fallback trace reconstruction for admin diagnostics

- **GIVEN** an admin requests diagnostics and recent fallback events exist
- **WHEN** the backend builds diagnostics payload
- **THEN** it returns `recentFallbackTraces` including timestamp, step/kind, session/activity identifiers, classification source, and reconstructed prompt text
- **AND** reconstructed prompt text is explicitly marked as reconstruction (not guaranteed to be provider raw request body)
- **AND** when session context is unavailable, the trace still returns event-only reconstruction metadata

#### Scenario: Recent fallback traces include original prompt/response and rejection reasons when available

- **GIVEN** Step1/2 fallback debug traces are persisted in session events
- **WHEN** diagnostics recent fallback traces are assembled
- **THEN** each matched trace includes `originalQuestion`, `originalPrompt`, `originalResponse`, and `rejectionReasons`
- **AND** `debugTraceSource` reports `session_event` when matched, otherwise `none`

#### Scenario: LLM call failure traces retain concrete provider error hints

- **GIVEN** a fallback debug trace is recorded because an upstream LLM call failed
- **WHEN** diagnostics renders `recentFallbackTraces`
- **THEN** `rejectionReasons` still includes `llm_call_failed`
- **AND** when available, `rejectionReasons` also includes an HTTP-status hint token such as `llm_http_400`
- **AND** `originalResponse` keeps a compact provider-failure summary for root-cause analysis

#### Scenario: Non-Step1/2 fallback traces are also persisted for diagnostics

- **GIVEN** fallback occurs in Step3/6/7/10 flows
- **WHEN** fallback debug traces are written
- **THEN** diagnostics can surface original prompt/response and fallback reasons for those steps as well

#### Scenario: Step3 teacher advance backfills legacy completion evidence

- **GIVEN** a Step3 group was completed before newer gate signals were introduced
- **WHEN** `groupGate["3-complete"]` is missing but artifact evidence exists (submitted outline snapshot or persisted outline diagnostics)
- **THEN** teacher dashboard readiness still treats the corresponding members as completed and allows step advancement

#### Scenario: Step3 reopen editing cancels completion gate

- **GIVEN** a student has already completed Step3 and entered locked state
- **WHEN** the student triggers reopen editing in Step3
- **THEN** the backend removes that user from Step3 complete gate and marks reopen-editing state until the student completes Step3 again

#### Scenario: Step3 readiness tolerates stale reopen markers

- **GIVEN** a user has completed Step3 again but stale state leaves both `3-complete` and `3-reopen` markers
- **WHEN** teacher dashboard evaluates Step3 advance readiness
- **THEN** readiness prioritizes `3-complete` for that user to avoid false blocking

#### Scenario: Monitor summary recovers legacy payload metadata

- **GIVEN** a persisted Step3 session stores legacy JSON-string payload or misses summary JSON fields
- **WHEN** teacher monitor summary loads sessions for an activity
- **THEN** the summary recovers participants and gate-related metadata from parsed payload or participant split rows so Step3 advance readiness can be evaluated

#### Scenario: Admin store migration

- **GIVEN** an admin calls `POST /api/admin/maintenance/store-migrate`
- **WHEN** the migration executes
- **THEN** the backend runs idempotent session-store schema bootstrap/migration and returns critical table existence status

#### Scenario: Admin fallback report export

- **GIVEN** an admin calls `GET /api/admin/diagnostics/fallback-report?window=12h`
- **WHEN** persisted learning events are available
- **THEN** the API returns event-backed fallback metrics including overall, by-step, by-kind, and by-hour breakdowns

#### Scenario: Open class creation

- **GIVEN** a teacher or admin calls `POST /api/admin/openclasses`
- **WHEN** the selected essay is enabled and the class is authorized
- **THEN** the system creates a new `oc-###` task using the next maximum numeric suffix and records audit data

#### Scenario: Activity deletion conflict

- **GIVEN** a teacher attempts to delete an activity that already has student activity
- **WHEN** `DELETE /api/admin/activities` is called
- **THEN** the API returns HTTP 409 with `task_has_student_activity`

#### Scenario: User CSV import

- **GIVEN** a teacher or admin submits user CSV data
- **WHEN** the CSV does not use `classnumber` as the first column or has an invalid column count
- **THEN** the API rejects the import

#### Scenario: Admin password reset API

- **GIVEN** an authenticated admin calls `POST /api/admin/users`
- **WHEN** the body is `{ "action": "reset_password", "username": "admin", "newPassword": "<valid password>" }`
- **THEN** the API resets the `admin` password through the user store
- **AND** it records `user_reset_password` in the audit log
- **AND** it rejects passwords shorter than 6 characters

#### Scenario: Teacher class report export APIs

- **GIVEN** a teacher or admin calls class report export APIs
- **WHEN** requesting `start`, `status`, `download`, or `cancel`
- **THEN** each endpoint enforces teacher/admin authorization and ownership scoping
- **AND** successful class ZIP downloads are only available after export job status is `succeeded`
