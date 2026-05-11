import test from "node:test";
import assert from "node:assert/strict";

import {
  getActivityGroupScopedSessions,
  getActivityScopedSessions,
  isSessionInActivityGroupScope,
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

test("#306: dashboard scope rejects sessions whose group no longer belongs to the selected activity", () => {
  const activity = {
    id: "activity-a",
    groups: [
      { groupId: "g1", groupName: "1", members: ["s1", "s2"] },
      { groupId: "g2", groupName: "2", members: ["s3", "s4"] }
    ]
  };
  const sessions = [
    { sessionId: "current-g1", activityId: "activity-a", groupId: "g1", groupName: "1", participants: ["s1", "s2"] },
    { sessionId: "stale-g1", activityId: "activity-a", groupId: "g1", groupName: "1", participants: ["old1", "old2"] },
    { sessionId: "other-activity", activityId: "activity-b", groupId: "g1", groupName: "1", participants: ["s1", "s2"] }
  ];

  const scoped = getActivityGroupScopedSessions(sessions, activity);

  assert.deepEqual(scoped.map((session) => session.sessionId), ["current-g1"]);
});

test("#306: group scope requires current activity membership when participants are available", () => {
  const activity = {
    id: "activity-a",
    groups: [{ groupId: "g1", groupName: "1", members: ["s1", "s2"] }]
  };

  assert.equal(
    isSessionInActivityGroupScope({ activityId: "activity-a", groupId: "g1", participants: ["s2", "s1"] }, activity),
    true
  );
  assert.equal(
    isSessionInActivityGroupScope({ activityId: "activity-a", groupId: "g1", participants: ["s1", "s3"] }, activity),
    false
  );
});
