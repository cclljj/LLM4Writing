import { CourseWorkflowStep, InteractionMode, WorkflowCapability } from "@/src/lib/types";
import courseWorkflowConfigs from "@/src/config/course-workflow-configs.json";

type CourseWorkflowConfigRegistry = {
  default?: string;
  terms?: Record<string, { extends?: string; workflowSteps?: unknown }>;
};

const courseWorkflowConfigRegistry = courseWorkflowConfigs as CourseWorkflowConfigRegistry;

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

function normalizeWorkflowStepsOnly(input: unknown): CourseWorkflowStep[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<number>();
  const steps = input.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const raw = value as Partial<CourseWorkflowStep>;
    if (typeof raw.step !== "number" || !Number.isInteger(raw.step) || raw.step <= 0 || seen.has(raw.step) || !raw.name?.trim() || !raw.capability || !validCapabilities.has(raw.capability) || !raw.mode || !validModes.has(raw.mode)) return [];
    seen.add(raw.step);
    return [{ step: raw.step, name: raw.name.trim(), mode: raw.mode, capability: raw.capability, ...(raw.exportTitle?.trim() ? { exportTitle: raw.exportTitle.trim() } : {}) }];
  });
  return steps;
}

function resolveConfigWorkflowSteps(key: string | undefined, resolving = new Set<string>()): CourseWorkflowStep[] {
  if (!key || resolving.has(key)) return [];
  const entry = courseWorkflowConfigRegistry.terms?.[key];
  if (!entry) return [];
  resolving.add(key);
  const parentSteps = entry.extends ? resolveConfigWorkflowSteps(entry.extends, resolving) : [];
  resolving.delete(key);
  const ownSteps = normalizeWorkflowStepsOnly(entry.workflowSteps);
  return ownSteps.length > 0 ? ownSteps : parentSteps;
}

export function resolveDefaultCourseWorkflowStepsFromConfig(): CourseWorkflowStep[] {
  return resolveConfigWorkflowSteps(courseWorkflowConfigRegistry.default).map((step) => ({ ...step }));
}

export function resolveCourseWorkflowStepsFromConfig(academicYear: string, academicYearTerm: string): CourseWorkflowStep[] {
  const requestedKey = `${academicYear.trim()}-${academicYearTerm.trim()}`;
  const terms = courseWorkflowConfigRegistry.terms ?? {};
  const steps = resolveConfigWorkflowSteps(terms[requestedKey] ? requestedKey : courseWorkflowConfigRegistry.default);
  return steps.length > 0 ? steps.map((step) => ({ ...step })) : resolveDefaultCourseWorkflowStepsFromConfig();
}

export function normalizeCourseWorkflowSteps(input: unknown): CourseWorkflowStep[] {
  const normalized = normalizeWorkflowStepsOnly(input);
  return normalized.length > 0 ? normalized : resolveDefaultCourseWorkflowStepsFromConfig();
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

export function getReachedWorkflowCapabilities(session: WorkflowSnapshotOwner, currentStep: number): Set<WorkflowCapability> {
  const reached = new Set<WorkflowCapability>();
  if (!Number.isFinite(currentStep) || currentStep <= 0) return reached;
  const steps = getSessionWorkflowSteps(session);
  const index = steps.findIndex((item) => item.step === currentStep);
  if (index < 0) return reached;
  steps.slice(0, index + 1).forEach((item) => reached.add(item.capability));
  return reached;
}

export function pickLaterWorkflowStep(session: WorkflowSnapshotOwner, a: number, b: number): number {
  if (!Number.isFinite(a) || a <= 0) return b;
  if (!Number.isFinite(b) || b <= 0) return a;
  return getWorkflowStepOrderIndex(session, b) > getWorkflowStepOrderIndex(session, a) ? b : a;
}

export function pickEarlierWorkflowStep(session: WorkflowSnapshotOwner, a: number, b: number): number {
  if (!Number.isFinite(a) || a <= 0) return b;
  if (!Number.isFinite(b) || b <= 0) return a;
  return getWorkflowStepOrderIndex(session, b) < getWorkflowStepOrderIndex(session, a) ? b : a;
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
