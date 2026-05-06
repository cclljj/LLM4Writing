const stepNameMap: Record<number, string> = {
  1: "審視題目",
  2: "蒐集資料",
  3: "生成論點",
  4: "對比修正",
  5: "摘要報告",
  6: "撰寫初稿",
  7: "分析回饋",
  8: "修改潤飾",
  9: "個人反思",
  10: "總結報告"
};

type ProgressStatus = "completed" | "current" | "upcoming";

function getStatusLabel(status: ProgressStatus): string {
  if (status === "completed") return "已完成";
  if (status === "current") return "進行中";
  return "待開始";
}

export default function StudentProgressRail({ currentStep }: { currentStep: number }) {
  const progressItems = Array.from({ length: 10 }, (_, idx) => {
    const step = idx + 1;
    const status: ProgressStatus = step < currentStep ? "completed" : step === currentStep ? "current" : "upcoming";
    return { step, name: stepNameMap[step] ?? `Step ${step}`, status };
  });

  return (
    <div className="card">
      <h2>學習進度</h2>
      <div className="step-rail" aria-label="Step1 到 Step10 學習進度">
        {progressItems.map((item) => (
          <div key={item.step} className={`step-rail-item ${item.status}`} aria-current={item.status === "current" ? "step" : undefined}>
            <span className="step-rail-number">{getStatusLabel(item.status)}</span>
            <span className="step-rail-name">
              Step {item.step}
              <br />
              {item.name}
            </span>
          </div>
        ))}
      </div>
      <small style={{ display: "block", marginTop: 8 }}>
        目前你在 Step {currentStep}「{stepNameMap[currentStep] ?? "未知步驟"}」。Step5 之後會依個人完成狀態自動推進。
      </small>
    </div>
  );
}
