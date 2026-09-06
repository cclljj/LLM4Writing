import { Activity, CourseWorkflowStep, PromptConfig, Step10ReportConfig } from "@/src/lib/types";
import {
  resolveCourseWorkflowStepsFromConfig,
  resolveDefaultCourseWorkflowStepsFromConfig,
  resolveCourseGuidedDiscussionSubstepsFromConfig
} from "@/src/lib/course-workflow";
import { DEFAULT_ACADEMIC_TERM_CONFIG_KEY } from "@/src/lib/academic-term-defaults";
import courseStepConfigs from "@/src/config/course-step-configs.json";
import { findActivity } from "@/src/lib/activity-store";

type RawSystemPromptConfig = {
  systemPrompt?: string;
  stepPrompts?: Record<string, string>;
  step12FeedbackPrompts?: Record<string, string>;
  step12FeedbackFocusPrompts?: Record<string, string>;
  subStepPrompts?: Record<string, string>;
  subStepPrompts_fallbacks?: Record<string, string>;
  questionBanks?: Record<string, string[]>;
  step9Questions?: Record<string, string>;
  step10Report?: Step10ReportConfig;
  writingTasks?: Record<string, { questionBanks?: Record<string, string[]> }>;
};

type CourseStepConfig = {
  extends?: string;
  promptConfig?: RawSystemPromptConfig;
  stepOpenings?: Record<string, string>;
};

type CourseStepConfigRegistry = {
  default?: string;
  terms?: Record<string, CourseStepConfig>;
};

const courseStepConfigRegistry = courseStepConfigs as CourseStepConfigRegistry;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Arrays replace their parent value; records merge so a term only needs to list its changes. */
function mergeConfig<T>(base: T, override: T): T {
  if (!isPlainObject(base) || !isPlainObject(override)) return override ?? base;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = isPlainObject(value) && isPlainObject(merged[key])
      ? mergeConfig(merged[key], value)
      : value;
  }
  return merged as T;
}

export function getCourseStepConfigKey(academicYear: string, academicYearTerm: string): string {
  return `${academicYear.trim()}-${academicYearTerm.trim()}`;
}

/**
 * Resolves a term config without mutating its source. Unknown terms
 * deliberately fall back to the registry default so a newly created course remains usable.
 */
export function resolveCourseStepConfig(academicYear: string, academicYearTerm: string): CourseStepConfig {
  const requestedKey = getCourseStepConfigKey(academicYear, academicYearTerm);
  const terms = courseStepConfigRegistry.terms ?? {};
  const defaultKey = courseStepConfigRegistry.default ?? DEFAULT_ACADEMIC_TERM_CONFIG_KEY;
  const resolving = new Set<string>();

  const resolve = (key: string): CourseStepConfig => {
    const entry = terms[key];
    if (!entry || resolving.has(key)) return {};
    resolving.add(key);
    const parent = entry.extends ? resolve(entry.extends) : {};
    resolving.delete(key);
    return mergeConfig(parent, entry);
  };

  return resolve(terms[requestedKey] ? requestedKey : defaultKey);
}

export function resolvePromptConfigForActivity(activityId: string): PromptConfig {
  const activity = findActivity(activityId);
  if (!activity) {
    return {
      systemPrompt: undefined,
      stepPrompts: {},
      step12FeedbackPrompts: {},
      step12FeedbackFocusPrompts: {},
      subStepPrompts: {},
      subStepPromptsFallbacks: {},
      questionBanks: {},
      step9Questions: {},
      step10Report: undefined
    };
  }

  const courseConfig = resolveCourseStepConfig(activity.academicYear, activity.academicYearTerm);
  const raw = courseConfig.promptConfig ?? {};
  const systemPrompt = typeof raw.systemPrompt === "string" ? raw.systemPrompt : undefined;
  const stepPrompts = { ...(raw.stepPrompts ?? {}) };
  const step12FeedbackPrompts = { ...(raw.step12FeedbackPrompts ?? {}) };
  const step12FeedbackFocusPrompts = { ...(raw.step12FeedbackFocusPrompts ?? {}) };
  const subStepPrompts = { ...(raw.subStepPrompts ?? {}) };
  const subStepPromptsFallbacks = { ...(raw.subStepPrompts_fallbacks ?? {}) };
  const baseQuestionBanks = Object.fromEntries(
    Object.entries(raw.questionBanks ?? {}).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
    ])
  ) as Record<string, string[]>;
  const step9Questions = Object.fromEntries(
    Object.entries(raw.step9Questions ?? {})
      .filter(([key, value]) => ["1", "2", "3", "4"].includes(key) && typeof value === "string")
      .map(([key, value]) => [key, value])
  ) as Record<string, string>;
  const step10Report = raw.step10Report && Array.isArray(raw.step10Report.sections)
    ? raw.step10Report
    : undefined;

  const taskBanks = raw.writingTasks ?? {};
  const matchedTask =
    taskBanks[activity.essayId] ??
    taskBanks[activity.title] ??
    Object.entries(taskBanks).find(([key]) => key.trim() === activity.title.trim())?.[1];
  const scopedQuestionBanks = Object.fromEntries(
    Object.entries(matchedTask?.questionBanks ?? {}).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
    ])
  ) as Record<string, string[]>;

  return {
    systemPrompt,
    stepPrompts,
    step12FeedbackPrompts,
    step12FeedbackFocusPrompts,
    subStepPrompts,
    subStepPromptsFallbacks,
    questionBanks: { ...baseQuestionBanks, ...scopedQuestionBanks },
    step9Questions,
    step10Report,
    stepOpenings: courseConfig.stepOpenings ?? {}
  };
}

export function resolveCourseWorkflowForActivity(activityId: string): CourseWorkflowStep[] {
  const activity = findActivity(activityId);
  if (!activity) return resolveDefaultCourseWorkflowStepsFromConfig();
  return resolveCourseWorkflowStepsFromConfig(activity.academicYear, activity.academicYearTerm);
}

/** Registry default for diagnostics that are not tied to a particular course activity. */
export function resolveDefaultCourseWorkflowSteps(): CourseWorkflowStep[] {
  return resolveDefaultCourseWorkflowStepsFromConfig();
}

/** Fetches activity and its prompt config in one call — avoids the caller having
 *  to remember to invoke both findActivity and resolvePromptConfigForActivity. */
export function loadActivityWithConfig(
  activityId: string
): { activity: Activity; promptConfig: PromptConfig; workflowSteps: CourseWorkflowStep[]; guidedDiscussionSubsteps: import("@/src/lib/types").GuidedDiscussionSubsteps } | undefined {
  const activity = findActivity(activityId);
  if (!activity) return undefined;
  return {
    activity,
    promptConfig: resolvePromptConfigForActivity(activityId),
    workflowSteps: resolveCourseWorkflowForActivity(activityId),
    guidedDiscussionSubsteps: resolveCourseGuidedDiscussionSubstepsFromConfig(activity.academicYear, activity.academicYearTerm)
  };
}
