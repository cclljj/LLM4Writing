# Teacher And Admin Experience Specification

## Scope

This domain describes teacher and admin UI behavior, course management, learning monitor, reporting, diagnostics, and audit-log expectations.

## Requirements

### Requirement: Teacher Workspace Tabs

The teacher workspace SHALL provide account management, course management, and learning management capabilities.

#### Scenario: Teacher page access

- **GIVEN** an authenticated teacher opens `/teacher`
- **WHEN** the page loads
- **THEN** the teacher can reach account management, course management, and learning management areas for authorized data

#### Scenario: Admin shared workspace

- **GIVEN** an authenticated admin opens `/admin`
- **WHEN** the page loads
- **THEN** the admin can use global versions of the shared management capabilities

#### Scenario: Reload restores workspace tab and monitor course context

- **GIVEN** a teacher or admin is working on a non-default workspace tab
- **WHEN** the page is refreshed
- **THEN** the UI restores the previously selected tab instead of always returning to the first tab
- **AND** if the user is in learning management with a selected course, the monitor restores that `activityId` context after reload

### Requirement: Account Management

The system SHALL support role-aware account CRUD, reset password, and CSV batch creation.

#### Scenario: Teacher manages own students

- **GIVEN** a teacher views user management
- **WHEN** the user list is loaded
- **THEN** the teacher sees only their own account and students they own

#### Scenario: Student account requirements

- **GIVEN** a student account is created or updated
- **WHEN** required ownership or class fields are missing
- **THEN** the system rejects the operation

#### Scenario: Secure temporary password generation

- **GIVEN** the account management UI generates a temporary password
- **WHEN** the password is produced in the browser
- **THEN** it uses cryptographically secure randomness rather than `Math.random`

#### Scenario: Reserved admin account password reset

- **GIVEN** an authenticated admin views account management
- **WHEN** the user row is the reserved `admin` account
- **THEN** the UI may suppress normal row actions and show it as a system reserved account
- **AND** the documented same-origin admin users API reset flow remains available for changing the admin password

#### Scenario: Delete user feedback

- **GIVEN** a user deletion is confirmed
- **WHEN** the deletion request is in progress
- **THEN** the affected row button and page feedback show processing state, followed by success feedback after completion

### Requirement: Course Task Management

The system SHALL let authorized users create, edit, group, paginate, filter, and delete writing tasks according to role boundaries.

#### Scenario: Teacher task visibility

- **GIVEN** a teacher opens writing task management
- **WHEN** task data is loaded
- **THEN** only tasks in the teacher's visible classes are shown

#### Scenario: Admin class binding

- **GIVEN** an admin creates or edits a writing task
- **WHEN** the admin selects a school and class
- **THEN** the UI shows the bound teacher for that class before saving

#### Scenario: Group assignment validation

- **GIVEN** a task is being saved
- **WHEN** any student remains unassigned or no group exists
- **THEN** the UI/API flow rejects the save until grouping is complete

#### Scenario: Group assignment student labels

- **GIVEN** teacher/admin is assigning students to groups in task setup
- **WHEN** student entries render in unassigned and grouped lists
- **THEN** each student is shown as `姓名(帳號)` rather than username-only
- **AND** if name is unavailable, the UI falls back to username

### Requirement: Course Control

The learning management UI SHALL expose course state controls consistent with the current course status.

#### Scenario: Not started course

- **GIVEN** a course is `not_started`
- **WHEN** the course appears in the learning management list
- **THEN** the primary state action is to start the course

#### Scenario: In-progress course

- **GIVEN** a course is `in_progress`
- **WHEN** the course appears in the learning management list
- **THEN** pause, end, and view-status actions are available

#### Scenario: End confirmation

- **GIVEN** a teacher or admin chooses to pause or end a course
- **WHEN** the destructive state change is initiated
- **THEN** the UI requires a confirmation dialog before calling the API

### Requirement: Learning Monitor Summary First

The teacher monitor SHALL load course-scoped summaries before loading full session details.

#### Scenario: View course status

