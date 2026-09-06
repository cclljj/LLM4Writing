import { GuidedDiscussionSubsteps, SessionState } from "./types";

export type GuidedDiscussionStep = 1 | 2;

const LEGACY_SUBSTEPS: GuidedDiscussionSubsteps = {
  topic_discussion: ["1-1", "1-2", "1-3-1", "1-3-2", "1-3-3", "1-4-1", "1-4-2", "1-4-3", "1-5"],
  research_discussion: ["2-1-1", "2-1-2", "2-1-3", "2-2", "2-3", "2-4"]
};

const capabilityForStep = (step: GuidedDiscussionStep) => step === 1 ? "topic_discussion" : "research_discussion";
const keyPatternForStep = (step: GuidedDiscussionStep) => new RegExp(`^${step}-\\d+(?:-\\d+)?$`);

export function normalizeGuidedDiscussionSubsteps(input: unknown): GuidedDiscussionSubsteps {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const raw = input as Record<string, unknown>;
  return (["topic_discussion", "research_discussion"] as const).reduce<GuidedDiscussionSubsteps>((result, capability) => {
    const step = capability === "topic_discussion" ? 1 : 2;
    const values = raw[capability];
    if (!Array.isArray(values)) return result;
    const seen = new Set<string>();
    const keys = values.flatMap((value) => {
      if (typeof value !== "string") return [];
      const key = value.trim();
      if (!keyPatternForStep(step).test(key) || seen.has(key)) return [];
      seen.add(key);
      return [key];
    });
    if (keys.length > 0) result[capability] = keys;
    return result;
  }, {});
}

export function cloneGuidedDiscussionSubsteps(input: GuidedDiscussionSubsteps): GuidedDiscussionSubsteps {
  return Object.fromEntries(
    Object.entries(input).map(([capability, keys]) => [capability, [...keys]])
  ) as GuidedDiscussionSubsteps;
}

/** Sessions without this snapshot predate configurable child workflows and retain the original sequence. */
export function getGuidedDiscussionSubsteps(session: Pick<SessionState, "guidedDiscussionSubsteps">, step: GuidedDiscussionStep): string[] {
  const configured = session.guidedDiscussionSubsteps?.[capabilityForStep(step)];
  return configured?.length ? configured : LEGACY_SUBSTEPS[capabilityForStep(step)]!;
}

export function usesConfiguredGuidedDiscussionSubsteps(session: Pick<SessionState, "guidedDiscussionSubsteps">): boolean {
  return Boolean(session.guidedDiscussionSubsteps?.topic_discussion?.length || session.guidedDiscussionSubsteps?.research_discussion?.length);
}

export function getConfiguredSubstepIndex(session: SessionState, step: GuidedDiscussionStep): number {
  const keys = getGuidedDiscussionSubsteps(session, step);
  const index = session.stepState.guidedDiscussionSubstepIndex ?? 0;
  return index >= 0 && index < keys.length ? index : 0;
}
