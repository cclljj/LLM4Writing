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
  questionBanks: Record<string, string[]>;
}

export interface ChatMessage {
  id: string;
  role: Role;
  userId?: string;
  text: string;
  at: string;
  step: number;
}

export interface SessionState {
  id: string;
  createdAt: string;
  currentStep: number;
  participants: string[];
  messages: ChatMessage[];
  groupGate: Record<string, string[]>;
  reflectionIndex: Record<string, number>;
  workflow: SessionWorkflow;
  phaseMax: number;
  activityId?: string;
  activityTitle?: string;
  groupId?: string;
  groupName?: string;
  promptConfig: PromptConfig;
  stepState: {
    step1Substep: number;
    step2Substep: number;
  };
  outlines: Record<string, string>;
  draftStep6: Record<string, string>;
  draftStep8: Record<string, string>;
  reports: {
    step5?: string;
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
