import test from "node:test";
import assert from "node:assert/strict";
import { getStep12FeedbackRiskReasons } from "../src/lib/step12-feedback-quality";

test("step12 feedback quality: question-form feedback is allowed", () => {
  const text = "你們已經抓到關鍵方向了，接下來可以再補一個更具體的例子嗎？";
  const reasons = getStep12FeedbackRiskReasons(text, 1, "1-3-2");
  assert.ok(!reasons.includes("feedback_contains_question"));
  assert.equal(reasons.length, 0);
});

test("step12 feedback quality: existing template rejection still works", () => {
  const text = "已收到大家的回覆，整理得很好，請繼續下一題。";
  const reasons = getStep12FeedbackRiskReasons(text, 1, "1-3-2");
  assert.ok(reasons.includes("generic_feedback_template"));
});
