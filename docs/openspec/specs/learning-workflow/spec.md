# Learning Workflow Specification

## Scope

This domain describes the student learning workflow, group gates, personal pacing, artifact rules, streaming behavior, and student-facing UX requirements.

## Requirements

### Requirement: Ten-Step Workflow

The system SHALL implement the `spec10` writing workflow as ten ordered steps with the documented interaction modes.

#### Scenario: Step sequence

- **GIVEN** a student has joined a `spec10` session
- **WHEN** the student progresses through the course
- **THEN** the workflow follows Step1 review topic, Step2 collect material, Step3 generate argument, Step4 compare and revise, Step5 summary, Step6 draft, Step7 feedback, Step8 polish, Step9 reflection, and Step10 final report

#### Scenario: Non-interactive steps

- **GIVEN** a student reaches Step5, Step7, or Step10
- **WHEN** the step content is generated
- **THEN** the step is presented as non-interactive report content rather than a normal chat question

### Requirement: Step1 And Step2 Group Gate

The system SHALL require all Step1/2 gate members to answer the current gate before AI feedback and the next question are produced.
Gate members are resolved from joined members first and fall back to assigned participants when joined-member data is unavailable.

#### Scenario: First student answers

- **GIVEN** a Step1/2 gate is active for a group
- **WHEN** one participant submits an answer before all gate members have answered
- **THEN** the answer is recorded and that participant enters a waiting state

#### Scenario: Last student answers

- **GIVEN** every other gate member has already answered the current Step1/2 gate
- **WHEN** the last participant submits a valid answer
- **THEN** the system generates feedback first, then generates or selects the next question, and advances the gate in the same round

#### Scenario: Configurable feedback prompt

- **GIVEN** `step12FeedbackPrompts` is configured
- **WHEN** Step1/2 feedback is generated
- **THEN** the system uses the step-specific prompt when present, otherwise the default feedback prompt
- **AND** it may add `step12FeedbackFocusPrompts[currentSubstepKey]` to guide substep-specific feedback without changing next-question source

#### Scenario: Step2 late-substep feedback depth

- **GIVEN** the current Step2 substep is `2-2`, `2-3`, or `2-4`
- **WHEN** feedback is generated
- **THEN** the feedback is checked for sufficient length and useful teaching signals such as summary, suggestion, strengthening direction, cause, example, claim, material, detail, or persuasiveness
- **AND** insufficient feedback is retried or replaced by fallback

#### Scenario: Joined-member gate priority

- **GIVEN** assigned participants include users who have not joined the session yet
- **WHEN** Step1/2 gate completion is evaluated
- **THEN** the system checks completion against joined members first and does not block waiting for absent non-joined users

#### Scenario: Group privacy before gate completion

- **GIVEN** a student has not completed the current Step1/2 gate
- **WHEN** the student views the interaction area
- **THEN** the student cannot see other group members' current-gate student messages

### Requirement: Step1 And Step2 Question Selection

The system SHALL choose Step1/2 next questions from the configured prompt or question bank hierarchy and SHALL never show internal prompt text as the student question.

#### Scenario: Prompt-backed next question

- **GIVEN** `subStepPrompts[nextSubstepKey]` exists
- **WHEN** the system advances to that substep
- **THEN** it asks the LLM for a `nextQuestion` and displays only a valid student-readable question

#### Scenario: Question bank fallback

- **GIVEN** no substep prompt exists and `questionBanks[nextSubstepKey]` contains questions
- **WHEN** the system advances to that substep
- **THEN** it selects a question from the question bank without calling the LLM for question generation

#### Scenario: Step2 2-4 remains question-bank driven

- **GIVEN** Step2 advances to `2-4`
- **WHEN** `subStepPrompts["2-4"]` is absent and `questionBanks["2-4"]` contains questions
- **THEN** the next question is randomly selected from the question bank
- **AND** the system does not generate the `2-4` question from the previous conversation

#### Scenario: Safe fallback question

- **GIVEN** neither a substep prompt nor question bank entry can provide a usable question
- **WHEN** the system advances
- **THEN** it uses a short, safe, student-readable fallback question

### Requirement: Answer Quality Gate

The system SHALL reject clearly low-quality student answers while allowing sincere imperfect answers.

#### Scenario: Invalid short or nonsense answer

- **GIVEN** a student submits an answer that is too short, random, evasive, or completely unrelated
- **WHEN** the answer quality check runs
- **THEN** the API returns an error and hint, the workflow does not advance, and the rejected text is not saved into learning history

#### Scenario: Rejected answer UX

- **GIVEN** the API rejects a student answer
- **WHEN** the frontend receives the error and hint
- **THEN** the input keeps the student's original text and shows a readable suggestion that may recommend asking the teacher for help

### Requirement: Step3 Structure Tree

The system SHALL provide an editable personal structure tree in Step3 based on the activity genre template.

#### Scenario: Template initialization

- **GIVEN** a Step3 student has no saved outline
- **WHEN** the Step3 view loads
- **THEN** the editor initializes from the genre-specific structure tree template and replaces the topic placeholder with the activity title

