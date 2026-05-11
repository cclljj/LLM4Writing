import test from "node:test";
import assert from "node:assert/strict";

import {
  getActivityScopedSessions,
  isSessionInActivityScope,
  normalizeActivityScope
} from "../src/lib/monitor-session-scope.js";

test("#218: monitor session scope keeps only the selected activity", () => {
  const sessions = [
    { sessionId: "s1", activityId: "activity-a" },
    { sessionId: "s2", activityId: "activity-b" },
    { sessionId: "s3", activityId: "activity-a" },
    { sessionId: "s4" }
  ];

  const scoped = getActivityScopedSessions(sessions, "activity-a");

  assert.deepEqual(scoped.map((session) => session.sessionId), ["s1", "s3"]);
});

test("#218: monitor session scope returns empty without a selected activity", () => {
  const sessions = [{ sessionId: "s1", activityId: "activity-a" }];

  assert.deepEqual(getActivityScopedSessions(sessions, ""), []);
  assert.deepEqual(getActivityScopedSessions(sessions, undefined), []);
});

test("#218: monitor session detail scope rejects cross-activity sessions", () => {
  assert.equal(normalizeActivityScope(" activity-a "), "activity-a");
  assert.equal(isSessionInActivityScope({ activityId: "activity-a" }, "activity-a"), true);
  assert.equal(isSessionInActivityScope({ activityId: "activity-b" }, "activity-a"), false);
  assert.equal(isSessionInActivityScope({ activityId: "activity-a" }, ""), false);
});
