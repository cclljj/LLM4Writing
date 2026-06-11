"use client";

import { FormEvent, memo } from "react";
import { renderMessageHtml } from "./renderMessageHtml";

type InteractiveItem = {
  id: string;
  kind: "question" | "student" | "ai";
  text: string;
  at: string;
  userId?: string;
};

function Step3InteractionCard({
  interactiveMessages,
  step3StreamingText,
  isSendingMessage,
  step3CompletedByMe,
  waitingStep3Members,
  isInputEnabled,
  canReplyToQuestion,
  text,
  onTextChange,
  onSendMessage,
  onReopenStep3
}: {
  interactiveMessages: InteractiveItem[];
  step3StreamingText: string;
  isSendingMessage: boolean;
  step3CompletedByMe: boolean;
  waitingStep3Members: boolean;
  isInputEnabled: boolean;
  canReplyToQuestion: boolean;
  text: string;
  onTextChange: (value: string) => void;
  onSendMessage: (event: FormEvent) => void;
  onReopenStep3: () => void;
}) {
  return (
    <div className="card">
      <h2>互動內容</h2>
      {interactiveMessages.map((message) => (
        <div key={message.id} style={{ borderTop: "1px solid var(--line-soft)", padding: "8px 0" }}>
          <strong>
            {message.kind === "question"
              ? "問題"
              : message.kind === "student"
                ? `學生${message.userId ? `(${message.userId})` : ""}`
                : "AI 回覆"}
          </strong>
          <div style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }} />
          <small>{message.at}</small>
        </div>
      ))}
      {interactiveMessages.length === 0 ? (
        <small>請先描述你目前想建構的文章主軸，或直接提出你在結構樹規劃上遇到的問題。</small>
      ) : null}
      {step3StreamingText ? (
        <div
          style={{
            borderTop: "1px solid var(--line-soft)",
            padding: "8px 0",
            whiteSpace: "pre-wrap"
          }}
        >
          <strong>AI 回覆</strong>
          <div style={{ marginTop: 4 }}>{step3StreamingText}</div>
        </div>
      ) : null}
      {isSendingMessage ? (
        <p style={{ marginTop: 10 }}><small>AI 正在整理回覆中，請稍候...</small></p>
      ) : null}
      {step3CompletedByMe ? (
        <p style={{ marginTop: 10 }}>
          <small>{waitingStep3Members ? "你已完成結構樹，等待其他同學完成..." : "你已完成結構樹，可等待老師切換下一步。"}</small>
        </p>
      ) : null}
      {step3CompletedByMe && isInputEnabled ? (
        <div style={{ marginTop: 8 }}>
          <button type="button" className="secondary" onClick={onReopenStep3}>
            恢復編輯
          </button>
        </div>
      ) : null}
      {!step3CompletedByMe && isInputEnabled && canReplyToQuestion && !isSendingMessage ? (
        <form onSubmit={onSendMessage}>
          <label>你的回答</label>
          <textarea value={text} onChange={(e) => onTextChange(e.target.value)} onPaste={(e) => e.preventDefault()} />
          <button type="submit" className="full-width" style={{ marginTop: 10 }}>發送訊息</button>
        </form>
      ) : null}
    </div>
  );
}

export default memo(Step3InteractionCard);
