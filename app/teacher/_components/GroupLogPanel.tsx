"use client";

import { memo, Ref } from "react";
import OutlineSvg from "@/app/_components/OutlineSvg";
import { renderMessageHtml } from "@/app/student/_components/renderMessageHtml";
import { stepNameMap } from "@/src/lib/step-names";
import { getStepsFromMessages } from "./monitor-log-utils";
import { MonitorSession } from "./types";

function GroupLogPanel({
  panelRef,
  contextLabel,
  expanded,
  onToggleExpanded,
  monitorSelected,
  options,
  onSelectSession,
  stepExpanded,
  onToggleStep
}: {
  panelRef: Ref<HTMLDivElement>;
  contextLabel: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  monitorSelected: MonitorSession | null;
  options: Array<{ sessionId: string; label: string; session: MonitorSession }>;
  onSelectSession: (sessionId: string) => void;
  stepExpanded: Record<number, boolean>;
  onToggleStep: (step: number) => void;
}) {
  return (
    <div className="card" ref={panelRef}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: expanded ? 12 : 0 }}>
        <h2 style={{ margin: 0 }}>
          小組對話紀錄
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
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>選擇小組</label>
          <select value={monitorSelected?.sessionId ?? ""} onChange={(e) => onSelectSession(e.target.value)}>
            <option value="">請選擇小組...</option>
            {options.map((opt) => (
              <option key={opt.sessionId} value={opt.sessionId}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {expanded && monitorSelected ? (() => {
        const allGroupMsgs = monitorSelected.messages;
        const groupSteps = getStepsFromMessages(allGroupMsgs);

        const hasStep3 = monitorSelected.participants.some((p) => monitorSelected.step3SubmittedOutlines?.[p]);
        const hasStep4Revised = monitorSelected.participants.some((p) => {
          const s = monitorSelected.step3SubmittedOutlines?.[p];
          const c = monitorSelected.outlines?.[p];
          return c && c !== s;
        });

        const step3Block = hasStep3 ? (
          <div style={{ borderTop: "2px solid var(--line)", padding: "12px 0", marginTop: 4 }}>
            <strong style={{ fontSize: 13, color: "var(--muted-strong)" }}>步驟三 各組員完成結構樹</strong>
            {monitorSelected.participants.map((p) => {
              const submitted = monitorSelected.step3SubmittedOutlines?.[p];
              if (!submitted) return null;
              return (
                <div key={p} style={{ marginTop: 8 }}>
                  <small style={{ fontWeight: 600 }}>{p}</small>
                  <OutlineSvg mermaidText={submitted} label="步驟三完成結構樹" />
                </div>
              );
            })}
          </div>
        ) : null;

        const step4Block = hasStep4Revised ? (
          <div style={{ borderTop: "2px solid var(--line)", padding: "12px 0", marginTop: 4 }}>
            <strong style={{ fontSize: 13, color: "var(--muted-strong)" }}>步驟四 各組員修正後結構樹</strong>
            {monitorSelected.participants.map((p) => {
              const s = monitorSelected.step3SubmittedOutlines?.[p];
              const c = monitorSelected.outlines?.[p];
              if (!c || c === s) return null;
              return (
                <div key={p} style={{ marginTop: 8 }}>
                  <small style={{ fontWeight: 600 }}>{p}</small>
                  <OutlineSvg mermaidText={c} label="步驟四對比修正後" />
                </div>
              );
            })}
          </div>
        ) : null;

        const anyMsgs = allGroupMsgs.length > 0;
        return (
          <>
            {groupSteps.map((step) => {
              const stepMsgs = allGroupMsgs.filter((m) => m.step === step);
              if (stepMsgs.length === 0) return null;
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
                              ? `學生${message.userId ? `（${message.userId}）` : ""}`
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
                      {step === 2 && step3Block}
                      {step === 4 && step4Block}
                    </>
                  ) : null}
                </div>
              );
            })}
            {!anyMsgs && <small>目前沒有可顯示的對話內容。</small>}
          </>
        );
      })() : expanded ? (
        <small style={{ color: "var(--muted)" }}>請從上方下拉選單選擇要查看的小組。</small>
      ) : null}
    </div>
  );
}

export default memo(GroupLogPanel);
