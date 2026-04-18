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
  groupGate: Record<number, string[]>;
  reflectionIndex: Record<string, number>;
  workflow: SessionWorkflow;
  phaseMax: number;
  activityId?: string;
  activityTitle?: string;
}

export interface StartSessionPayload {
  participants: string[];
  workflow?: SessionWorkflow;
  phaseMax?: number;
  activityId?: string;
  activityTitle?: string;
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
  className: string;
  title: string;
  genre: string;
  durationMinutes: number;
  supplemental: string;
  groups: ActivityGroup[];
}

export interface UserAccount {
  username: string;
  name: string;
  school: string;
  role: "student" | "teacher";
}
