export type InteractionMode =
  | "group_interaction"
  | "personal_interaction"
  | "non_interactive"
  | "personal_reflection";

export type Role = "student" | "teacher" | "system" | "ai";

export type SessionWorkflow = "spec10" | "legacy_phase";

export interface StepDefinition {
  step: number;
  name: string;
  mode: InteractionMode;
}

export interface PromptConfig {
  /**
   * Optional global system prompt for the remote LLM (provider-agnostic).
   * Stored in filesystem JSON (src/config/system-prompt-config.json).
   */
  systemPrompt?: string;
  stepPrompts: Record<string, string>;
  subStepPrompts: Record<string, string>;
  subStepPromptsFallbacks?: Record<string, string>;
  questionBanks: Record<string, string[]>;
  step9Questions?: Record<string, string>;
  stepOpenings?: Record<string, string>;
}

export interface ChatMessage {
  id: string;
  role: Role;
  userId?: string;
  text: string;
  at: string;
  step: number;
}

export interface QualitySignals {
  rejectedAnswerCounts?: Record<string, number>;
  rejectedAnswerLastAt?: Record<string, string>;
}

export interface ArtifactSignals {
  outlineUpdatedAt?: Record<string, string>;
  draftStep6UpdatedAt?: Record<string, string>;
  draftStep8UpdatedAt?: Record<string, string>;
}

export interface SessionState {
  id: string;
  createdAt: string;
  currentStep: number;
  personalSteps?: Record<string, number>;
  participants: string[];
  joinedUsers?: string[];
  onlineUsersLastSeen?: Record<string, string>;
  messages: ChatMessage[];
  qualitySignals?: QualitySignals;
  artifactSignals?: ArtifactSignals;
  groupGate: Record<string, string[]>;
  reflectionIndex: Record<string, number>;
  workflow: SessionWorkflow;
  phaseMax: number;
  activityId?: string;
  activityTitle?: string;
  activityEssayDescription?: string;
  activitySupplemental?: string;
  groupId?: string;
  groupName?: string;
  promptConfig: PromptConfig;
  /**
   * Cache of assembled system prompt strings, keyed by `${step}` or `${step}:${substepKey}` (#243).
   * Safe to persist because `promptConfig` is fixed for a session's lifetime — if a session is
   * created with new config, the cache starts fresh.
   */
  systemPromptCache?: Record<string, string>;
  stepState: {
    step1Substep: number;
    step2Substep: number;
    step1Substep3Question?: number;
    step1Substep4Question?: number;
    step2Substep1Question?: number;
  };
  outlines: Record<string, string>;
  step3SubmittedOutlines?: Record<string, string>;
  draftStep6: Record<string, string>;
  draftStep8: Record<string, string>;
  reports: {
    step5: Record<string, string>;
    step7: Record<string, string>;
    step10: Record<string, string>;
  };
}

export interface StartSessionPayload {
  participants: string[];
  workflow?: SessionWorkflow;
  phaseMax?: number;
  activityId?: string;
  activityTitle?: string;
  activityEssayDescription?: string;
  activitySupplemental?: string;
  groupId?: string;
  groupName?: string;
  promptConfig?: PromptConfig;
}

export interface SendMessagePayload {
  sessionId: string;
  userId: string;
  text: string;
}

export interface SwitchStepPayload {
  sessionId: string;
  step: number;
}

export interface ActivityGroup {
  groupId: string;
  groupName: string;
  members: string[];
}

export interface Activity {
  id: string;
  school: string;
  classNumber: string;
  essayId: string;
  title: string;
  genre: string;
  essayDescription?: string;
  durationMinutes: number;
  supplemental: string;
  groups: ActivityGroup[];
  courseStatus?: "not_started" | "in_progress" | "paused" | "ended";
}

export interface UserAccount {
  username: string;
  name: string;
  school: string;
  role: "student" | "teacher" | "admin";
  ownerTeacherUsername?: string;
  classNumber?: string;
}
