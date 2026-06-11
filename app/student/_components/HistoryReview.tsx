"use client";

import { memo, useEffect, useState } from "react";
import OutlineSvg from "@/app/_components/OutlineSvg";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import { renderMessageHtml } from "./renderMessageHtml";

type InteractiveItem = {
  id: string;
  kind: "question" | "student" | "ai";
  text: string;
  at: string;
  userId?: string;
};

type StepReview = {
  step: number;
  title: string;
  messages: InteractiveItem[];
};

type HistoryReviewProps = {
  steps: StepReview[];
  step3SubmittedOutlineMermaid?: string;
  step4OutlineMermaid?: string;
};

function HistoryReview({
  steps,
  step3SubmittedOutlineMermaid,
  step4OutlineMermaid,
}: HistoryReviewProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (steps.length === 0) {
      deferStateUpdate(() => setExpanded({}));
      return;
    }
    deferStateUpdate(() => {
      setExpanded((prev) => {
        const next: Record<number, boolean> = {};
        steps.forEach((review) => {
          next[review.step] = prev[review.step] ?? false;
        });
        return next;
      });
    });
  }, [steps]);

  if (steps.length === 0) return null;

  return (
    <>
      <div className="card">
        <h2>前序步驟回顧</h2>
        <small>以下僅顯示你在先前步驟與 AI 的互動紀錄。</small>
      </div>
      {steps.map((review) => (
        <div key={`review-step-wrap-${review.step}`}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0 }}>
                Step {review.step} - {review.title}
              </h2>
              <button
                type="button"
                className="secondary"
                aria-expanded={expanded[review.step] ?? false}
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [review.step]: !(prev[review.step] ?? false) }))
                }
                style={{
                  fontSize: 12,
                  lineHeight: 1.1,
                  padding: "3px 6px",
                  minHeight: "unset",
                  width: "fit-content",
                  whiteSpace: "nowrap",
                  flex: "0 0 auto"
                }}
              >
                {expanded[review.step] ? "▾ 閉合" : "▸ 展開"}
              </button>
            </div>
            {expanded[review.step] ? (
              <>
                <p>
                  <small>此為歷史步驟回顧（僅本人與 AI 互動）。</small>
                </p>
                <hr style={{ border: 0, borderTop: "1px solid var(--line-soft)", margin: "10px 0" }} />
                <h3 style={{ margin: "0 0 8px" }}>互動內容</h3>
                {review.messages.length > 0 ? (
                  review.messages.map((message) => (
                    <div key={`review-msg-${message.id}`} style={{ borderTop: "1px solid var(--line-soft)", padding: "8px 0" }}>
                      <strong>{message.kind === "student" ? "你" : "AI 回覆"}</strong>
                      <div
                        style={{ marginTop: 4 }}
                        dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }}
                      />
                      <small>{message.at}</small>
                    </div>
                  ))
                ) : (
                  <small>此步驟目前沒有可顯示的個人互動紀錄。</small>
                )}
                {review.step === 3 && step3SubmittedOutlineMermaid ? (
                  <div style={{ marginTop: 14, borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
                    <strong>步驟三完成時繳交的結構樹</strong>
                    <OutlineSvg compact mermaidText={step3SubmittedOutlineMermaid} />
                  </div>
                ) : null}
                {review.step === 4 && step4OutlineMermaid ? (
                  <div style={{ marginTop: 14, borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
                    <strong>步驟四修正後結構樹</strong>
                    <OutlineSvg compact mermaidText={step4OutlineMermaid} />
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ))}
    </>
  );
}

export default memo(HistoryReview);
