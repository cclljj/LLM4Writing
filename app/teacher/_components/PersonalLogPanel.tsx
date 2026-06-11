"use client";

import { memo, Ref } from "react";
import OutlineSvg from "@/app/_components/OutlineSvg";
import { renderMessageHtml } from "@/app/student/_components/renderMessageHtml";
import { stepNameMap } from "@/src/lib/step-names";
import { getPersonalScopedMessagesForStudentHistory, getStepsFromMessages, MonitorMessage } from "./monitor-log-utils";

function PersonalLogPanel({
  panelRef,
  contextLabel,
  expanded,
  onToggleExpanded,
  selectedProgressUser,
  options,
  onSelectStudent,
  personalMessages,
  userOutline,
  userStep3SubmittedOutline,
  stepExpanded,
  onToggleStep
}: {
  panelRef: Ref<HTMLDivElement>;
  contextLabel: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  selectedProgressUser: string;
  options: Array<{ username: string; label: string; sessionId: string }>;
  onSelectStudent: (username: string) => void;
  personalMessages: MonitorMessage[];
  userOutline: string;
  userStep3SubmittedOutline: string;
  stepExpanded: Record<number, boolean>;
  onToggleStep: (step: number) => void;
}) {
  return (
    <div className="card" ref={panelRef}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: expanded ? 12 : 0 }}>
        <h2 style={{ margin: 0 }}>
          個人對話紀錄
          {contextLabel ? <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 400, marginLeft: 8 }}>— {contextLabel}</span> : null}
        </h2>
        <button
          style={{ width: "3em", padding: "4px 0", fontSize: 13, color: "var(--text-strong)", cursor: "pointer", borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface-alt)", textAlign: "center" }}
          onClick={onToggleExpanded}
        >
          {expanded ? "關閉" : "展開"}
        </button>
      </div>
      {expanded ? (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>選擇學生</label>
          <select value={selectedProgressUser} onChange={(e) => onSelectStudent(e.target.value)}>
            <option value="">請選擇學生...</option>
            {options.map((opt) => (
              <option key={opt.username} value={opt.username}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {expanded && personalMessages.length > 0 ? (() => {
        const scopedPersonalMessages = selectedProgressUser
          ? getPersonalScopedMessagesForStudentHistory(personalMessages, selectedProgressUser)
          : personalMessages;
        const personalSteps = getStepsFromMessages(scopedPersonalMessages);
        const hasStep4Revised = Boolean(userOutline && userOutline !== userStep3SubmittedOutline);

        const step3Block = userStep3SubmittedOutline ? (
          <div style={{ borderTop: "2px solid var(--line)", padding: "12px 0", marginTop: 4 }}>
            <strong style={{ fontSize: 13, color: "var(--muted-strong)" }}>步驟三完成結構樹</strong>
            <OutlineSvg mermaidText={userStep3SubmittedOutline} label="步驟三完成結構樹" />
          </div>
        ) : null;

        const step4Block = hasStep4Revised ? (
          <div style={{ borderTop: "2px solid var(--line)", padding: "12px 0", marginTop: 4 }}>
            <strong style={{ fontSize: 13, color: "var(--muted-strong)" }}>步驟四對比修正後結構樹</strong>
            <OutlineSvg mermaidText={userOutline} label="步驟四對比修正後" />
          </div>
        ) : null;

        return (
          <>
            {personalSteps.map((step) => {
              const stepMsgs = scopedPersonalMessages.filter((m) => m.step === step);
              // Per-step cards default to closed (#245).
              const isExpanded = stepExpanded[step] ?? false;
              return (
                <div key={step} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0 }}>
                      Step {step} {stepNameMap[step] ? `- ${stepNameMap[step]}` : ""}
                    </h3>
                    <button
                      type="button"
                      className="secondary"
                      aria-expanded={isExpanded}
                      onClick={() => onToggleStep(step)}
                      style={{ width: "fit-content", padding: "3px 6px", whiteSpace: "nowrap" }}
                    >
                      {isExpanded ? "▾ 閉合" : "▸ 展開"}
                    </button>
                  </div>
                  {isExpanded ? (
                    <>
                      <hr style={{ border: 0, borderTop: "1px solid var(--line-soft)", margin: "10px 0" }} />
                      {stepMsgs.map((message) => (
                        <div key={message.id} style={{ borderTop: "1px solid var(--line-soft)", padding: "8px 0" }}>
                          <strong>
                            {message.role === "student"
                              ? "你"
                              : message.role === "ai"
                                ? "AI 回覆"
                                : message.role === "system"
                                  ? "系統訊息"
                                  : message.role}
                          </strong>
                          <div dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }} />
                          <small>{message.at}</small>
                        </div>
                      ))}
                      {step === 3 && step3Block}
                      {step === 4 && step4Block}
                    </>
                  ) : null}
                </div>
              );
            })}
          </>
        );
      })() : expanded && selectedProgressUser ? (
        <small style={{ color: "var(--muted)" }}>正在載入該學生的對話紀錄…</small>
      ) : expanded ? (
        <small style={{ color: "var(--muted)" }}>請從上方下拉選單選擇要查看的學生。</small>
      ) : null}
    </div>
  );
}

export default memo(PersonalLogPanel);