- **GIVEN** a teacher clicks view status for a course
- **WHEN** monitor data is loaded
- **THEN** the dashboard and session list are scoped to that course's `activityId`

#### Scenario: Summary polling

- **GIVEN** the monitor is observing a course
- **WHEN** polling refreshes data
- **THEN** it uses summary payloads and does not fetch full messages unless a detail view is requested

#### Scenario: Cross-course contamination guard

- **GIVEN** a returned session has the same activity id but group members that do not match the current course groups
- **WHEN** monitor data is merged into the UI
- **THEN** the session is excluded from dashboard, conversation, and personal-progress views

### Requirement: Classroom Dashboard

The classroom dashboard SHALL show all sessions for the selected course and prioritize actionable risk states.

#### Scenario: Dashboard ordering

- **GIVEN** multiple sessions exist for a selected course
- **WHEN** the dashboard renders
- **THEN** sessions are ordered ready-to-advance, high-risk, watch, and normal

#### Scenario: Step5 through Step10 distribution

- **GIVEN** a session has personal step distribution from Step5 onward
- **WHEN** the dashboard renders current progress
- **THEN** it shows the minimum personal step and Step5-10 distribution counts

#### Scenario: Detailed substep progress labels in monitor views

- **GIVEN** a session is currently in Step1 or Step2 and includes substep state
- **WHEN** teacher/admin views current progress in dashboard, class joined-status, group progress, or personal progress tables
- **THEN** the progress label shows detailed step code (for example `1-1`, `1-3-2`, `2-1-3`) instead of only coarse `Step 1` or `Step 2`

#### Scenario: Step3 advance gate uses joined members first

- **GIVEN** a Step3 session has assigned participants but not all assigned users have actually joined the session
- **WHEN** the dashboard evaluates whether the group is ready to advance
- **THEN** it checks `3-complete` against joined members first
- **AND** when joined-member data is unavailable, it falls back to active members inferred from student message stats
- **AND** if still unavailable, it can use members with submitted Step3 outlines before final fallback to full participants

#### Scenario: Step3 legacy completion signal backfill

- **GIVEN** a legacy Step3 session is missing complete `3-complete` gate records
- **WHEN** submitted Step3 outline snapshots exist for gate members
- **THEN** the dashboard treats those members as completed for Step3 advance readiness

#### Scenario: Step4 advance gate uses joined members first

- **GIVEN** a Step4 session has assigned participants but not all assigned users have actually joined the session
- **WHEN** the dashboard evaluates whether the group is ready to advance
- **THEN** it checks `4-complete` against joined members first
- **AND** when joined-member data is unavailable, it falls back to active members inferred from student message stats before final fallback to full participants

#### Scenario: Session waiting exclusion in monitor

- **GIVEN** teacher/admin is viewing a course's class joined-status table
- **WHEN** they mark a student as `本次不列入等待`
- **THEN** only that session's gate membership excludes the student
- **AND** the row shows a `本次不列入等待` badge
- **AND** if the student has `需補個人結構圖`, the row shows that badge separately
- **AND** if the excluded student still has activity, the row shows `已請假但有活動`
- **AND** cancelling the waiting exclusion does not clear makeup-outline state

#### Scenario: Attendance and makeup changes refresh monitor polling

- **GIVEN** a monitor payload changes only in `attendanceOverrides` or `makeupWork`
- **WHEN** the frontend computes the monitor polling hash
- **THEN** the hash changes and polling exits quiescent backoff

#### Scenario: Scoped loading

- **GIVEN** one dashboard action is processing
- **WHEN** the UI shows loading state
- **THEN** only the relevant row, button, or detail region is locked

#### Scenario: Manual refresh also updates selected records

- **GIVEN** teacher/admin is viewing selected group log or personal record in learning management
- **WHEN** the user clicks `重新整理` for the current course
- **THEN** monitor summary data refreshes
- **AND** the currently selected group log and personal record are reloaded from latest backend data instead of keeping stale content

#### Scenario: Course diagnostics in status view

