import test from "node:test";
import assert from "node:assert/strict";
import { resolveDraftHydration, shouldAcceptIncomingSession } from "../src/lib/student-page-helpers";

// Safety net for #459: these rules protect in-flight student edits from
// polling overwrites. They pin the behavior of app/student/page.tsx before
// and after the hooks extraction.

test("polling guard rejects stale sessions that would roll back personal step", () => {
  // Out-of-order response: older step and no newer messages -> reject.
  assert.equal(
    shouldAcceptIncomingSession({ prevOwnStep: 8, nextOwnStep: 6, prevMessageCount: 12, nextMessageCount: 12 }),
    false
  );
  assert.equal(
    shouldAcceptIncomingSession({ prevOwnStep: 8, nextOwnStep: 6, prevMessageCount: 12, nextMessageCount: 10 }),
    false
  );
  // Older step but more messages -> genuine teacher rollback, accept.
  assert.equal(
    shouldAcceptIncomingSession({ prevOwnStep: 8, nextOwnStep: 6, prevMessageCount: 12, nextMessageCount: 13 }),
    true
  );
  // Same or newer step always accepted.
  assert.equal(
    shouldAcceptIncomingSession({ prevOwnStep: 6, nextOwnStep: 6, prevMessageCount: 12, nextMessageCount: 12 }),
    true
  );
  assert.equal(
    shouldAcceptIncomingSession({ prevOwnStep: 6, nextOwnStep: 8, prevMessageCount: 12, nextMessageCount: 0 }),
    true
  );
});

test("step6 hydrates on entry and when local draft is empty, not while editing", () => {
  // Just entered step6 -> hydrate even over local text.
  const entering = resolveDraftHydration({
    ownStep: 6, lastOwnStep: 5, draftText: "local edit", savedDraft8Text: "",
    latestDraft6: "server draft", latestDraft8: undefined
  });
  assert.equal(entering.hydrateStep6, true);
  assert.equal(entering.step6Draft, "server draft");

  // Already in step6 with local text -> never overwrite.
  const editing = resolveDraftHydration({
    ownStep: 6, lastOwnStep: 6, draftText: "typing...", savedDraft8Text: "",
    latestDraft6: "server draft", latestDraft8: undefined
  });
  assert.equal(editing.hydrateStep6, false);

  // Already in step6 but local draft empty -> rehydrate from server.
  const emptied = resolveDraftHydration({
    ownStep: 6, lastOwnStep: 6, draftText: "", savedDraft8Text: "",
    latestDraft6: "server draft", latestDraft8: undefined
  });
  assert.equal(emptied.hydrateStep6, true);
});

test("step8 never overwrites unsaved local edits during polling", () => {
  // The critical race: student typing in step8 while a poll lands.
  const editing = resolveDraftHydration({
    ownStep: 8, lastOwnStep: 8, draftText: "unsaved local edit", savedDraft8Text: "old saved",
    latestDraft6: "draft6", latestDraft8: "server draft8"
  });
  assert.equal(editing.hydrateStep8, false);

  // Saved state matches local -> server change may hydrate.
  const synced = resolveDraftHydration({
    ownStep: 8, lastOwnStep: 8, draftText: "same", savedDraft8Text: "same",
    latestDraft6: "draft6", latestDraft8: "newer server draft8"
  });
  assert.equal(synced.hydrateStep8, true);
  assert.equal(synced.step8Draft, "newer server draft8");

  // Local matches server and nothing unsaved -> no-op hydration is allowed
  // (same content), entering step8 always hydrates.
  const entering = resolveDraftHydration({
    ownStep: 8, lastOwnStep: 6, draftText: "whatever", savedDraft8Text: "whatever",
    latestDraft6: "draft6", latestDraft8: undefined
  });
  assert.equal(entering.hydrateStep8, true);
  // step8 falls back to the step6 draft only when draft8 is absent (nullish),
  // not when it is an empty string.
  assert.equal(entering.step8Draft, "draft6");
  const emptyDraft8 = resolveDraftHydration({
    ownStep: 8, lastOwnStep: 6, draftText: "", savedDraft8Text: "",
    latestDraft6: "draft6", latestDraft8: ""
  });
  assert.equal(emptyDraft8.step8Draft, "");
});
