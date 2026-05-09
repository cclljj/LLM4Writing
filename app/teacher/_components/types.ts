import { ArtifactDiagnostics, QualitySignals } from "@/src/lib/learning-diagnostics";
import { ChatMessage } from "@/src/lib/types";

export type UserRow = { username: string; name: string; school: string; role: string; ownerTeacherUsername?: string; classNumber?: string };
export type EssayRow = {
  id: string;
  title: string;
  genre: string;
  description: string;
  enabled: boolean;
};
export type OpenClassRow = {
  id: string;
  school: string;
  classNumber: string;
  essayId: string;
  essayTitle: string;
  durationMinutes: number;
  supplemental: string;
  /** Bound teacher (executor) for this task (#254). */
  ownerTeacherUsername?: string;
  /** Whether any student has activity recorded in any session of this task (#254). */
  hasStudentActivity?: boolean;
};
export type ActivityGroup = { groupId: string; groupName: string; members: string[] };
export type ActivityRow = {
  id: string;
  school: string;
  classNumber: string;
  essayId: string;
  title: string;
  genre: string;
  durationMinutes: number;
  supplemental: string;
  groups: ActivityGroup[];
  studentCandidates?: string[];
  courseStatus?: "not_started" | "in_progress" | "paused" | "ended";
};

export type MonitorSession = {
  sessionId: string;
  activityId?: string;
  activityTitle?: string;
  school?: string;
  classNumber?: string;
  groupId?: string;
  groupName?: string;
  participants: string[];
  joinedUsers?: string[];
  onlineUsers?: string[];
  currentStep: number;
  personalSteps?: Record<string, number>;
  groupGate?: Record<string, string[]>;
  stepState?: {
    step1Substep: number;
    step2Substep: number;
    step1Substep3Question?: number;
    step1Substep4Question?: number;
    step2Substep1Question?: number;
  };
  reflectionIndex?: Record<string, number>;
  outlines?: Record<string, string>;
  step3SubmittedOutlines?: Record<string, string>;
  qualitySignals?: QualitySignals;
  artifactDiagnostics?: ArtifactDiagnostics;
  messages: ChatMessage[];
};

export type PersonalProgressRow = {
  username: string;
  currentStep: number;
  messageCount: number;
  lastMessageAt: string | null;
};

export const genreOptions = ["議論文", "記敘文", "說明文", "抒情文", "其他"];
export const groupInteractionSteps = [1, 2, 4];
export type CourseTab = "essay" | "openclass" | "group";
