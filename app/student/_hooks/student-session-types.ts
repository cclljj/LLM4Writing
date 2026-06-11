// Shared UI-level session types for the student page and its hooks (#459).

export type Course = {
  id: string;
  classNumber: string;
  title: string;
  genre: string;
  essayDescription?: string;
  durationMinutes: number;
  supplemental: string;
  groupStatus?: string;
  courseStatus?: "not_started" | "in_progress" | "paused" | "ended";
};

export type ParticipatedCourse = {
  activityId: string;
  title: string;
  classNumber: string;
  lastSessionId: string;
  lastStep: number;
  lastParticipatedAt: string;
  sessionCount: number;
};

export type SessionState = {
  id: string;
  currentStep: number;
  personalSteps?: Record<string, number>;
  activityId?: string;
  activityTitle?: string;
  groupName?: string;
  workflow: string;
  participants: string[];
  participantDisplayNames?: Record<string, string>;
  attendanceOverrides?: {
    waitingExcludedUsernames: string[];
    updatedAt?: string;
    updatedBy?: string;
    events?: Array<{ username: string; excluded: boolean; step: number; substepKey?: string; at: string; by: string }>;
  };
  makeupWork?: {
    outlineRequiredUsernames: string[];
    outlineCompletedUsernames: string[];
    outlineCompletedAt?: Record<string, string>;
    outlineReasons?: Record<string, Array<"absent_step3" | "absent_step4" | "teacher_assigned">>;
    outlineEvents?: Array<{ username: string; reason: "absent_step3" | "absent_step4" | "teacher_assigned"; stepContext: number; createdAt: string; text: string }>;
  };
  groupGate?: Record<string, string[]>;
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
  reports: { step5: Record<string, string>; step7: Record<string, string>; step10: Record<string, string> };
  promptConfig?: {
    questionBanks?: Record<string, string[]>;
    stepOpenings?: Record<string, string>;
    step9Questions?: Record<string, string>;
  };
  messages: Array<{
    id: string;
    role: string;
    userId?: string;
    text: string;
    at: string;
    step: number;
  }>;
};

export type StudentSessionPayload = Omit<SessionState, "messages"> & {
  messages?: SessionState["messages"];
  pollSummary?: boolean;
  messageCount?: number;
  lastMessageAt?: string | null;
};
