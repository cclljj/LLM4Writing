import { createHash } from "node:crypto";
import { maskPeerUsernames } from "@/src/lib/report-rendering";
import type { Activity, SessionState } from "@/src/lib/types";

export type ResearchExportIdentityMode = "anonymous" | "account";

export type ResearchStudentInputRecord = {
  activityId: string;
  sessionId: string;
  groupId?: string;
  groupName?: string;
  type:
    | "student_message"
    | "makeup_outline"
    | "step3_submitted_outline"
    | "step4_revised_outline"
    | "draft_step6"
    | "draft_step8";
  studentHash: string;
  studentAccount?: string;
  step: number;
  role: "student";
  at: string;
  text: string;
};

export type ResearchStudentInputExport = {
  schemaVersion: "research-student-inputs-v3";
  exportedAt: string;
  identityMode: ResearchExportIdentityMode;
  activity: {
    id: string;
    school: string;
    classNumber: string;
    academicYear: string;
    academicYearTerm: string;
    title: string;
  };
  records: ResearchStudentInputRecord[];
};

const DEVELOPMENT_RESEARCH_EXPORT_HASH_SALT = "llm4writing-research-export-development-only";
export const RESEARCH_EXPORT_HASH_SALT_MISSING = "research_export_hash_salt_missing";

export function resolveResearchExportHashSalt(): string {
  const configuredSalt = process.env.RESEARCH_EXPORT_HASH_SALT?.trim();
  if (configuredSalt) return configuredSalt;
  if (process.env.NODE_ENV === "production") {
    throw new Error(RESEARCH_EXPORT_HASH_SALT_MISSING);
  }
  return DEVELOPMENT_RESEARCH_EXPORT_HASH_SALT;
}

function hashStudent(activityId: string, username: string): string {
  const salt = resolveResearchExportHashSalt();
  return createHash("sha256").update(`${salt}:${activityId}:${username}`).digest("hex");
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

function artifactTimestamp(session: SessionState, username: string, kind: "outline" | "draftStep6" | "draftStep8"): string {
  if (kind === "outline") return session.artifactSignals?.outlineUpdatedAt?.[username] ?? session.createdAt;
  if (kind === "draftStep6") return session.artifactSignals?.draftStep6UpdatedAt?.[username] ?? session.createdAt;
  return session.artifactSignals?.draftStep8UpdatedAt?.[username] ?? session.createdAt;
}

function buildRecord(input: {
  activityId: string;
  session: SessionState;
  username: string;
  identityMode: ResearchExportIdentityMode;
  type: ResearchStudentInputRecord["type"];
  step: number;
  at: string;
  text: string;
}): ResearchStudentInputRecord | null {
  const text = normalizeText(maskPeerUsernames(input.text, input.username, input.session.participants));
  if (!text) return null;
  return {
    activityId: input.activityId,
    sessionId: input.session.id,
    groupId: input.session.groupId,
    groupName: input.session.groupName,
    type: input.type,
    studentHash: hashStudent(input.activityId, input.username),
    ...(input.identityMode === "account" ? { studentAccount: input.username } : {}),
    step: input.step,
    role: "student",
    at: input.at,
    text
  };
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
    const messageRecords = session.messages
      .filter((message) => message.role === "student" && Boolean(message.userId) && participantSet.has(message.userId!))
      .map((message): ResearchStudentInputRecord | null => {
        const username = message.userId!;
        return buildRecord({
          activityId: input.activity.id,
          session,
          type: "student_message",
          username,
          step: message.step,
          at: message.at,
          text: message.text,
          identityMode
        });
      })
      .filter((record): record is ResearchStudentInputRecord => Boolean(record));
    const makeupRecords = (session.makeupWork?.outlineEvents ?? [])
      .filter((event) => participantSet.has(event.username))
      .map((event): ResearchStudentInputRecord | null => {
        return buildRecord({
          activityId: input.activity.id,
          session,
          type: "makeup_outline",
          username: event.username,
          step: event.stepContext,
          at: event.createdAt,
          text: event.text,
          identityMode
        });
      })
      .filter((record): record is ResearchStudentInputRecord => Boolean(record));
    const artifactRecords = session.participants.flatMap((username) => {
      const personalStep = session.personalSteps?.[username] ?? session.currentStep;
      const records: Array<ResearchStudentInputRecord | null> = [
        buildRecord({
          activityId: input.activity.id,
          session,
          type: "step3_submitted_outline",
          username,
          step: 3,
          at: artifactTimestamp(session, username, "outline"),
          text: session.step3SubmittedOutlines?.[username] ?? "",
          identityMode
        }),
        personalStep >= 4
          ? buildRecord({
              activityId: input.activity.id,
              session,
              type: "step4_revised_outline",
              username,
              step: 4,
              at: artifactTimestamp(session, username, "outline"),
              text: session.outlines?.[username] ?? "",
              identityMode
            })
          : null,
        buildRecord({
          activityId: input.activity.id,
          session,
          type: "draft_step6",
          username,
          step: 6,
          at: artifactTimestamp(session, username, "draftStep6"),
          text: session.draftStep6?.[username] ?? "",
          identityMode
        }),
        buildRecord({
          activityId: input.activity.id,
          session,
          type: "draft_step8",
          username,
          step: 8,
          at: artifactTimestamp(session, username, "draftStep8"),
          text: session.draftStep8?.[username] ?? "",
          identityMode
        })
      ];
      return records.filter((record): record is ResearchStudentInputRecord => Boolean(record));
    });
    return [...messageRecords, ...makeupRecords, ...artifactRecords];
  });

  records.sort((a, b) => a.at.localeCompare(b.at) || a.sessionId.localeCompare(b.sessionId));

  return {
    schemaVersion: "research-student-inputs-v3",
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    identityMode,
    activity: {
      id: input.activity.id,
      school: input.activity.school,
      classNumber: input.activity.classNumber,
      academicYear: input.activity.academicYear,
      academicYearTerm: input.activity.academicYearTerm,
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