#### Scenario: Editing permissions

- **GIVEN** the structure tree is visible
- **WHEN** the student edits nodes
- **THEN** first-level and second-level nodes keep the configured restrictions, while third-level and deeper nodes may be edited according to the documented rules

#### Scenario: Step3 completion validation

- **GIVEN** the student attempts to complete Step3
- **WHEN** third-level or deeper default nodes are still unchanged from the template
- **THEN** the server rejects completion and the UI asks the student to finish editing those nodes

### Requirement: Step4 Compare And Revise

The system SHALL let students compare group outlines, revise their own outline, discuss, and then lock their Step4 completion.

#### Scenario: Confirm completion

- **GIVEN** a student is in Step4
- **WHEN** the student confirms completion
- **THEN** the system saves the current outline, records the student's completion in `groupGate["4-complete"]`, and locks that student's Step4 editing and discussion

#### Scenario: Teacher readiness

- **GIVEN** all participants are listed in `groupGate["4-complete"]`
- **WHEN** the teacher monitor evaluates the group
- **THEN** the group is eligible to move to Step5

### Requirement: Personal Pacing From Step5

The system SHALL use personal pacing from Step5 onward.

#### Scenario: Individual advancement

- **GIVEN** a group has reached Step5
- **WHEN** one student completes Step5, Step6, Step8, or Step9
- **THEN** that student's `personalSteps[username]` advances without requiring every group member to advance at the same time

#### Scenario: Step9 completion reconciliation runs with bounded concurrency

- **GIVEN** multiple students in the same session have completed all Step9 reflection questions and still need Step10 report generation
- **WHEN** the backend reconciles completed Step9 users
- **THEN** it advances eligible students to Step10 and generates missing Step10 reports with bounded concurrency instead of strictly serial per-student processing

#### Scenario: Personal context isolation

- **GIVEN** a Step5+ LLM call is generated for one student
- **WHEN** the system builds LLM context
- **THEN** it includes shared Step1-4 context as allowed and that student's Step5+ history, but not other students' personal Step5+ messages

### Requirement: Draft And Reflection Validation

The system SHALL validate Step6 drafts, Step8 final drafts, and Step9 reflections before accepting them.

#### Scenario: Step6 draft too weak

- **GIVEN** a Step6 draft fails minimum length, CJK count, repetition, low-quality phrase, copied-topic, or relevance checks
- **WHEN** the student submits it for completion
- **THEN** the API returns `draft_insufficient` with a hint and does not advance the personal step

#### Scenario: Step9 partial invalid reflection

- **GIVEN** a student submits four Step9 reflection answers
- **WHEN** any one answer fails quality validation
- **THEN** the whole reflection submission is rejected with a hint for the specific question that needs improvement

### Requirement: Streaming LLM Responses

The system SHALL stream Step3, Step6 suggestion, Step7 preview, and Step10 report responses using SSE while preserving complete persisted results.

#### Scenario: Successful stream

- **GIVEN** a streaming endpoint is called for an eligible step
- **WHEN** chunks are produced
- **THEN** the server emits `chunk` events and finally emits `done` with the updated session state

#### Scenario: Stream fallback

- **GIVEN** the LLM or stream fails
- **WHEN** the endpoint handles the failure
- **THEN** the student receives a readable fallback or error event and the frontend does not stay in infinite loading

#### Scenario: Step3 completeness guard

- **GIVEN** a Step3 response still looks incomplete after truncation-continuation stitching
- **WHEN** the server detects quality risk such as truncation residue, duplicated stitched lines, or incomplete ending
- **THEN** the server regenerates once with a stronger completeness instruction before streaming the final output to the student

#### Scenario: Step10 chunked final report generation

- **GIVEN** a student reaches Step10 final report generation
- **WHEN** the backend generates report content
- **THEN** it generates Step10 in multiple sections (outline + per-section content) and composes the final report
- **AND** uses a final polish pass only when section stitching still has quality risk, reducing truncation fallback from single long completions

### Requirement: Student UI Continuity

The student UI SHALL keep course progress, previous-step review, next-action guidance, save status, and polling behavior coherent with the student's current workflow state.

#### Scenario: Active session polling

- **GIVEN** a student is inside a session
- **WHEN** the frontend polls session state
- **THEN** it uses the session endpoint with conditional GET behavior and avoids overwriting local structure-tree or draft edits that are in progress

#### Scenario: Step5+ progress display

- **GIVEN** a student is in Step5 or later
- **WHEN** the progress rail and course cards render
- **THEN** they use the student's personal step when available instead of only the group session step

#### Scenario: History view hides not-yet-reached step artifacts

- **GIVEN** a student has not reached Step4 yet
- **WHEN** course history is rendered
- **THEN** Step4 outline artifacts are not shown from default template data

#### Scenario: Question-bank line-break markers are rendered as line breaks

- **GIVEN** a student-visible message contains `<br>` or `<br/>` markers from question-bank content
- **WHEN** the message is rendered in student views
- **THEN** those markers are interpreted as line breaks and are not shown as literal text
