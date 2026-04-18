export type InteractionMode =
  | "group_interaction"
  | "personal_interaction"
  | "non_interactive"
  | "personal_reflection";

export type Role = "student" | "teacher" | "system" | "ai";

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
}

export interface StartSessionPayload {
  participants: string[];
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
