import test from "node:test";
import assert from "node:assert/strict";
import {
  findActivity,
  getOpenClasses,
  updateActivityGroups,
  upsertEssay,
  upsertOpenClass
} from "../src/lib/activity-store";

type TaskInput = Parameters<typeof upsertOpenClass>[0];
let fixtureNumber = 0;

// Only use synthetic in-memory state: never hydrate or flush persisted data.
function createFixture(overrides: Partial<TaskInput> = {}) {
  fixtureNumber += 1;
  const essay = upsertEssay({
    id: `assignment-test-essay-${fixtureNumber}`,
    title: "一次網路上無心的言行",
    genre: "記敘文",
    description: "Regression test fixture",
    enabled: true
  });
  const input: TaskInput = {
    school: `Assignment test school ${fixtureNumber}`,
    classNumber: "805",
    academicYear: "114",
    academicYearTerm: "2",
    essayId: essay.id,
    durationMinutes: 40,
    supplemental: "Original instructions",
    ownerTeacherUsername: "test-teacher-a",
    ...overrides
  };
  const result = upsertOpenClass(input);
  assert.equal(result.ok, true);
  updateActivityGroups(result.saved.id, [
    { groupId: "g1", groupName: "1", members: ["test-student"] }
  ], ["test-student"]);
  const originalActivity = structuredClone(findActivity(result.saved.id));
  const originalTask = structuredClone(result.saved);
  return { input, originalTask, originalActivity };
}

for (const scenario of [
  { name: "114-2 to 115-1 with a different teacher", year: "115", term: "1", teacher: "test-teacher-b" },
  { name: "114-2 to 115-1 with the same teacher", year: "115", term: "1", teacher: "test-teacher-a" },
  { name: "only the academic year changes", year: "115", term: "2", teacher: "test-teacher-a" },
  { name: "only the semester changes", year: "114", term: "1", teacher: "test-teacher-a" }
]) {
  test(`same class and essay can be assigned when ${scenario.name}`, () => {
    const { input, originalTask, originalActivity } = createFixture();
    const result = upsertOpenClass({
      ...input,
      academicYear: scenario.year,
      academicYearTerm: scenario.term,
      ownerTeacherUsername: scenario.teacher
    });
    assert.equal(result.ok, true);
    assert.notEqual(result.saved.id, originalTask.id);
    assert.equal(result.saved.academicYear, scenario.year);
    assert.equal(result.saved.academicYearTerm, scenario.term);
    assert.equal(result.saved.ownerTeacherUsername, scenario.teacher);
    assert.deepEqual(findActivity(result.saved.id)?.groups, []);
    assert.deepEqual(getOpenClasses().find((item) => item.id === originalTask.id), originalTask);
    assert.deepEqual(findActivity(originalTask.id), originalActivity);
  });
}

for (const teacher of ["test-teacher-a", "test-teacher-b"]) {
  test(`same-term duplicate is rejected for ${teacher} without changing existing data`, () => {
    const { input, originalTask, originalActivity } = createFixture();
    const before = structuredClone(getOpenClasses());
    assert.deepEqual(upsertOpenClass({ ...input, ownerTeacherUsername: teacher }), {
      ok: false,
      error: "duplicate_class_essay_assignment"
    });
    assert.deepEqual(getOpenClasses(), before);
    assert.deepEqual(findActivity(originalTask.id), originalActivity);
  });
}

test("editing a task excludes itself but rejects a collision in another term", () => {
  const { input, originalTask, originalActivity } = createFixture();
  const secondInput = { ...input, academicYear: "115", academicYearTerm: "1" };
  const second = upsertOpenClass(secondInput);
  assert.equal(second.ok, true);

  const edit = upsertOpenClass({ ...secondInput, id: second.saved.id, supplemental: "Updated instructions" });
  assert.equal(edit.ok, true);
  assert.equal(edit.saved.id, second.saved.id);
  assert.equal(edit.saved.supplemental, "Updated instructions");

  const before = structuredClone(getOpenClasses());
  assert.deepEqual(upsertOpenClass({ ...input, id: second.saved.id }), {
    ok: false,
    error: "duplicate_class_essay_assignment"
  });
  assert.deepEqual(getOpenClasses(), before);
  assert.deepEqual(findActivity(originalTask.id), originalActivity);
});

test("duplicate checks use normalized and default academic terms", () => {
  const { input } = createFixture({ academicYear: "115", academicYearTerm: "1" });
  for (const term of [
    { academicYear: " 115 ", academicYearTerm: " 1 " },
    { academicYear: undefined, academicYearTerm: undefined }
  ]) {
    assert.deepEqual(upsertOpenClass({ ...input, ...term }), {
      ok: false,
      error: "duplicate_class_essay_assignment"
    });
  }
});
