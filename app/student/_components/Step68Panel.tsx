"use client";

import OutlineSvg from "@/app/_components/OutlineSvg";

type Step68PanelProps = {
  currentStep: 6 | 8;
  participants: string[];
  outlines: Record<string, string>;
  draftText: string;
  onDraftChange: (value: string) => void;
  onSaveDraft: () => void;
  onSuggest?: () => void;
  onCompleteStep6?: () => void;
  onCompleteStep8?: () => void;
  isSuggestingStep6: boolean;
  isCompletingStep6: boolean;
  isCompletingStep8: boolean;
  unsavedChars: number;
  step6RefUser: string;
  onStep6RefUserChange: (user: string) => void;
};

export default function Step68Panel({
  currentStep,
  participants,
  outlines,
  draftText,
  onDraftChange,
  onSaveDraft,
  onSuggest,
  onCompleteStep6,
  onCompleteStep8,
  isSuggestingStep6,
  isCompletingStep6,
  isCompletingStep8,
  unsavedChars,
  step6RefUser,
  onStep6RefUserChange,
}: Step68PanelProps) {
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
      <textarea value={draftText} onChange={(e) => onDraftChange(e.target.value)} rows={10} style={{ minHeight: 220 }} />
      <div className="row" style={{ marginTop: 10, gap: 10 }}>
        <div style={{ width: 180 }}>
          <button type="button" onClick={onSaveDraft}>
            儲存文章
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
              AI 修改建議
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
      {currentStep === 6 && isSuggestingStep6 ? (
        <small style={{ display: "block", marginTop: 6, color: "#94a3b8" }}>
          AI 正在分析你的文章並產生修改建議，請稍候...
        </small>
      ) : null}
      {currentStep === 6 && isCompletingStep6 ? (
        <small style={{ display: "block", marginTop: 6, color: "#94a3b8" }}>
          AI 正在產生步驟 7 分析回饋，請稍候...
        </small>
      ) : null}
      <small style={{ display: "block", marginTop: 8, color: "#94a3b8" }}>
        未儲存字數：{unsavedChars}
      </small>
    </div>
  );
}
