import assert from "node:assert/strict";
import test from "node:test";
import { formatTaipeiDate, formatTaipeiDateTime, formatTaipeiTime } from "@/src/lib/time-format";

test("time-format: converts UTC ISO to Taipei date/time", () => {
  const iso = "2026-01-01T00:00:00.000Z";
  assert.equal(formatTaipeiDate(iso), "2026/01/01");
  assert.equal(formatTaipeiTime(iso, { withSeconds: false }), "08:00");
  assert.equal(formatTaipeiDateTime(iso), "2026/01/01 08:00:00");
});

test("time-format: returns dash on invalid input", () => {
  assert.equal(formatTaipeiDate("not-a-date"), "—");
  assert.equal(formatTaipeiTime("not-a-date"), "—");
  assert.equal(formatTaipeiDateTime("not-a-date"), "—");
});
