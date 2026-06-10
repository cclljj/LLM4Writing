import test from "node:test";
import assert from "node:assert/strict";
import { ChatMessage, SessionState } from "../src/lib/types";
import { validateStep4DiscussionMessage, validateStudentAnswer, validateDraftContent, validateStudentAnswerSimple } from "../src/lib/answer-validation";
import { buildAdvancedStuckRisk, recordRejectedAnswerSignal } from "../src/lib/learning-diagnostics";
import { isTruncatedFinishReason, pickAssistantTextResult } from "../src/lib/llm-openai-response";
import { resolvePendingOutlineAfterServerSync, shouldSyncOutlineFromSession } from "../src/lib/outline-sync-guard";
import {
  hasStep6SuggestionQualityRisk,
  isUsableNextQuestion,
  normalizeStep5Summary,
  normalizeStep6SuggestionText,
  sanitizeStudentFacingText,
  splitAiFeedbackAndQuestion
} from "../src/lib/llm-response";
import { getStructureTreeNodePermissions } from "../src/lib/structure-tree-permissions";
import { validateStep3OutlineCompletion } from "../src/lib/step3-outline-validation";
import { buildStudentNextAction } from "../src/lib/student-next-action";
import { computeNextOpenClassId } from "../src/lib/activity-store";
import { buildStep1Question, buildStep2Question } from "../src/lib/workflow-questions";
import { advanceStep1Or2SubstepAfterAi, getNextSubstepKeyAfterCompletion, handleStep1Or2Group, recoverStalledStep1Or2AiWait } from "../src/lib/workflow-step1-2";
import { isStep12FeedbackQualityRisk } from "../src/lib/step12-feedback-quality";
import { isMakeupOutlinePending, resolveStep12GateMembers, setWaitingExclusion } from "../src/lib/session-attendance";
import {
  composeStep10Report,
  normalizeStep10SectionBody,
  parseStep10SectionTitles,
  resolveStep10ReportConfig,
  stripLeadingStep10SectionHeading
} from "../src/lib/step10-report-format";
import {
  computeTeacherMonitorPayloadHash,
  hasLowLatencyStepAdvanceGate,
  resolveTeacherMonitorNextPollDelay,
  TEACHER_MONITOR_FAST_POLL_MS,
  TEACHER_MONITOR_MIN_POLL_MS
} from "../src/lib/teacher-monitor-polling";
import { renderMessageHtml } from "../app/student/_components/renderMessageHtml";

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
    qualitySignals: { rejectedAnswerCounts: {}, rejectedAnswerLastAt: {} },
    artifactSignals: { outlineUpdatedAt: {}, draftStep6UpdatedAt: {}, draftStep8UpdatedAt: {} },
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
    reports: { step5: {}, step7: {}, step10: {} },
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
  assert.equal(validateStudentAnswer(session, "s1", 1, "我想到這個題目可以先用勇氣、責任、合作三個關鍵字來討論。"), null);
});

test("step1/2 simple validation accepts earnest 3C-related answer and still blocks unrelated text", () => {
  const session = baseSession({
    currentStep: 1,
    stepState: { step1Substep: 3, step2Substep: 1, step1Substep3Question: 1, step1Substep4Question: 1, step2Substep1Question: 1 },
    messages: [
      makeMessage({ role: "system", step: 1, text: "請描述你和 3C 的距離，並舉一個生活中的例子。" })
    ]
  });

  const earnestAnswer = "我們平常生活中使用3C的頻繁程度，例如手機、電腦、電視、switch等等，可以代表我們和3C的距離，越長使用，距離就越近。";
  assert.equal(validateStudentAnswerSimple(session, "s1", 1, earnestAnswer), null);
  assert.equal(
    validateStudentAnswerSimple(session, "s1", 1, "如果使用手機上網就算數，如果只是接電話就不算數。"),
    null
  );
  assert.equal(validateStudentAnswerSimple(session, "s1", 1, "國中生少用3C多唸書"), null);

  assert.match(
    validateStudentAnswerSimple(session, "s1", 1, "今天中午我吃了炒飯和蛋花湯，味道不錯，吃完準備去打球流汗。") ?? "",
    /關聯性不足/
  );
});

test("step1 substeps 1-1/1-2 accept concise requirement-fitting answers", () => {
  const step11 = baseSession({
    currentStep: 1,
    stepState: { step1Substep: 1, step2Substep: 1, step1Substep3Question: 1, step1Substep4Question: 1, step2Substep1Question: 1 },
    messages: [makeMessage({ role: "system", step: 1, text: "請問這篇文章是什麼文體？" })]
  });
  assert.equal(validateStudentAnswerSimple(step11, "s1", 1, "記敘文"), null);
  assert.match(validateStudentAnswerSimple(step11, "s1", 1, "我覺得可以") ?? "", /回答文章文體/);

  const step12 = baseSession({
    currentStep: 1,
    stepState: { step1Substep: 2, step2Substep: 1, step1Substep3Question: 1, step1Substep4Question: 1, step2Substep1Question: 1 },
    messages: [makeMessage({ role: "system", step: 1, text: "請找出三個關鍵字。" })]
  });
  assert.equal(validateStudentAnswerSimple(step12, "s1", 1, "勇氣、責任、尊重"), null);
  assert.match(validateStudentAnswerSimple(step12, "s1", 1, "勇氣、責任") ?? "", /至少 3 個關鍵字/);
});

