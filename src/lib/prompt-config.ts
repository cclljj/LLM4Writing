import { Activity, PromptConfig } from "@/src/lib/types";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import systemPromptConfig from "@/src/config/system-prompt-config.json";
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
  writingTasks?: Record<string, { questionBanks?: Record<string, string[]> }>;
};

function loadStepOpeningTexts(): Record<string, string> {
  const steps = ["1", "2", "3", "4", "6", "8", "9"];
  const baseDir = path.join(process.cwd(), "src", "config", "step-opening");
  const result: Record<string, string> = {};
  steps.forEach((step) => {
    const filePath = path.join(baseDir, `${step}.md`);
    if (!existsSync(filePath)) return;
    try {
      result[step] = readFileSync(filePath, "utf8");
    } catch {
      // Ignore per-file read errors to avoid breaking prompt config generation.
    }
  });
  return result;
}

const stepOpeningTexts = loadStepOpeningTexts();

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
      step9Questions: {}
    };
  }

  const raw = systemPromptConfig as RawSystemPromptConfig;
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
    stepOpenings: stepOpeningTexts
  };
}

/** Fetches activity and its prompt config in one call — avoids the caller having
 *  to remember to invoke both findActivity and resolvePromptConfigForActivity. */
export function loadActivityWithConfig(
  activityId: string
): { activity: Activity; promptConfig: PromptConfig } | undefined {
  const activity = findActivity(activityId);
  if (!activity) return undefined;
  return { activity, promptConfig: resolvePromptConfigForActivity(activityId) };
}
