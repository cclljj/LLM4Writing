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

#### Scenario: Current user absent

- **GIVEN** no valid authenticated session is present
- **WHEN** `GET /api/auth/me` is called
- **THEN** the response is HTTP 401 with `{ "authenticated": false }`

#### Scenario: Health secrecy

- **GIVEN** `GET /api/health` is called
- **WHEN** database status is returned
- **THEN** the response does not include database credentials or other secrets

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

#### Scenario: Join unavailable course

- **GIVEN** a course is not started, paused, ended, missing, or the student is not in the group
- **WHEN** the student attempts to join
- **THEN** the API returns the corresponding documented error code

#### Scenario: Course history detail

- **GIVEN** a student requests `GET /api/student/course-history/[activityId]`
- **WHEN** the student has participation records for that activity
- **THEN** the response includes viewer, activity, summary, latest session, latest work, and sessions

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

#### Scenario: Artifact save

- **GIVEN** a session participant calls `POST /api/session/artifact/save`
- **WHEN** the type is `outline`, `draft6`, or `draft8`
- **THEN** the content is saved to that participant's corresponding artifact slot

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

#### Scenario: Monitor full detail

- **GIVEN** a teacher or admin calls monitor detail with `sessionId` and `detail=full`
- **WHEN** the session is in the authorized activity scope
- **THEN** the API returns full messages, outlines, and Step3 submitted outlines

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