test("step4 discussion moderation blocks profanity/off-topic but keeps short or classroom-linked creativity", () => {
  assert.match(validateStep4DiscussionMessage("你這白痴在講什麼") ?? "", /不適合課堂/);
  assert.match(validateStep4DiscussionMessage("你這白痴在講什麼") ?? "", /課堂討論區/);
  assert.match(validateStep4DiscussionMessage("這邊可以講髒話嗎") ?? "", /不適合課堂/);
  assert.match(validateStep4DiscussionMessage("這邊可以講髒話嗎") ?? "", /課堂討論區/);
  assert.match(validateStep4DiscussionMessage("晚上一起玩 robolx") ?? "", /關聯比較低/);
  assert.match(validateStep4DiscussionMessage("晚上一起玩 robolx") ?? "", /不要離題/);
  assert.match(validateStep4DiscussionMessage("昨天兄弟輸了") ?? "", /關聯比較低/);
  assert.match(validateStep4DiscussionMessage("昨天兄弟輸了") ?? "", /不要離題/);
  assert.match(
    validateStep4DiscussionMessage("我昨天一直在看明星八卦和電競實況，超好笑跟這堂課無關但我想聊") ?? "",
    /關聯比較低/
  );
  assert.equal(validateStep4DiscussionMessage("我同意你這點"), null);
  assert.equal(
    validateStep4DiscussionMessage("我們可以用遊戲闖關當比喻，去補強這段文章的論點和例子。"),
    null
  );
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

test("Step1/2 feedback quality guard rejects premature future stage announcements", () => {
  assert.equal(
    isStep12FeedbackQualityRisk(
      "### **建議回饋**\n你已整理出核心主張。\n\n### **重點摘要**\n你能對比快樂與空虛。\n\n### **下一步補強**\n接下來我們要進入第二階段「蒐集資料」，找更多例子。",
      1,
      "1-4-1"
    ),
    true
  );
  assert.equal(
    isStep12FeedbackQualityRisk(
      "### **建議回饋**\n你已整理出核心主張。\n\n### **重點摘要**\n你能對比快樂與空虛。\n\n### **下一步補強**\n下一輪請在步驟一內，把這句主張再收斂得更清楚。",
      1,
      "1-4-1"
    ),
    false
  );
  assert.equal(
    isStep12FeedbackQualityRisk(
      "### **建議回饋**\n你已補充具體素材。\n\n### **重點摘要**\n例子、原因與主張的連結已更清楚。\n\n### **下一步補強**\n接下來要進入步驟三生成論點。",
      2,
      "2-3"
    ),
    true
  );
});

test("Step1/2 feedback quality guard allows question marks in 建議回饋 and 重點摘要", () => {
  assert.equal(
    isStep12FeedbackQualityRisk(
      "### **建議回饋**\n你們已經抓到主張核心了，這個理由可以再具體一點嗎？\n\n### **重點摘要**\n你們提出了主張、理由與例子，是否已經把關鍵詞定義清楚？\n\n### **下一步補強**\n請在目前子步驟內補上一個更具體的生活例子，讓主張更有說服力。",
      1,
      "1-4-2"
    ),
    false
  );
});

test("sanitizeStudentFacingText keeps text intact and extracts feedback from JSON-ish content", () => {
  assert.equal(sanitizeStudentFacingText("兩位同學都非常棒，都"), "兩位同學都非常棒，都");
  assert.equal(sanitizeStudentFacingText('{"feedback":"大家分析得很清楚，而且"}'), "大家分析得很清楚，而且");
  assert.equal(
    sanitizeStudentFacingText('{"feedback":"你們已經找到原因鏈，接下來請再補一個生活例子","nextQuestion":"'),
    "你們已經找到原因鏈，接下來請再補一個生活例子"
  );
  assert.equal(sanitizeStudentFacingText('{"feedback":"'), "已收到大家的回覆。");
  assert.equal(sanitizeStudentFacingText("```json{"), "已收到大家的回覆。");
  assert.equal(sanitizeStudentFacingText("{"), "已收到大家的回覆。");
});

test("normalizeStep5Summary deduplicates repeated section blocks and keeps the fullest content", () => {
  const raw = `
### **讚美與鼓勵**
clj01同學，你非常棒！在前面的步驟中，你很認真地思考了作文題目，也勇敢地分享了自己的真實經驗

### **讚美與鼓勵**
clj01同學，你非常棒！在前面的步驟中，你很認真地思考了作文題目，也勇敢地分享了自己的

### **讚美與鼓勵**
clj01同學，你非常棒！在前面的步驟中，你很認真地思考了作文題目，也勇敢地分享了自己的真實經驗和想法。

### **我們討論了什麼**
作文題目分析：我們確認了「我們與3C的距離」這篇作文是議論文。
`;
  const normalized = normalizeStep5Summary(raw);
  assert.equal((normalized.match(/### \*\*讚美與鼓勵\*\*/g) ?? []).length, 1);
  assert.match(normalized, /真實經驗和想法/);
});

test("normalizeStep6SuggestionText removes truncation meta and duplicate paragraphs", () => {
  const raw = `
同學，你這份初稿寫得很不錯耶！你把之前我們討論的重點都放進去了。

同學，你這份初稿寫得很不錯耶！你把之前我們討論的重點都放進去了。

同學，很抱歉上一則回覆被截斷了，而且我發現你這次提供的文章...

字詞使用建議
這段可以改得更精準。
`;
  const normalized = normalizeStep6SuggestionText(raw);
  assert.equal((normalized.match(/同學，你這份初稿寫得很不錯耶/g) ?? []).length, 1);
  assert.equal(normalized.includes("上一則回覆被截斷"), false);
});

test("normalizeStep6SuggestionText polishes bad line-break stitching without changing content", () => {
  const raw = `
同學，你這份初稿寫得很不錯耶！接下來我們來看看這篇文章
還有沒有可以讓它更亮眼的地方吧！

內容結構建議
你可以再補一個例子來支持主張。

你可以再補一個例子來支持主張。
`;
  const normalized = normalizeStep6SuggestionText(raw);
  assert.equal(normalized.includes("文章\n還有沒有"), false);
  assert.match(normalized, /文章還有沒有可以讓它更亮眼的地方吧/);
  assert.equal(normalized.includes("內容結構建議"), true);
  assert.equal(normalized.includes("你可以再補一個例子來支持主張"), true);
});

test("hasStep6SuggestionQualityRisk detects duplicated lines and incomplete ending", () => {
  assert.equal(
    hasStep6SuggestionQualityRisk(
      "同學，這一段建議需要再補一個具體例子，讓讀者更容易理解你的主張。\n同學，這一段建議需要再補一個具體例子，讓讀者更容易理解你的主張。"
    ),
    true
  );
  assert.equal(
    hasStep6SuggestionQualityRisk(
      "這是一段很長的建議內容但是最後沒有收尾符號而且看起來像是被中斷這是一段很長的建議內容但是最後沒有收尾符號而且看起來像是被中斷這是一段很長的建議內容但是最後沒有收尾符號而且看起來像是被中斷"
    ),
    true
  );
  assert.equal(hasStep6SuggestionQualityRisk("這是一段完整的建議內容，句子完整收尾。"), false);
});

test("OpenAI-compatible response parser detects truncated assistant output", () => {
  const parsed = pickAssistantTextResult({
    choices: [
      {
        finish_reason: "length",
        message: {
          content: "這是一段被長度限制截斷的回覆"
        }
      }
    ]
  });

  assert.equal(parsed.text, "這是一段被長度限制截斷的回覆");
  assert.equal(isTruncatedFinishReason(parsed.finishReason), true);
  assert.equal(isTruncatedFinishReason("stop"), false);
});

test("structure tree node permissions lock first and second levels", () => {
  assert.deepEqual(getStructureTreeNodePermissions(1, 2), {
    canAddChild: false,
    canDelete: false,
    canEditText: false
  });
  assert.deepEqual(getStructureTreeNodePermissions(2, 0), {
    canAddChild: true,
    canDelete: false,
    canEditText: false
  });
  assert.deepEqual(getStructureTreeNodePermissions(3, 1), {
    canAddChild: true,
    canDelete: false,
    canEditText: true
  });
  assert.deepEqual(getStructureTreeNodePermissions(4, 0), {
    canAddChild: true,
    canDelete: true,
    canEditText: true
  });
});

test("Step3 completion validation requires all depth-3+ default nodes to be edited", () => {
  const defaultOutline = `
graph TD
  A["題目"]
  A --> B["本論"]
  B --> C["論點一"]
  B --> D["論點二"]
  C --> E["例子"]
`.trim();

  const unchangedSubmission = defaultOutline;
  const changedDepth2Only = `
graph TD
  A["題目"]
  A --> B["本論（已改）"]
  B --> C["論點一"]
  B --> D["論點二"]
  C --> E["例子"]
`.trim();
  const changedAllDepth3Plus = `
graph TD
  A["題目"]
  A --> B["本論"]
  B --> C["我方主張一"]
  B --> D["我方主張二"]
  C --> E["生活中的具體例子"]
`.trim();

  const r1 = validateStep3OutlineCompletion(defaultOutline, unchangedSubmission, 3);
  assert.equal(r1.ok, false);
  assert.equal(r1.requiredNodeCount, 3);
  assert.equal(r1.changedNodeCount, 0);

  const r2 = validateStep3OutlineCompletion(defaultOutline, changedDepth2Only, 3);
  assert.equal(r2.ok, false);
  assert.equal(r2.requiredNodeCount, 3);
  assert.equal(r2.changedNodeCount, 0);

  const r3 = validateStep3OutlineCompletion(defaultOutline, changedAllDepth3Plus, 3);
  assert.equal(r3.ok, true);
  assert.equal(r3.requiredNodeCount, 3);
  assert.equal(r3.changedNodeCount, 3);
});

test("open class id generation uses max existing sequence to avoid overwrite after deletions", () => {
  assert.equal(computeNextOpenClassId([]), "oc-001");
  assert.equal(computeNextOpenClassId(["oc-001", "oc-002"]), "oc-003");
  assert.equal(computeNextOpenClassId(["oc-001", "oc-003"]), "oc-004");
  assert.equal(computeNextOpenClassId(["oc-009", "legacy", "oc-010"]), "oc-011");
});

test("outline sync guard blocks stale polling while autosave is catching up", () => {
  assert.equal(
    shouldSyncOutlineFromSession({
      localPendingOutline: "graph TD\n  a[\"新內容\"]",
      serverOutline: "graph TD\n  a[\"舊內容\"]",
      outlineDirty: false
    }),
    false
  );
  assert.equal(
    shouldSyncOutlineFromSession({
      localPendingOutline: "graph TD\n  a[\"新內容\"]",
      serverOutline: "graph TD\n  a[\"新內容\"]",
      outlineDirty: false
    }),
    true
  );
  assert.equal(
    resolvePendingOutlineAfterServerSync({
      localPendingOutline: "graph TD\n  a[\"新內容\"]",
      serverOutline: "graph TD\n  a[\"新內容\"]"
    }),
    null
  );
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

test("Step1/2 group gate prioritizes joined users and does not block on absent members", () => {
  const session = baseSession({
    participants: ["s1", "s2", "s3"],
    joinedUsers: ["s1", "s2"]
  });

  const first = handleStep1Or2Group(session, "s1", "我先回答完整想法", makeMessage);
  assert.equal(first.allResponded, false);

  const second = handleStep1Or2Group(session, "s2", "我也回答完整想法", makeMessage);
  assert.equal(second.allResponded, true);
});

test("Step1/2 group gate does not auto-complete when one joined member has not answered yet", () => {
  const session = baseSession({
    participants: ["s1", "s2"],
    joinedUsers: ["s1", "s2"]
  });

  const first = handleStep1Or2Group(session, "s2", "我先回答完整想法", makeMessage);
  assert.equal(first.allResponded, false);
  assert.deepEqual(new Set(session.groupGate["1-1"]), new Set(["s2"]));
});

test("Step1/2 group gate falls back to participants when joinedUsers is unavailable", () => {
  const session = baseSession({
    participants: ["s1", "s2", "s3"],
    joinedUsers: []
  });

  const first = handleStep1Or2Group(session, "s1", "我先回答完整想法", makeMessage);
  assert.equal(first.allResponded, false);

  const second = handleStep1Or2Group(session, "s2", "我也回答完整想法", makeMessage);
  assert.equal(second.allResponded, false);

  const third = handleStep1Or2Group(session, "s3", "我最後回答完整想法", makeMessage);
  assert.equal(third.allResponded, true);
});

test("Step1/2 advancement accepts resolved next question and still falls back when missing", () => {
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

  advanceStep1Or2SubstepAfterAi(session, 1, 1, "resolved：請補充你們小組目前的立場。", makeMessage);
  assert.equal(session.stepState.step1Substep, 2);
  assert.match(session.messages.at(-1)?.text ?? "", /resolved：請補充你們小組目前的立場/);

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

test("stalled Step1/2 AI wait can be recovered on session polling", () => {
  const session = baseSession({
    currentStep: 1,
    stepState: { step1Substep: 3, step2Substep: 1, step1Substep3Question: 2, step1Substep4Question: 1, step2Substep1Question: 1 },
    groupGate: { "1-3-2": ["s1", "s2"] },
    messages: [
      { id: "m-old", at: "2026-05-07T00:00:00.000Z", role: "student", userId: "s2", step: 1, text: "我也回答完整想法" }
    ],
    promptConfig: {
      stepPrompts: {},
      subStepPrompts: {},
      subStepPromptsFallbacks: { "1-3-3": "fallback：請再補上一個判斷理由。" },
      questionBanks: {},
      step9Questions: {},
      stepOpenings: {}
    }
  });

  const recovered = recoverStalledStep1Or2AiWait(session, makeMessage, {
    nowMs: new Date("2026-05-07T00:03:00.000Z").getTime()
  });

  assert.equal(recovered, true);
  assert.deepEqual(session.groupGate["1-3-2"], []);
  assert.equal(session.stepState.step1Substep3Question, 3);
  assert.match(session.messages.at(-1)?.text ?? "", /子步驟 1-3-3：fallback/);
});

test("stalled Step1/2 recovery handles boundary subquestions", () => {
  const step133 = baseSession({
    currentStep: 1,
    stepState: { step1Substep: 3, step2Substep: 1, step1Substep3Question: 3, step1Substep4Question: 1, step2Substep1Question: 1 },
    groupGate: { "1-3-3": ["s1", "s2"] },
    messages: [
      { id: "m-133-s1", at: "2026-05-07T00:00:00.000Z", role: "student", userId: "s1", step: 1, text: "我回答 1-3-3" },
      { id: "m-133-ai", at: "2026-05-07T00:00:20.000Z", role: "ai", step: 1, text: "AI 暫時處理中" }
    ],
    promptConfig: {
      stepPrompts: {},
      subStepPrompts: {},
      subStepPromptsFallbacks: { "1-4-1": "fallback：請寫出你們的核心主張。" },
      questionBanks: {},
      step9Questions: {},
      stepOpenings: {}
    }
  });

  assert.equal(
    recoverStalledStep1Or2AiWait(step133, makeMessage, { nowMs: new Date("2026-05-07T00:02:00.000Z").getTime() }),
    true
  );
  assert.deepEqual(step133.groupGate["1-3-3"], []);
  assert.equal(step133.stepState.step1Substep, 4);
  assert.match(step133.messages.at(-1)?.text ?? "", /子步驟 1-4-1：fallback/);

  const step143 = baseSession({
    currentStep: 1,
    stepState: { step1Substep: 4, step2Substep: 1, step1Substep3Question: 3, step1Substep4Question: 3, step2Substep1Question: 1 },
    groupGate: { "1-4-3": ["s1", "s2"] },
    messages: [{ id: "m-143", at: "2026-05-07T00:00:00.000Z", role: "system", step: 1, text: "仍在等待遠端 AI" }],
    promptConfig: {
      stepPrompts: {},
      subStepPrompts: {},
      subStepPromptsFallbacks: {},
      questionBanks: { "1-5": ["題庫：請總結你們目前的共識。"] },
      step9Questions: {},
      stepOpenings: {}
    }
  });

  assert.equal(
    recoverStalledStep1Or2AiWait(step143, makeMessage, { nowMs: new Date("2026-05-07T00:02:00.000Z").getTime() }),
    false
  );
  step143.messages.push({ id: "m-143-s2", at: "2026-05-07T00:00:10.000Z", role: "student", userId: "s2", step: 1, text: "我回答 1-4-3" });
  assert.equal(
    recoverStalledStep1Or2AiWait(step143, makeMessage, { nowMs: new Date("2026-05-07T00:02:00.000Z").getTime() }),
    true
  );
  assert.equal(step143.stepState.step1Substep, 5);
  assert.match(step143.messages.at(-1)?.text ?? "", /子步驟 1-5：題庫/);

  const step213 = baseSession({
    currentStep: 2,
    stepState: { step1Substep: 5, step2Substep: 1, step1Substep3Question: 3, step1Substep4Question: 3, step2Substep1Question: 3 },
    groupGate: { "2-1-3": ["s1", "s2"] },
    messages: [{ id: "m-213", at: "2026-05-07T00:00:00.000Z", role: "student", userId: "s2", step: 2, text: "我回答 2-1-3" }],
    promptConfig: {
      stepPrompts: {},
      subStepPrompts: {},
      subStepPromptsFallbacks: { "2-2": "fallback：請把例子補充得更具體。" },
      questionBanks: {},
      step9Questions: {},
      stepOpenings: {}
    }
  });

  assert.equal(
    recoverStalledStep1Or2AiWait(step213, makeMessage, { nowMs: new Date("2026-05-07T00:02:00.000Z").getTime() }),
    true
  );
  assert.equal(step213.stepState.step2Substep, 2);
  assert.match(step213.messages.at(-1)?.text ?? "", /子步驟 2-2：fallback/);
});

test("next-substep key transitions are explicit and deterministic", () => {
  const s = baseSession({
    currentStep: 1,
    stepState: { step1Substep: 3, step2Substep: 1, step1Substep3Question: 2, step1Substep4Question: 1, step2Substep1Question: 1 }
  });
  assert.equal(getNextSubstepKeyAfterCompletion(s, 1, 3), "1-3-3");

  s.stepState.step1Substep3Question = 3;
  assert.equal(getNextSubstepKeyAfterCompletion(s, 1, 3), "1-4-1");

  s.stepState.step1Substep = 4;
  s.stepState.step1Substep4Question = 3;
  assert.equal(getNextSubstepKeyAfterCompletion(s, 1, 4), "1-5");

  const s2 = baseSession({
    currentStep: 2,
    stepState: { step1Substep: 5, step2Substep: 1, step1Substep3Question: 3, step1Substep4Question: 3, step2Substep1Question: 1 }
  });
  assert.equal(getNextSubstepKeyAfterCompletion(s2, 2, 1), "2-1-2");
  s2.stepState.step2Substep1Question = 3;
  assert.equal(getNextSubstepKeyAfterCompletion(s2, 2, 1), "2-2");
});

test("Step1/2 advancement accepts resolved next question for Step2 branches", () => {
  const session = baseSession({
    currentStep: 2,
    stepState: { step1Substep: 5, step2Substep: 2, step1Substep3Question: 3, step1Substep4Question: 3, step2Substep1Question: 3 },
    promptConfig: {
      stepPrompts: {},
      subStepPrompts: {},
      subStepPromptsFallbacks: {},
      questionBanks: {},
      step9Questions: {},
      stepOpenings: {}
    }
  });
  advanceStep1Or2SubstepAfterAi(session, 2, 2, "resolved：請說明這個例子的因果鏈？", makeMessage);
  assert.equal(session.stepState.step2Substep, 3);
  assert.match(session.messages.at(-1)?.text ?? "", /子步驟 2-3：resolved/);
});

test("engine source includes two-stage Step1/2 observability and question source branching", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(resolve(thisDir, "../src/lib/engine.ts"), "utf8");

  assert.ok(src.includes("generateStep12Feedback"), "engine should have stage-1 feedback generator");
  assert.ok(src.includes("generateStep12NextQuestion"), "engine should have stage-2 question generator");
  assert.ok(src.includes('"questionBank_random"'), "engine should track questionBank_random source");
  assert.ok(src.includes("step12RoundLogs"), "engine should record step12RoundLogs observability fields");
  assert.ok(src.includes("step12FallbackDebugTraces"), "engine should maintain step12 fallback debug trace fields");
  assert.ok(src.includes("step12RoundState"), "engine should keep step12RoundState for re-entry guard");
  assert.ok(src.includes("禁止新增「### **請回答以下問題**」區塊"), "feedback stage should block only next-question section injection");
  assert.equal(src.includes("禁止提出下一題或任何問句"), false, "feedback stage should allow question-form wording");
});

test("advanced stuck risk combines rejection, idle, Step3, and Step6 signals", () => {
  const session = {
    ...baseSession({
      currentStep: 3,
      groupGate: { "3-complete": ["s2"] },
      messages: [makeMessage({ role: "student", userId: "s1", step: 3, text: "我還沒想到" })]
    }),
    artifactDiagnostics: { step3OutlineChars: { s1: 0, s2: 40 }, step3OutlineUpdatedAt: { s2: "2026-05-06T00:03:00.000Z" }, draftStep6Chars: {} }
  };
  session.messages[0]!.at = "2026-05-06T00:00:00.000Z";
  recordRejectedAnswerSignal(session, "s1", "1-1", "2026-05-06T00:01:00.000Z");
  recordRejectedAnswerSignal(session, "s1", "1-1", "2026-05-06T00:02:00.000Z");

  const risk = buildAdvancedStuckRisk(session, new Date("2026-05-06T00:15:00.000Z").getTime());
  assert.equal(risk.level, "stuck");
  assert.deepEqual(risk.pendingMembers, ["s1"]);
  assert.match(risk.reasons.join("\n"), /多次送出未通過回答品質檢查/);
  assert.match(risk.reasons.join("\n"), /Step3 結構樹/);
  assert.match(risk.reasons.join("\n"), /一段時間未更新/);
  assert.ok(risk.suggestions.some((suggestion) => suggestion.includes("完成結構樹")));

  const step6Risk = buildAdvancedStuckRisk(
    {
      ...baseSession({
        currentStep: 6,
        personalSteps: { s1: 6, s2: 8 },
        messages: [makeMessage({ role: "student", userId: "s1", step: 6, text: "開頭" })]
      }),
      artifactDiagnostics: { draftStep6Chars: { s1: 12 } }
    },
    new Date("2026-05-06T00:15:00.000Z").getTime()
  );
  assert.match(step6Risk.reasons.join("\n"), /Step6 初稿字數偏低/);
});

test("student next-action card gives concrete action instead of generic status", () => {
  assert.match(
    buildStudentNextAction({
      currentStep: 1,
      currentMode: "group_interaction",
      canReplyToQuestion: true,
      isSendingMessage: false,
      waitingAiForGroup: false,
      waitingGroupMembers: false,
      waitingGroupMemberNames: [],
      step1CompletedWaitingTeacher: false,
      step2CompletedWaitingTeacher: false,
      step3CompletedByMe: false,
      waitingStep3Members: false,
      step4CompletedByMe: false,
      allStep4Completed: false,
      draftTextLength: 0,
      unsavedDraftChars: 0,
      step9AnsweredCount: 0
    }).body,
    /回答目前系統提問/
  );

  assert.match(
    buildStudentNextAction({
      currentStep: 3,
      currentMode: "personal_interaction",
      canReplyToQuestion: true,
      isSendingMessage: false,
      waitingAiForGroup: false,
      waitingGroupMembers: false,
      waitingGroupMemberNames: [],
      step1CompletedWaitingTeacher: false,
      step2CompletedWaitingTeacher: false,
      step3CompletedByMe: false,
      waitingStep3Members: false,
      step4CompletedByMe: false,
      allStep4Completed: false,
      draftTextLength: 0,
      unsavedDraftChars: 0,
      step9AnsweredCount: 0
    }).body,
    /完成結構樹/
  );

  assert.match(
    buildStudentNextAction({
      currentStep: 6,
      currentMode: "personal_interaction",
      canReplyToQuestion: false,
      isSendingMessage: false,
      waitingAiForGroup: false,
      waitingGroupMembers: false,
      waitingGroupMemberNames: [],
      step1CompletedWaitingTeacher: false,
      step2CompletedWaitingTeacher: false,
      step3CompletedByMe: true,
      waitingStep3Members: false,
      step4CompletedByMe: true,
      allStep4Completed: true,
      draftTextLength: 20,
      unsavedDraftChars: 20,
      step9AnsweredCount: 0
    }).body,
    /至少完成開頭/
  );

  const step4Action = buildStudentNextAction({
    currentStep: 4,
    currentMode: "group_interaction",
    canReplyToQuestion: true,
    isSendingMessage: false,
    waitingAiForGroup: true,
    waitingGroupMembers: false,
    waitingGroupMemberNames: [],
    step1CompletedWaitingTeacher: false,
    step2CompletedWaitingTeacher: false,
    step3CompletedByMe: false,
    waitingStep3Members: false,
    step4CompletedByMe: false,
    allStep4Completed: false,
    draftTextLength: 0,
    unsavedDraftChars: 0,
    step9AnsweredCount: 0
  });
  assert.equal(step4Action.title, "確認修正完成");
});

test("step6 draft validation rejects insufficient content and accepts a real essay draft", () => {
  // Reject: empty
  assert.match(validateDraftContent("") ?? "", /字數不足/);

  // Reject: too short (< 100 chars total)
  assert.match(validateDraftContent("這是一篇文章。") ?? "", /字數不足/);

  // Reject: enough total chars but too few CJK chars (mostly spaces/English)
  const latinPadded = "a ".repeat(60); // 120 chars but 0 CJK
  assert.match(validateDraftContent(latinPadded) ?? "", /中文字數不足/);

  // Reject: repetitive filler ("啊" × 200)
  assert.match(validateDraftContent("啊".repeat(200)) ?? "", /重複字元/);

  // Reject: repeating short phrase
  assert.match(validateDraftContent("測試測試測試測試測試測試測試測試測試".repeat(10)) ?? "", /重複字元/);

  // Reject: low-effort single phrase
  assert.match(validateDraftContent("不知道") ?? "", /字數不足|敷衍/);

  // Accept: a real short essay draft with >= 100 chars and >= 50 CJK
  const validDraft =
    "根據題目要求，本文將從三個角度探討台灣的環境保護問題。" +
    "首先，空氣污染已成為都市居民的主要健康隱患，需要政府與企業共同正視。" +
    "其次，海洋廢棄物的問題日益嚴重，民眾應減少一次性塑膠的使用。" +
    "最後，森林濫伐破壞了生態平衡，必須透過立法與教育並行加以遏止。";
  assert.equal(validateDraftContent(validDraft), null);
});

test("Step6/8 draft validation accepts earnest title-related drafts without exact title copy", () => {
  const session = baseSession({ activityTitle: "螢幕下的童年回憶" });
  const earnestDraft =
    "小時候，我常常拿著平板玩遊戲，當下覺得很快樂，好像時間一下子就過去了。" +
    "可是長大一點後，我發現那些遊戲關卡大多很相似，留下來的記憶反而不多。" +
    "有一次我和朋友在遊樂場跌進泥巴，全身都髒了，大家卻笑得很開心。" +
    "那種真實互動帶來的感受，比螢幕裡預設好的路線更鮮明，也讓我的童年有了可以回想的畫面。";

  assert.equal(validateDraftContent(session, earnestDraft, "初稿"), null);
  assert.equal(validateDraftContent(session, earnestDraft, "最終稿"), null);
});

test("Step6/8 draft validation rejects short or low-information title-padded drafts", () => {
  const session = baseSession({ activityTitle: "螢幕下的童年回憶" });

  assert.match(
    validateDraftContent(session, "螢幕下的童年回憶讓我想到很多事情，我覺得很好，也很有意思。", "初稿") ?? "",
    /字數不足/
  );
  assert.match(
    validateDraftContent(session, "螢幕下的童年回憶".repeat(12), "最終稿") ?? "",
    /字數不足|資訊量偏低|重複字元/
  );
  assert.match(
    validateDraftContent(
      session,
      "今天早餐我吃了蛋餅和豆漿，店裡的人很多，排隊花了不少時間。後來我去操場打球，大家玩得很開心，下午又討論明星和遊戲，整天都很熱鬧。" +
        "晚餐又去買飲料，回家看比賽和明星訪談，還整理球鞋、聊天、安排週末聚會，整篇都在描述日常行程與娛樂活動。",
      "初稿"
    ) ?? "",
    /關聯性不足/
  );
});

test("renderMessageHtml handles legacy escaped newlines and outer markdown code fences", () => {
  const legacy = "```markdown\\n## 總結報告\\n- 重點一\\n- 重點二\\n```";
  const html = renderMessageHtml(legacy);
  assert.match(html, /<h3[^>]*>總結報告<\/h3>/);
  assert.match(html, /<ul><li>重點一<\/li><li>重點二<\/li><\/ul>/);
  assert.equal(html.includes("```"), false);
  assert.equal(html.includes("## 總結報告"), false);
});

test("renderMessageHtml unwraps JSON-shaped Step10 report text before markdown rendering", () => {
  const jsonString = JSON.stringify("## 總結報告\\n- 重點一\\n- 重點二");
  const jsonObject = JSON.stringify({ step10Report: "## 總結報告\\n- 重點一\\n- 重點二" });
  const openAiWrapper = JSON.stringify({ choices: [{ message: { content: "## 總結報告\\n- 重點一\\n- 重點二" } }] });
  const geminiWrapper = JSON.stringify({ candidates: [{ content: { parts: [{ text: "## 總結報告\\n- 重點一\\n- 重點二" }] } }] });
  const contentArrayWrapper = JSON.stringify({ content: [{ type: "text", text: "## 總結報告\\n- 重點一\\n- 重點二" }] });

  for (const sample of [jsonString, jsonObject, openAiWrapper, geminiWrapper, contentArrayWrapper]) {
    const html = renderMessageHtml(sample);
    assert.match(html, /<h3[^>]*>總結報告<\/h3>/);
    assert.match(html, /<ul><li>重點一<\/li><li>重點二<\/li><\/ul>/);
    assert.equal(html.includes("## 總結報告"), false);
    assert.equal(/step10Report|choices|candidates|content/.test(html), false);
  }
});

test("renderMessageHtml decodes markdown marker entities before heading parsing", () => {
  const html = renderMessageHtml("&num;&num; 總結報告\n&#45; 重點一\n&#45; 重點二");
  assert.match(html, /<h3[^>]*>總結報告<\/h3>/);
  assert.match(html, /<ul><li>重點一<\/li><li>重點二<\/li><\/ul>/);
  assert.equal(html.includes("&num;"), false);
  assert.equal(html.includes("&#45;"), false);
});

test("renderMessageHtml collapses duplicated markdown heading prefixes", () => {
  const html = renderMessageHtml("## ### **立意取材**\n### **結構組織**");
  assert.match(html, /<h4[^>]*><strong>立意取材<\/strong><\/h4>/);
  assert.match(html, /<h4[^>]*><strong>結構組織<\/strong><\/h4>/);
  assert.equal(html.includes("### <strong>立意取材"), false);
  assert.equal(html.includes("## ###"), false);
});

test("renderMessageHtml keeps inline heading body in normal paragraph text", () => {
  const html = renderMessageHtml("### **立意取材**你能從自身經驗出發。");
  assert.match(html, /<h4[^>]*>立意取材<\/h4>/);
  assert.match(html, /<p[^>]*>你能從自身經驗出發。<\/p>/);
  assert.equal(html.includes("<strong>立意取材</strong>你能"), false);
});

test("Step10 section title parsing removes markdown wrappers before composition", () => {
  const titles = parseStep10SectionTitles("1. ### **立意取材**\n- ## **結構組織**\n三、### 遣詞造句：\n```");
  assert.deepEqual(titles, ["立意取材", "結構組織", "遣詞造句"]);
});

test("Step10 section content drops a repeated leading generated title", () => {
  const text = stripLeadingStep10SectionHeading("### **立意取材**\n你能從自身經驗出發。", "立意取材");
  assert.equal(text, "你能從自身經驗出發。");
});

test("Step10 section body keeps only the requested section from a full-format LLM reply", () => {
  const titles = ["立意取材", "結構組織", "遣詞造句", "錯別字、格式與標點符號", "總評語"];
  const body = normalizeStep10SectionBody(
    "### **立意取材**你能從生活經驗取材。\n\n### **結構組織**這段不該出現在本節。",
    "立意取材",
    titles
  );
  assert.equal(body, "你能從生活經驗取材。");
});

test("Step10 section body stops before an old inline completion reminder", () => {
  const body = normalizeStep10SectionBody(
    "### **總評語**這次練習很完整。\n\n**課程完成提醒：** 舊提醒不應留在總評語。",
    "總評語",
    ["立意取材", "結構組織", "遣詞造句", "錯別字、格式與標點符號", "總評語"]
  );
  assert.equal(body, "這次練習很完整。");
});

test("Step10 report config composes stable headings with plain body text", () => {
  const config = resolveStep10ReportConfig({
    sections: [{ id: "content", title: "立意取材", focus: "取材", instruction: "說明取材。" }],
    completionReminder: "請持續練習。"
  });
  const report = composeStep10Report([{ title: config.sections[0]!.title, body: "你能從經驗出發。" }], config.completionReminder);
  assert.equal(report, "## 立意取材\n你能從經驗出發。\n\n## 課程完成提醒\n請持續練習。");
});

test("teacher monitor payload hash changes when Step3/4 gate members change", () => {
  const before = computeTeacherMonitorPayloadHash([
    { sessionId: "s1", currentStep: 3, messageCount: 2, lastMessageAt: "2026-05-21T00:00:00.000Z", groupGate: { "3-complete": ["u1"] } }
  ]);
  const after = computeTeacherMonitorPayloadHash([
    { sessionId: "s1", currentStep: 3, messageCount: 2, lastMessageAt: "2026-05-21T00:00:00.000Z", groupGate: { "3-complete": ["u1", "u2"] } }
  ]);
  assert.notEqual(before, after);
});

test("teacher monitor payload hash changes when attendance or makeup state changes", () => {
  const before = computeTeacherMonitorPayloadHash([
    { sessionId: "s1", currentStep: 4, messageCount: 2, lastMessageAt: "2026-05-21T00:00:00.000Z" }
  ]);
  const afterAttendance = computeTeacherMonitorPayloadHash([
    {
      sessionId: "s1",
      currentStep: 4,
      messageCount: 2,
      lastMessageAt: "2026-05-21T00:00:00.000Z",
      attendanceOverrides: { waitingExcludedUsernames: ["u2"], updatedAt: "2026-05-21T00:01:00.000Z" }
    }
  ]);
  const afterMakeup = computeTeacherMonitorPayloadHash([
    {
      sessionId: "s1",
      currentStep: 4,
      messageCount: 2,
      lastMessageAt: "2026-05-21T00:00:00.000Z",
      makeupWork: { outlineRequiredUsernames: ["u2"], outlineCompletedUsernames: [] }
    }
  ]);
  assert.notEqual(before, afterAttendance);
  assert.notEqual(before, afterMakeup);
});

test("session waiting exclusion removes only current gate requirements and preserves makeup state", () => {
  const session = baseSession({
    currentStep: 3,
    joinedUsers: ["s1", "s2"],
    outlines: { s1: "graph TD\nA --> B" },
    step3SubmittedOutlines: { s1: "graph TD\nA --> B" }
  });

  setWaitingExclusion(session, { username: "s2", excluded: true, by: "teacher", at: "2026-06-07T00:00:00.000Z" });
  assert.deepEqual(resolveStep12GateMembers(session), ["s1"]);
  assert.equal(isMakeupOutlinePending(session, "s2"), true);

  setWaitingExclusion(session, { username: "s2", excluded: false, by: "teacher", at: "2026-06-07T00:05:00.000Z" });
  assert.deepEqual(resolveStep12GateMembers(session), ["s1", "s2"]);
  assert.equal(isMakeupOutlinePending(session, "s2"), true);
});

test("waiting exclusion never creates a zero-member auto-complete gate", () => {
  const session = baseSession({ joinedUsers: ["s1", "s2"] });
  setWaitingExclusion(session, { username: "s1", excluded: true, by: "teacher", at: "2026-06-07T00:00:00.000Z" });
  setWaitingExclusion(session, { username: "s2", excluded: true, by: "teacher", at: "2026-06-07T00:00:01.000Z" });
  assert.deepEqual(resolveStep12GateMembers(session), []);
});

test("teacher monitor keeps Step3/4 advance gates on fast polling", () => {
  assert.equal(hasLowLatencyStepAdvanceGate([{ sessionId: "s1", currentStep: 3 }]), true);
  assert.equal(hasLowLatencyStepAdvanceGate([{ sessionId: "s1", currentStep: 4 }]), true);
  assert.equal(hasLowLatencyStepAdvanceGate([{ sessionId: "s1", currentStep: 5 }]), false);
  assert.equal(
    resolveTeacherMonitorNextPollDelay({ currentDelayMs: 12000, unchanged: true, hasLowLatencyGate: true }),
    TEACHER_MONITOR_FAST_POLL_MS
  );
  assert.equal(
    resolveTeacherMonitorNextPollDelay({ currentDelayMs: 12000, unchanged: false, hasLowLatencyGate: false }),
    TEACHER_MONITOR_MIN_POLL_MS
  );
});
