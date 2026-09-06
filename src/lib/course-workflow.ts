import { CourseWorkflowStep, InteractionMode, WorkflowCapability } from "@/src/lib/types";

export const LEGACY_COURSE_WORKFLOW_STEPS: CourseWorkflowStep[] = [
  { step: 1, name: "審視題目", mode: "group_interaction", capability: "topic_discussion" },
  { step: 2, name: "蒐集資料", mode: "group_interaction", capability: "research_discussion" },
  { step: 3, name: "生成論點", mode: "personal_interaction", capability: "outline" },
  { step: 4, name: "對比修正", mode: "group_interaction", capability: "peer_outline" },
  { step: 5, name: "摘要報告", mode: "non_interactive", capability: "summary_report" },
  { step: 6, name: "撰寫初稿", mode: "personal_interaction", capability: "draft" },
  { step: 7, name: "分析回饋", mode: "non_interactive", capability: "feedback_report" },
  { step: 8, name: "修改潤飾", mode: "personal_interaction", capability: "revision" },
  { step: 9, name: "個人反思", mode: "personal_reflection", capability: "reflection" },
  { step: 10, name: "總結報告", mode: "non_interactive", capability: "final_report" }
];

const validModes = new Set<InteractionMode>(["group_interaction", "personal_interaction", "non_interactive", "personal_reflection"]);
const validCapabilities = new Set<WorkflowCapability>([
  "topic_discussion",
  "research_discussion",
  "outline",
  "peer_outline",
  "summary_report",
  "draft",
  "feedback_report",
  "revision",
  "reflection",
  "final_report",
  "group_interaction",
  "personal_interaction"
]);

export function normalizeCourseWorkflowSteps(input: unknown): CourseWorkflowStep[] {
  if (!Array.isArray(input)) return LEGACY_COURSE_WORKFLOW_STEPS.map((step) => ({ ...step }));
  const seen = new Set<number>();
  const steps = input.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const raw = value as Partial<CourseWorkflowStep>;
    if (typeof raw.step !== "number" || !Number.isInteger(raw.step) || raw.step <= 0 || seen.has(raw.step) || !raw.name?.trim() || !raw.capability || !validCapabilities.has(raw.capability) || !raw.mode || !validModes.has(raw.mode)) return [];
    seen.add(raw.step);
    return [{ step: raw.step, name: raw.name.trim(), mode: raw.mode, capability: raw.capability, ...(raw.exportTitle?.trim() ? { exportTitle: raw.exportTitle.trim() } : {}) }];
  });
  return steps.length > 0 ? steps : LEGACY_COURSE_WORKFLOW_STEPS.map((step) => ({ ...step }));
}

type WorkflowSnapshotOwner = { workflowSteps?: CourseWorkflowStep[] };

export function getSessionWorkflowSteps(session: WorkflowSnapshotOwner): CourseWorkflowStep[] {
  return normalizeCourseWorkflowSteps(session.workflowSteps);
}

export function getWorkflowStep(session: WorkflowSnapshotOwner, step: number): CourseWorkflowStep | undefined {
  return getSessionWorkflowSteps(session).find((item) => item.step === step);
}

export function getWorkflowStepName(session: WorkflowSnapshotOwner, step: number): string {
  return getWorkflowStep(session, step)?.name ?? "未知步驟";
}

export function getWorkflowStepMode(session: WorkflowSnapshotOwner, step: number): InteractionMode {
  return getWorkflowStep(session, step)?.mode ?? "personal_interaction";
}

export function getWorkflowStepByCapability(session: WorkflowSnapshotOwner, capability: WorkflowCapability): CourseWorkflowStep | undefined {
  return getSessionWorkflowSteps(session).find((item) => item.capability === capability);
}

export function getNextWorkflowStep(session: WorkflowSnapshotOwner, step: number): CourseWorkflowStep | undefined {
  const steps = getSessionWorkflowSteps(session);
  const index = steps.findIndex((item) => item.step === step);
  return index >= 0 ? steps[index + 1] : undefined;
}

export function getWorkflowStepOrderIndex(session: WorkflowSnapshotOwner, step: number): number {
  const steps = getSessionWorkflowSteps(session);
  const index = steps.findIndex((item) => item.step === step);
  return index >= 0 ? index : Math.max(0, step - 1);
}

export function isWorkflowStepAtOrAfter(session: WorkflowSnapshotOwner, currentStep: number, targetStep: number): boolean {
  return getWorkflowStepOrderIndex(session, currentStep) >= getWorkflowStepOrderIndex(session, targetStep);
}

export function getFirstWorkflowStep(session: WorkflowSnapshotOwner): CourseWorkflowStep | undefined {
  return getSessionWorkflowSteps(session)[0];
}

export function getWorkflowCapability(session: WorkflowSnapshotOwner, step: number): WorkflowCapability | undefined {
  return getWorkflowStep(session, step)?.capability;
}

export function getWorkflowPromptStepKey(session: WorkflowSnapshotOwner, step: number): string {
  const capability = getWorkflowCapability(session, step);
  switch (capability) {
    case "topic_discussion":
      return "1";
    case "research_discussion":
      return "2";
    case "outline":
      return "3";
    case "peer_outline":
      return "4";
    case "summary_report":
      return "5";
    case "draft":
      return "6";
    case "feedback_report":
      return "7";
    case "revision":
      return "8";
    case "reflection":
      return "9";
    case "final_report":
      return "10";
    default:
      return String(step);
  }
}

export function getGuidedDiscussionPromptStep(capability: WorkflowCapability | undefined): 1 | 2 | undefined {
  if (capability === "topic_discussion") return 1;
  if (capability === "research_discussion") return 2;
  return undefined;
}

export function getStepsBeforeCapability(session: WorkflowSnapshotOwner, capability: WorkflowCapability): number[] {
  const steps = getSessionWorkflowSteps(session);
  const index = steps.findIndex((item) => item.capability === capability);
  return index > 0 ? steps.slice(0, index).map((item) => item.step) : [];
}
