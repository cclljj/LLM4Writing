import { CourseWorkflowStep } from "@/src/lib/types";

type ProgressStatus = "completed" | "current" | "upcoming";

function getStatusLabel(status: ProgressStatus): string {
  if (status === "completed") return "已完成";
  if (status === "current") return "進行中";
  return "待開始";
}

export default function StudentProgressRail({ currentStep, workflowSteps }: { currentStep: number; workflowSteps: CourseWorkflowStep[] }) {
  const currentIndex = workflowSteps.findIndex((item) => item.step === currentStep);
  const progressItems: Array<{ step: number; name: string; status: ProgressStatus }> = workflowSteps.map((item, index) => ({
    step: item.step,
    name: item.name,
    status: index < currentIndex ? "completed" : item.step === currentStep ? "current" : "upcoming"
  }));
  const current = workflowSteps.find((item) => item.step === currentStep);
  const firstStep = workflowSteps[0]?.step ?? 1;
  const lastStep = workflowSteps[workflowSteps.length - 1]?.step ?? currentStep;

  return (
    <div className="card">
      <h2>學習進度</h2>
      <div className="step-rail" aria-label={`Step ${firstStep} 到 Step ${lastStep} 學習進度`}>
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
        目前你在 Step {currentStep}「{current?.name ?? "未知步驟"}」。
      </small>
    </div>
  );
}
