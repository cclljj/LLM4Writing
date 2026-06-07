"use client";

import { memo, useEffect, useState } from "react";
import OutlineSvg from "@/app/_components/OutlineSvg";
import { deferStateUpdate } from "@/src/lib/defer-state-update";

type Step68PanelProps = {
  currentStep: 6 | 8;
  participants: string[];
  outlines: Record<string, string>;
  draftText: string;
  onDraftChange: (value: string) => void;
  onSaveDraft: () => void;
  onSuggest?: () => void;
  onCompleteStep8?: () => void;
  isSuggestingStep6: boolean;
  isCompletingStep6: boolean;
  isCompletingStep8: boolean;
  unsavedChars: number;
  saveStatus: {
    state: "saved" | "dirty" | "saving" | "error";
    text: string;
  };
  step6RefUser: string;
  onStep6RefUserChange: (user: string) => void;
  step6StreamingText?: string;
  step7StreamingText?: string;
};

function Step68Panel({
  currentStep,
  participants,
  outlines,
  draftText,
  onDraftChange,
  onSaveDraft,
  onSuggest,
  onCompleteStep8,
  isSuggestingStep6,
  isCompletingStep6,
  isCompletingStep8,
  unsavedChars,
  saveStatus,
  step6RefUser,
  onStep6RefUserChange,
  step6StreamingText,
  step7StreamingText,
}: Step68PanelProps) {
  const [suggestingDots, setSuggestingDots] = useState<"..." | "......">("...");
  const [completingDots, setCompletingDots] = useState<"..." | "......">("...");

  useEffect(() => {
    if (!(currentStep === 6 && isSuggestingStep6)) {
      deferStateUpdate(() => setSuggestingDots("..."));
      return;
    }
    const timer = window.setInterval(() => {
      setSuggestingDots((prev) => (prev === "..." ? "......" : "..."));
    }, 600);
    return () => window.clearInterval(timer);
  }, [currentStep, isSuggestingStep6]);

  useEffect(() => {
    if (!(currentStep === 6 && isCompletingStep6)) {
      deferStateUpdate(() => setCompletingDots("..."));
      return;
    }
    const timer = window.setInterval(() => {
      setCompletingDots((prev) => (prev === "..." ? "......" : "..."));
    }, 600);
    return () => window.clearInterval(timer);
  }, [currentStep, isCompletingStep6]);

  return (
    <div className="card">
      <h2>{currentStep === 6 ? "撰寫初稿" : "修改潤飾"}</h2>
      {currentStep === 6 ? (
        <>
          <label style={{ marginTop: 10 }}>同組結構樹（唯讀）</label>
          <select value={step6RefUser} onChange={(e) => onStep6RefUserChange(e.target.value)}>
            {participants.map((user) => (
              <option key={user} value={user}>
                {user}
              </option>
            ))}
          </select>
          <OutlineSvg compact mermaidText={outlines[step6RefUser] ?? ""} />
        </>
      ) : null}
      {currentStep === 8 ? (
        <small style={{ display: "block", marginTop: 8 }}>已預載步驟 6 初稿內容，可直接修改後儲存。</small>
      ) : null}
      <textarea
        value={draftText}
        onChange={(e) => onDraftChange(e.target.value)}
        onPaste={currentStep === 6 || currentStep === 8 ? undefined : (e) => e.preventDefault()}
        rows={10}
        style={{ minHeight: 220 }}
      />
      <div className="row" style={{ marginTop: 10, gap: 10 }}>
        <div style={{ width: 180 }}>
          <button type="button" onClick={onSaveDraft} disabled={saveStatus.state === "saving"}>
            {saveStatus.state === "saving" ? "儲存中..." : "儲存文章"}
          </button>
        </div>
        {currentStep === 6 ? (
          <div style={{ width: 180 }}>
            <button
              type="button"
              className="secondary"
              onClick={onSuggest}
              disabled={isSuggestingStep6 || isCompletingStep6}
            >
              請 AI 給我修改建議
            </button>
          </div>
        ) : null}
        {currentStep === 8 ? (
          <div style={{ width: 180 }}>
            <button
              type="button"
              className="secondary"
              onClick={onCompleteStep8}
              disabled={isCompletingStep8}
            >
              完成潤飾步驟
            </button>
          </div>
        ) : null}
      </div>
      <small className={`draft-save-status ${saveStatus.state}`}>{saveStatus.text}</small>
      {currentStep === 6 && isSuggestingStep6 ? (
        <small style={{ display: "block", marginTop: 6, color: "#94a3b8" }}>
          AI 正在分析你的文章並產生修改建議，這個步驟會花比較多的時間，請稍候{suggestingDots}
        </small>
      ) : null}
      {currentStep === 6 && step6StreamingText ? (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            background: "#f8fafc",
            whiteSpace: "pre-wrap",
            fontSize: 14,
            lineHeight: 1.6
          }}
        >
          <small style={{ display: "block", marginBottom: 6, color: "#64748b", fontWeight: 600 }}>
            AI 修改建議（產生中{isSuggestingStep6 ? "…" : ""}）
          </small>
          {step6StreamingText}
        </div>
      ) : null}
      {currentStep === 6 && isCompletingStep6 ? (
        <small style={{ display: "block", marginTop: 6, color: "#94a3b8" }}>
          AI 正在產生步驟 7 分析回饋，這個步驟會花比較多的時間，請稍候{completingDots}
        </small>
      ) : null}
      {currentStep === 6 && step7StreamingText ? (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            background: "#f8fafc",
            whiteSpace: "pre-wrap",
            fontSize: 14,
            lineHeight: 1.6
          }}
        >
          <small style={{ display: "block", marginBottom: 6, color: "#64748b", fontWeight: 600 }}>
            步驟 7 分析回饋（產生中{isCompletingStep6 ? "…" : ""}）
          </small>
          {step7StreamingText}
        </div>
      ) : null}
      {unsavedChars > 0 ? <small style={{ display: "block", marginTop: 6, color: "#b45309" }}>未保存字數：{unsavedChars}</small> : null}
    </div>
  );
}

export default memo(Step68Panel);