- **GIVEN** teacher/admin selects `查看狀態` for a visible course
- **WHEN** the status view loads
- **THEN** it shows a course diagnostics summary for that `activityId`
- **AND** diagnostic rows are grouped by Taipei implementation date plus group, using message/event occurrence dates instead of course or session start dates
- **AND** the same group on different implementation dates appears as separate rows
- **AND** multiple sessions for the same group on the same implementation date are aggregated into one row with a `sessionIds` list
- **AND** each grouped row includes fallback count/rate, rejection count/rate, average step dwell time, and riskiest steps
- **AND** the summary includes cross-session average dwell time by step
- **AND** the UI identifies whether fallback/rejection metrics come from persisted `learning_events` or session-message estimation
- **AND** the grouped-row table is paginated with at most 10 rows per page

#### Scenario: Course diagnostics scope

- **GIVEN** a teacher requests course diagnostics
- **WHEN** the target course or session is outside the teacher's visible class and current activity group scope
- **THEN** the API does not expose that diagnostic data

### Requirement: Conversation And Progress Records

The learning monitor SHALL provide group and personal records organized by step.

#### Scenario: Class joined-status table sorting

- **GIVEN** a teacher or admin is viewing the class joined-status table in learning management
- **WHEN** the user clicks an ascending or descending control for `姓名 (帳號)`, `所在組別`, `目前進度`, or `發言數`
- **THEN** rows are sorted immediately by the selected column and direction
- **AND** `姓名 (帳號)` uses account (`username`) as the sort key rather than display name

#### Scenario: Group conversation detail

- **GIVEN** a teacher selects a group session
- **WHEN** full detail is loaded
- **THEN** messages are grouped by step in collapsible cards and structure-tree SVGs appear in the correct step order

#### Scenario: Personal record detail

- **GIVEN** a teacher selects one student from the joined-status list
- **WHEN** personal progress loads
- **THEN** the UI shows that student's messages, Step3 submitted outline, and Step4 outline in step-scoped cards

### Requirement: Course Implementation Report

The course management area SHALL provide ended-course reports and student-level PDF export.

#### Scenario: Ended course list

- **GIVEN** a teacher or admin opens course implementation reports
- **WHEN** report courses are listed
- **THEN** only `courseStatus=ended` courses visible to that user are shown, with pagination

#### Scenario: Student report

- **GIVEN** a user selects a student in an ended course report
- **WHEN** the personal record is loaded
- **THEN** the UI shows completion rating, progress, records, and download action

#### Scenario: Empty PDF prevention

- **GIVEN** a student has no session or no personal record for the selected course
- **WHEN** PDF export is requested
- **THEN** the UI/API prevents an empty PDF and shows a readable error

#### Scenario: Class ZIP export job lifecycle

- **GIVEN** a teacher or admin starts class-level report export
- **WHEN** the backend processes student PDFs and packages ZIP
- **THEN** the UI shows asynchronous status transitions (`queued`, `running`, `retrying`, `packaging`, `succeeded`, `failed`, `canceled`) with progress counters

#### Scenario: Class ZIP export retry and success policy

- **GIVEN** at least one student's PDF generation fails transiently
- **WHEN** class-level export is running
- **THEN** the backend retries retryable failures (up to configured attempts with backoff)
- **AND** only when all students succeed does the API provide ZIP download
- **AND** if any student still fails after retries, the job ends as `failed` and ZIP is not provided

### Requirement: Admin Diagnostics

The admin console SHALL provide Prompt/LLM diagnostics, KPI trends, and non-sensitive system health signals.

#### Scenario: Diagnostics visibility

- **GIVEN** a teacher opens the teacher workspace
- **WHEN** admin-only diagnostics would otherwise be available
- **THEN** the diagnostics panel is not shown

#### Scenario: Admin diagnostics time window

- **GIVEN** an admin changes the diagnostics time window
- **WHEN** the diagnostics API is called
- **THEN** KPI, fallback, rejection, latency, trend, artifact health, and estimated token metrics are recomputed for that window

