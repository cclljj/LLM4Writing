import test from "node:test";
import assert from "node:assert/strict";
import { ChatMessage, SessionState } from "../src/lib/types";
import { validateStudentAnswer } from "../src/lib/answer-validation";
import { isUsableNextQuestion, splitAiFeedbackAndQuestion } from "../src/lib/llm-response";
import { buildStep1Question, buildStep2Question } from "../src/lib/workflow-questions";
import { advanceStep1Or2SubstepAfterAi, handleStep1Or2Group } from "../src/lib/workflow-step1-2";

function makeMessage(input: Omit<ChatMessage, "id" | "at">): ChatMessage {
  return { id: `m-${Math.random()}`, at: "2026-05-06T00:00:00.000Z", ...input };
}

function baseSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    id: "session-1",
    createdAt: "2026-05-06T00:00:00.000Z",
    currentStep: 1,
    personalSteps: { s1: 1, s2: 1 },
    participants: ["s1", "s2"],
    messages: [],
    groupGate: {},
    reflectionIndex: { s1: 0, s2: 0 },
    workflow: "spec10",
    phaseMax: 10,
    promptConfig: {
      stepPrompts: {},
      subStepPrompts: {},
      subStepPromptsFallbacks: {},
      questionBanks: {},
      step9Questions: {},
      stepOpenings: {}
    },
    stepState: { step1Substep: 1, step2Substep: 1, step1Substep3Question: 1, step1Substep4Question: 1, step2Substep1Question: 1 },
    outlines: {},
    step3SubmittedOutlines: {},
    draftStep6: {},
    draftStep8: {},
    reports: { step7: {}, step10: {} },
    ...overrides
  };
}

test("answer validation rejects low-quality answers before they become history", () => {
  const session = baseSession({
    messages: [makeMessage({ role: "system", step: 1, text: "請提出三個關鍵字。" })]
  });

  assert.match(validateStudentAnswer(session, "s1", 1, "不知道") ?? "", /敷衍/);
  assert.match(validateStudentAnswer(session, "s1", 1, "請提出三個關鍵字。") ?? "", /題目本身/);
  assert.match(validateStudentAnswer(session, "s1", 1, "勇氣，責任") ?? "", /至少 3 項/);
  assert.equal(validateStudentAnswer(session, "s1", 1, "勇氣，責任，合作"), null);
});

test("LLM parser prefers structured JSON and still supports legacy marker parsing", () => {
  const structured = splitAiFeedbackAndQuestion('{"feedback":"大家都有提出想法。","nextQuestion":"請選一個最重要的理由說明。"}');
  assert.equal(structured.feedbackText, "大家都有提出想法。");
  assert.equal(structured.nextQuestion, "請選一個最重要的理由說明。");

  const fenced = splitAiFeedbackAndQuestion('```json\n{"feedback":"收到。","next_question":"下一題是什麼？"}\n```');
  assert.equal(fenced.feedbackText, "收到。");
  assert.equal(fenced.nextQuestion, "下一題是什麼？");

  const legacy = splitAiFeedbackAndQuestion("這輪整理得不錯。\n\n請回答以下問題：請補上一個例子。");
  assert.equal(legacy.feedbackText, "這輪整理得不錯。");
  assert.equal(legacy.nextQuestion, "請補上一個例子。");
  assert.equal(isUsableNextQuestion("請依上一則 AI 提問作答（本題要延伸討論）。"), false);
});

test("question-bank steps are sourced from questionBanks and instruction-like prompts use fallbacks", () => {
  const session = baseSession({
    promptConfig: {
      stepPrompts: {},
      subStepPrompts: {
        "2-1-1": "【提問規則】\n第一段\n第二段\n第三段\n第四段"
      },
      subStepPromptsFallbacks: {
        "2-1-1": "請挑一個最能支持主張的例子。"
      },
      questionBanks: {
        "1-2": ["這是題庫中的 1-2 問題。"]
      },
      step9Questions: {},
      stepOpenings: {}
    },
    stepState: { step1Substep: 2, step2Substep: 1, step1Substep3Question: 1, step1Substep4Question: 1, step2Substep1Question: 1 }
  });

  assert.equal(buildStep1Question(session), "這是題庫中的 1-2 問題。");
  assert.equal(buildStep2Question(session), "請挑一個最能支持主張的例子。");
});

test("Step1/2 group gate waits for all participants before advancing", () => {
  const session = baseSession();

  const first = handleStep1Or2Group(session, "s1", "我先回答完整想法", makeMessage);
  assert.equal(first.allResponded, false);
  assert.deepEqual(session.groupGate["1-1"], ["s1"]);

  const second = handleStep1Or2Group(session, "s2", "我也回答完整想法", makeMessage);
  assert.equal(second.allResponded, true);
  assert.deepEqual(new Set(session.groupGate["1-1"]), new Set(["s1", "s2"]));
});

test("Step1/2 advancement preserves questionBanks and uses fallback when LLM nextQuestion is missing", () => {
  const session = baseSession({
    promptConfig: {
      stepPrompts: {},
      subStepPrompts: {},
      subStepPromptsFallbacks: { "2-1-2": "fallback：請挑一個具體例子。" },
      questionBanks: { "1-2": ["題庫：請補充小組立場。"] },
      step9Questions: {},
      stepOpenings: {}
    }
  });

  advanceStep1Or2SubstepAfterAi(session, 1, 1, "AI 不應覆蓋 1-2 題庫", makeMessage);
  assert.equal(session.stepState.step1Substep, 2);
  assert.match(session.messages.at(-1)?.text ?? "", /題庫：請補充小組立場/);

  const step2Session = baseSession({
    currentStep: 2,
    promptConfig: {
      stepPrompts: {},
      subStepPrompts: {},
      subStepPromptsFallbacks: { "2-1-2": "fallback：請挑一個具體例子。" },
      questionBanks: {},
      step9Questions: {},
      stepOpenings: {}
    },
    stepState: { step1Substep: 1, step2Substep: 1, step1Substep3Question: 1, step1Substep4Question: 1, step2Substep1Question: 1 }
  });
  advanceStep1Or2SubstepAfterAi(step2Session, 2, 1, undefined, makeMessage);
  assert.equal(step2Session.stepState.step2Substep1Question, 2);
  assert.match(step2Session.messages.at(-1)?.text ?? "", /fallback：請挑一個具體例子/);
});
