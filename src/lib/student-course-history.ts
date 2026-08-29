import type { SessionState } from "@/src/lib/types";

export type StudentCourseLatestWork = {
  outline: string;
  step3SubmittedOutline: string;
  step4Outline: string;
  draftStep6: string;
  draftStep8: string;
  step7Report: string;
  step10Report: string;
};

function firstText(sessions: SessionState[], read: (session: SessionState) => string | undefined): string {
  for (const session of sessions) {
    const value = read(session)?.trim();
    if (value) return value;
  }
  return "";
}

export function resolveStudentCourseLatestWork(input: {
  sessions: SessionState[];
  username: string;
  latestPersonalStep: number;
}): StudentCourseLatestWork {
  const { sessions, username, latestPersonalStep } = input;
  return {
    outline: firstText(sessions, (session) => session.outlines?.[username]),
    step3SubmittedOutline: firstText(sessions, (session) => session.step3SubmittedOutlines?.[username]),
    step4Outline: latestPersonalStep >= 4 ? firstText(sessions, (session) => session.outlines?.[username]) : "",
    draftStep6: firstText(sessions, (session) => session.draftStep6?.[username]),
    draftStep8: firstText(sessions, (session) => session.draftStep8?.[username]),
    step7Report: firstText(sessions, (session) => session.reports?.step7?.[username]),
    step10Report: firstText(sessions, (session) => session.reports?.step10?.[username]),
  };
}