#### Scenario: Admin diagnostics uses course-first hierarchy

- **GIVEN** an admin opens diagnostics
- **WHEN** KPI analysis is rendered
- **THEN** the panel shows global health first, then course ranking, then selected-course step KPIs, then fallback investigation details
- **AND** class-dimension trend blocks are not rendered

#### Scenario: Selected course drives step KPI table

- **GIVEN** an admin selects a course from diagnostics ranking
- **WHEN** the per-step KPI section renders
- **THEN** it shows only the selected course's Step1~10 KPI rows instead of global cross-course aggregates

#### Scenario: Step drill-down filters fallback investigation

- **GIVEN** an admin selects a course and then selects a step row
- **WHEN** fallback samples/traces render
- **THEN** the list is filtered by the selected course and selected step

#### Scenario: Secret redaction

- **GIVEN** diagnostics include LLM and storage status
- **WHEN** the admin views diagnostics
- **THEN** secret values such as `LLM_KEY` and database URLs are not returned or displayed

#### Scenario: Diagnostics source and DB health visibility

- **GIVEN** an admin opens diagnostics
- **WHEN** the panel renders runtime health
- **THEN** it shows DB-env presence status, critical table health, and whether fallback metrics are event-backed or message-estimated
- **AND** warnings are shown when event tables are missing or event coverage is insufficient

#### Scenario: Recent fallback samples

- **GIVEN** an admin investigates high fallback periods
- **WHEN** diagnostics data is loaded
- **THEN** the panel shows recent fallback samples with timestamp, step/kind, `error_category`, and `sampleErrorSource`
- **AND** `sampleErrorSource` explicitly indicates `learning_event`, `matched_llm_event`, or `none`
- **AND** fallback sample `error_category` uses the fallback event's own category first and only falls back to nearby matched LLM-event hints when missing
- **AND** for Step1/2 fallback kinds (`step12_feedback`, `step12_next_question`, `step12_round`), `fallback_used=true` samples include a non-empty reason category (at least `other`)
- **AND** Step3/7/10 fallback-used samples also include a non-empty reason category (at least `other`)

#### Scenario: Recent fallback reconstructed prompt traces

- **GIVEN** an admin needs deeper root-cause investigation for fallback events
- **WHEN** diagnostics data is loaded
- **THEN** the panel shows `recentFallbackTraces` entries that include reconstructed LLM input text for recent fallback events
- **AND** each entry marks reconstruction source (`session_messages_and_prompt_config` or `event_only`)
- **AND** the UI clearly states the content is reconstructed and not guaranteed to equal provider raw request payload

#### Scenario: Diagnostics panel shows original prompt/response and rejection reasons

- **GIVEN** recent fallback traces have matched session debug traces
- **WHEN** the diagnostics panel renders fallback trace details
- **THEN** each trace can show original question, original prompt text, original response text, and rejection reason list
- **AND** when no debug trace exists, the panel still shows reconstructed content and marks source as `none`

#### Scenario: Stable trend labels

- **GIVEN** diagnostics renders course/class trend tables
- **WHEN** event-backed trend rows are aggregated
- **THEN** school/class/course labels prefer session-snapshot metadata (by `session_id`) before activity lookup
- **AND** labels fall back to activity-id metadata when session snapshot metadata is unavailable

#### Scenario: Run store migration from diagnostics

- **GIVEN** an admin detects missing critical tables in diagnostics
- **WHEN** the admin triggers store migration from the UI
- **THEN** the system calls the admin migration API and updates diagnostics after completion

### Requirement: Audit Log

The admin console SHALL provide a recent operation log grouped for review.

#### Scenario: Audit log display

- **GIVEN** an admin opens the audit log tab
- **WHEN** recent logs are loaded
- **THEN** the UI shows timestamp, actor, action, target, and details grouped by day

#### Scenario: Audited operations

- **GIVEN** a user creates a course, deletes an activity, resets a password, or switches a step
- **WHEN** the operation succeeds
- **THEN** an audit log entry is written with the corresponding action and target context
