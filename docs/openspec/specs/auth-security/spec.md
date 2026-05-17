# Auth And Security Specification

## Scope

This domain describes authentication, authorization boundaries, CSRF/origin protection, rate limiting, password storage, session cookies, presence state, and security headers.

## Requirements

### Requirement: Server-Signed Authentication Session

The system SHALL authenticate users with a server-signed HTTP-only `llm4w_session` cookie.

#### Scenario: Successful login

- **GIVEN** a user submits valid credentials
- **WHEN** login succeeds
- **THEN** the response sets `llm4w_session`, clears legacy client-forgeable role cookies, and returns the role-specific redirect target

#### Scenario: API identity verification

- **GIVEN** a request contains a session cookie
- **WHEN** an API route needs the authenticated user
- **THEN** the server verifies token signature, expiration, stored user role, and `sessionVersion`

### Requirement: Production Auth Secret

The system MUST require `AUTH_SECRET` or compatible `SESSION_SECRET` in production.

#### Scenario: Missing production secret

- **GIVEN** the app runs in production without a configured auth secret
- **WHEN** authentication code attempts to create or validate sessions
- **THEN** the system must not silently use a development default secret

### Requirement: Password Hashing

The system MUST store passwords as bcrypt hashes and MUST NOT expose password values in user listing or lookup responses.

#### Scenario: New or reset password

- **GIVEN** an admin or teacher creates, resets, or updates a password
- **WHEN** the user store persists the password
- **THEN** the stored value is a bcrypt hash

#### Scenario: Legacy plaintext migration

- **GIVEN** an existing stored password is plaintext
- **WHEN** a user logs in successfully with that password
- **THEN** the system immediately rewrites the password as a bcrypt hash

### Requirement: Role And Ownership Authorization

The system SHALL enforce student, teacher, and admin data boundaries.

#### Scenario: Student session boundary

- **GIVEN** a student attempts to save an artifact
- **WHEN** the target session does not include that student as a participant
- **THEN** the request is rejected

#### Scenario: Teacher visibility boundary

- **GIVEN** a teacher manages students, tasks, groups, or monitor data
- **WHEN** the target data is outside the teacher's visible students or classes
- **THEN** the request is rejected or the data is omitted

#### Scenario: Admin global boundary

- **GIVEN** an admin performs a management action
- **WHEN** the target resource exists
- **THEN** the admin may operate across teacher boundaries subject to route-specific constraints

### Requirement: Mutating API Origin Guard

The system MUST validate same-origin requests for mutating admin, teacher, and session API routes.

#### Scenario: Valid origin

- **GIVEN** a `POST`, `PUT`, `PATCH`, or `DELETE` request targets `/api/admin/*`, `/api/teacher/*`, or `/api/session/*`
- **WHEN** `Origin` or `Referer` matches the current request host and protocol
- **THEN** the request may proceed to route handling

#### Scenario: Missing origin information

- **GIVEN** a protected mutating request lacks both `Origin` and `Referer`
- **WHEN** the proxy validates the request
- **THEN** it returns `403 { error: "missing_origin" }`

#### Scenario: Cross-origin request

- **GIVEN** a protected mutating request includes a different origin
- **WHEN** the proxy validates the request
- **THEN** it returns `403 { error: "invalid_origin" }`

### Requirement: API Rate Limiting

The system SHALL rate-limit `/api/*` requests with Redis-backed state when available and memory fallback otherwise.

#### Scenario: Login limit exceeded

- **GIVEN** one IP exceeds the `/api/auth/login` limit within the configured window
- **WHEN** another login request is received
- **THEN** the system returns HTTP 429 with `rate_limit_exceeded` and `retryAfterSeconds`

#### Scenario: Redis unavailable

- **GIVEN** Upstash Redis is not configured or temporarily fails
- **WHEN** rate-limit logic runs
- **THEN** the system uses process memory fallback and continues handling the request

### Requirement: Presence Is Ephemeral

The system SHALL track session presence as short-lived runtime state outside the persisted session payload.

#### Scenario: User online marker

- **GIVEN** a user reads a session
- **WHEN** presence is marked
- **THEN** the online state is written to Redis with TTL when available, or memory fallback otherwise

#### Scenario: ETag stability

- **GIVEN** presence is updated
- **WHEN** the session payload itself is unchanged
- **THEN** the presence update does not modify session `updated_at` or invalidate the session ETag

### Requirement: Security Headers

The system SHALL apply baseline browser security headers to all routes.

#### Scenario: Frame embedding

- **GIVEN** a browser receives a route response
- **WHEN** headers are applied
- **THEN** frame embedding is denied through CSP `frame-ancestors 'none'` and `X-Frame-Options: DENY`

#### Scenario: Production transport security

- **GIVEN** the app runs in production
- **WHEN** headers are applied
- **THEN** `Strict-Transport-Security` is included

