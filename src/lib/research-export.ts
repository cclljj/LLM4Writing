import { createHash } from "node:crypto";
import type { Activity, SessionState } from "@/src/lib/types";

export type ResearchExportIdentityMode = "anonymous" | "account";

export type ResearchStudentInputRecord = {
  activityId: string;
  sessionId: string;
  groupId?: string;
  groupName?: string;
  studentHash: string;
  studentAccount?: string;
  step: number;
  role: "student";
  at: string;
  text: string;
};

export type ResearchStudentInputExport = {
  schemaVersion: "research-student-inputs-v1";
  exportedAt: string;
  identityMode: ResearchExportIdentityMode;
  activity: {
    id: string;
    school: string;
    classNumber: string;
    title: string;
  };
  records: ResearchStudentInputRecord[];
};

function hashStudent(activityId: string, username: string): string {
  const salt = process.env.RESEARCH_EXPORT_HASH_SALT ?? "llm4writing-research-export-v1";
  return createHash("sha256").update(`${salt}:${activityId}:${username}`).digest("hex");
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

export function buildResearchStudentInputExport(input: {
  activity: Activity;
  sessions: SessionState[];
  identityMode?: ResearchExportIdentityMode;
  exportedAt?: string;
}): ResearchStudentInputExport {
  const identityMode = input.identityMode ?? "anonymous";
  const records = input.sessions.flatMap((session) => {
    const participantSet = new Set(session.participants);
    return session.messages
      .filter((message) => message.role === "student" && Boolean(message.userId) && participantSet.has(message.userId!))
      .map((message): ResearchStudentInputRecord | null => {
        const username = message.userId!;
        const text = normalizeText(message.text);
        if (!text) return null;
        return {
          activityId: input.activity.id,
          sessionId: session.id,
          groupId: session.groupId,
          groupName: session.groupName,
          studentHash: hashStudent(input.activity.id, username),
          ...(identityMode === "account" ? { studentAccount: username } : {}),
          step: message.step,
          role: "student",
          at: message.at,
          text
        };
      })
      .filter((record): record is ResearchStudentInputRecord => Boolean(record));
  });

  records.sort((a, b) => a.at.localeCompare(b.at) || a.sessionId.localeCompare(b.sessionId));

  return {
    schemaVersion: "research-student-inputs-v1",
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    identityMode,
    activity: {
      id: input.activity.id,
      school: input.activity.school,
      classNumber: input.activity.classNumber,
      title: input.activity.title
    },
    records
  };
}

export function parseResearchExportIdentityMode(raw: string | null | undefined): ResearchExportIdentityMode | null {
  const value = (raw ?? "anonymous").trim();
  if (value === "anonymous" || value === "account") return value;
  return null;
}
