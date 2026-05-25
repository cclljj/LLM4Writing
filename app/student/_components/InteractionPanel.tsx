"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import { formatTaipeiDateTime } from "@/src/lib/time-format";
import { renderMessageHtml } from "./renderMessageHtml";

type InteractiveItem = {
  id: string;
  kind: "question" | "student" | "ai";
  text: string;
  at: string;
  userId?: string;
};

type InteractionPanelProps = {
  currentStep: number;
  currentMode: string;
  interactiveMessages: InteractiveItem[];
  text: string;
  onTextChange: (value: string) => void;
  onSendMessage: (e: FormEvent) => void;
  onSubmitStep9: (e: FormEvent) => void;
  onCompleteStep4?: () => void;
  onCompleteStep6?: () => void;
  isSendingMessage: boolean;
  waitingAiForGroup: boolean;
  waitingGroupMembers: boolean;
  step1CompletedWaitingTeacher: boolean;
  step2CompletedWaitingTeacher: boolean;
  step4CompletedByMe: boolean;
  allStep4Completed: boolean;
  step4CompletedPeers: string[];
  isCompletingStep6: boolean;
  isSuggestingStep6: boolean;
  isInputEnabled: boolean;
  canReplyToQuestion: boolean;
  courseStatusBlockedMessage: string;
  step9Answers: string[];
  onStep9AnswerChange: (idx: number, value: string) => void;
  step9QuestionTexts: string[];
  error: string;
};

function formatUtc8Title(iso: string): string {
  const text = formatTaipeiDateTime(iso);
  if (text === "—") return "互動時間：未知";
  return `互動時間：${text} (UTC+8)`;
}

function parseStep6Suggestion(text: string): { draft: string; suggestion: string } | null {
  if (!text.includes("Step6 AI 修改建議")) return null;
  const draftMatch = text.match(/- 文章內容：\n([\s\S]*?)\n- AI 建議：/);
  const suggestionMatch = text.match(/- AI 建議：\n([\s\S]*)$/);
  const draft = (draftMatch?.[1] ?? "").trim();
  const suggestion = (suggestionMatch?.[1] ?? "").trim();
  if (!draft && !suggestion) return null;
  return { draft, suggestion };
}

function preventTextPaste(e: { preventDefault: () => void }) {
  e.preventDefault();
}

