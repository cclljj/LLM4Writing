"use client";

import { memo } from "react";

function Step5ReportCard({
  currentStep,
  step5Report,
  draftStep6,
  step7Report
}: {
  currentStep: 5 | 7;
  step5Report?: string;
  draftStep6?: string;
  step7Report?: string;
}) {
  if (currentStep === 5) {
    return (
      <div className="card">
        <h2>摘要報告</h2>
        <pre>{step5Report || "系統尚未產生摘要。"}</pre>
        <small>摘要顯示後將自動進入步驟 6。</small>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>分析回饋</h2>
      <h3>步驟 6 作文內容</h3>
      <pre>{draftStep6 ?? "尚未提交初稿。"}</pre>
      <h3 style={{ marginTop: 12 }}>AI 分析回饋</h3>
      <pre>{step7Report ?? "系統尚未產生分析。"}</pre>
    </div>
  );
}

export default memo(Step5ReportCard);