export default function InteractionPanel({
  currentStep,
  currentMode,
  interactiveMessages,
  text,
  onTextChange,
  onSendMessage,
  onSubmitStep9,
  onCompleteStep4,
  onCompleteStep6,
  isSendingMessage,
  waitingAiForGroup,
  waitingGroupMembers,
  step1CompletedWaitingTeacher,
  step2CompletedWaitingTeacher,
  step4CompletedByMe,
  allStep4Completed,
  step4CompletedPeers,
  isCompletingStep6,
  isSuggestingStep6,
  isInputEnabled,
  canReplyToQuestion,
  courseStatusBlockedMessage,
  step9Answers,
  onStep9AnswerChange,
  step9QuestionTexts,
  error,
}: InteractionPanelProps) {
  const step6SuggestionCardIds = useMemo(
    () =>
      currentStep === 6
        ? interactiveMessages
            .filter((message) => message.kind === "ai" && parseStep6Suggestion(message.text))
            .map((message) => message.id)
        : [],
    [currentStep, interactiveMessages]
  );
  const [step6ExpandedById, setStep6ExpandedById] = useState<Record<string, boolean>>({});
  const prevStep6CardIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (step6SuggestionCardIds.length === 0) {
      deferStateUpdate(() => {
        setStep6ExpandedById({});
        prevStep6CardIdsRef.current = [];
      });
      return;
    }
    const prevIds = prevStep6CardIdsRef.current;
    const hasNewCard = step6SuggestionCardIds.some((id) => !prevIds.includes(id));
    const latestId = step6SuggestionCardIds[step6SuggestionCardIds.length - 1]!;
    deferStateUpdate(() => {
      setStep6ExpandedById((prev) => {
        const next: Record<string, boolean> = {};
        if (hasNewCard) {
          step6SuggestionCardIds.forEach((id) => {
            next[id] = id === latestId;
          });
        } else {
          step6SuggestionCardIds.forEach((id) => {
            next[id] = Object.prototype.hasOwnProperty.call(prev, id) ? prev[id]! : id === latestId;
          });
        }
        return next;
      });
      prevStep6CardIdsRef.current = step6SuggestionCardIds;
    });
  }, [step6SuggestionCardIds]);

  return (
    <div className="card">
      <h2>{currentStep === 4 ? "小組討論區" : "互動內容"}</h2>
      {currentMode === "non_interactive" ? (
        <small>本步驟為無互動模式，請閱讀系統/AI 產出內容。</small>
      ) : null}
      {currentMode === "personal_reflection" ? (
        <small>個人反思模式：系統發問，AI 不回覆。</small>
      ) : null}

      {interactiveMessages.map((message) =>
        currentStep === 6 && message.kind === "student" ? null : (
          <div key={message.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
            {currentStep === 4 && message.kind === "student" ? (
              <p style={{ margin: 0 }}>
                <strong>{message.userId || "學生"}：</strong>
                <span style={{ marginLeft: 4, whiteSpace: "pre-wrap" }}>{message.text}</span>
                <small style={{ marginLeft: 6 }}>({message.at})</small>
              </p>
            ) : currentStep === 6 && message.kind === "ai" && parseStep6Suggestion(message.text) ? (
              (() => {
                const parsed = parseStep6Suggestion(message.text)!;
                const expanded = step6ExpandedById[message.id] ?? false;
                return (
                  <div style={{ border: "1px solid #dbeafe", borderRadius: 10, padding: "8px 10px", background: "#f8fbff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <strong style={{ color: "#1d4ed8" }}>{formatUtc8Title(message.at)}</strong>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          setStep6ExpandedById((prev) => ({ ...prev, [message.id]: !(prev[message.id] ?? false) }))
                        }
                        style={{ fontSize: 12, lineHeight: 1.1, padding: "3px 6px", minHeight: "unset", width: "fit-content", whiteSpace: "nowrap" }}
                      >
                        {expanded ? "關閉" : "展開"}
                      </button>
                    </div>
                    {expanded ? (
                      <div style={{ marginTop: 10 }}>
                        <h4 style={{ margin: "0 0 6px", fontSize: 14 }}>文章內容</h4>
                        <div
                          style={{ marginLeft: 14 }}
                          dangerouslySetInnerHTML={{ __html: renderMessageHtml(parsed.draft || "（無）") }}
                        />
                        <h4 style={{ margin: "12px 0 6px", fontSize: 14 }}>AI 建議</h4>
                        <div
                          style={{ marginLeft: 14 }}
                          dangerouslySetInnerHTML={{ __html: renderMessageHtml(parsed.suggestion || "（無）") }}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })()
            ) : (
              <>
                <strong>
                  {message.kind === "question"
                    ? "問題"
                    : message.kind === "student"
                      ? `學生${message.userId ? `(${message.userId})` : ""}`
                      : "AI 回覆"}
                </strong>
                <div
                  style={{ marginTop: 4 }}
                  dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }}
                />
                <small>{message.at}</small>
              </>
            )}
          </div>
        )
      )}

      {interactiveMessages.length === 0 ? <small>目前此步驟尚無互動內容。</small> : null}

      {currentStep === 4 && step4CompletedPeers.length > 0 ? (
        <div style={{ marginTop: 8 }}>
          {step4CompletedPeers.map((user) => (
            <p key={`step4-done-${user}`} style={{ margin: "4px 0" }}>
              <small>{user} 已確認完成此步驟。</small>
            </p>
          ))}
        </div>
      ) : null}

      {isSendingMessage ? (
        <p style={{ marginTop: 10 }}>
          <small>{currentStep === 4 ? "訊息送出中..." : "等待遠端 AI 回答中..."}</small>
        </p>
      ) : null}
      {!isSendingMessage && currentStep !== 4 && waitingAiForGroup ? (
        <p style={{ marginTop: 10 }}>
          <small>等待遠端 AI 回答中...</small>
        </p>
      ) : null}
      {waitingGroupMembers ? (
        <p style={{ marginTop: 10 }}>
          <small>
            {currentStep === 4
              ? "你已確認完成此步驟，等待同組其他同學完成..."
              : "等待同組其他同學完成本題回覆..."}
          </small>
        </p>
      ) : null}
      {currentStep === 4 && allStep4Completed ? (
        <p style={{ marginTop: 10 }}>
          <small>全組皆已確認完成此步驟，請等待老師切換至步驟 5。</small>
        </p>
      ) : null}
      {step1CompletedWaitingTeacher ? (
        <p style={{ marginTop: 10 }}>
          <small>步驟 1 已完成，請等待老師切換到步驟 2。</small>
        </p>
      ) : null}
      {step2CompletedWaitingTeacher ? (
        <p style={{ marginTop: 10 }}>
          <small>步驟 2 子步驟已完成，請等待老師切換下一步。</small>
        </p>
      ) : null}
      {courseStatusBlockedMessage ? (
        <p style={{ marginTop: 10 }}>
          <small>{courseStatusBlockedMessage}</small>
        </p>
      ) : null}

      {isInputEnabled &&
      canReplyToQuestion &&
      currentStep !== 9 &&
      !waitingGroupMembers &&
      !isSendingMessage &&
      !step1CompletedWaitingTeacher &&
      !step2CompletedWaitingTeacher ? (
        <form onSubmit={onSendMessage}>
          <label>{currentStep === 4 ? "我的發言" : "你的回答"}</label>
          <textarea value={text} onChange={(e) => onTextChange(e.target.value)} onPaste={preventTextPaste} />
          <button type="submit" style={{ marginTop: 10 }}>
            發送訊息
          </button>
          {currentStep === 4 ? (
            <button
              type="button"
              className="secondary"
              style={{ marginTop: 10 }}
              onClick={onCompleteStep4}
            >
              確認完成此步驟
            </button>
          ) : null}
        </form>
      ) : null}

      {currentStep === 9 ? (
        <form onSubmit={onSubmitStep9}>
          {([0, 1, 2, 3] as const).map((idx) => (
            <div key={`step9-q-${idx}`} style={{ marginTop: 10 }}>
              <label>
                {step9QuestionTexts[idx] ? `第 ${idx + 1} 題：${step9QuestionTexts[idx]}` : `第 ${idx + 1} 題`}
              </label>
              <textarea
                value={step9Answers[idx]}
                onChange={(e) => onStep9AnswerChange(idx, e.target.value)}
                onPaste={preventTextPaste}
              />
            </div>
          ))}
          <button type="submit" style={{ marginTop: 10 }} disabled={isSendingMessage}>
            一次送出四題答案
          </button>
        </form>
      ) : null}

      {currentStep === 6 ? (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            className="secondary"
            onClick={onCompleteStep6}
            disabled={isCompletingStep6 || isSuggestingStep6}
          >
            完成文章撰寫，進入下一步驟
          </button>
          {isCompletingStep6 ? (
            <small style={{ display: "block", marginTop: 6, color: "#94a3b8" }}>AI 正在處理中，請稍候...</small>
          ) : null}
        </div>
      ) : null}

      {currentStep === 4 && step4CompletedByMe && !allStep4Completed ? (
        <button type="button" className="secondary" style={{ marginTop: 10 }} disabled>
          已確認完成此步驟
        </button>
      ) : null}

      {error ? (
        <p>
          <small>{error}</small>
        </p>
      ) : null}
    </div>
  );
}
