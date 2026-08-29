import type { CourseImplementationPdfInput, PdfMessage } from "@/src/lib/courseImplementationPdf";
import { maskPeerUsernames, normalizeReportMarkdownText } from "@/src/lib/report-rendering";
import { stepNameMap } from "@/src/lib/step-names";

export type CourseImplementationPortfolioJson = {
  schemaVersion: "student-portfolio-report-v1.1";
  reportVersion: "1.1";
  generatedAtIso: string;
  completedAtIso?: string;
  course: {
    activityId: string;
    school: string;
    classNumber: string;
    title: string;
  };
  student: {
    username: string;
    name: string;
  };
  summary: {
    metric: CourseImplementationPdfInput["metric"];
    starLabel: string;
    starRationales: string[];
  };
  artifacts: {
    step3SubmittedOutline: string;
    step4RevisedOutline: string;
  };
  timelineMessages: Array<PdfMessage & { stepName: string }>;
};

function maskText(text: string, peerUsernames: string[]): string {
  return normalizeReportMarkdownText(maskPeerUsernames(text, "", peerUsernames));
}

export function buildCourseImplementationPortfolioJson(input: CourseImplementationPdfInput): CourseImplementationPortfolioJson {
  const peerUsernames = input.privacyPeerUsernames ?? [];
  return {
    schemaVersion: "student-portfolio-report-v1.1",
    reportVersion: "1.1",
    generatedAtIso: input.generatedAtIso,
    completedAtIso: input.completedAtIso,
    course: {
      activityId: input.activityId,
      school: input.school,
      classNumber: input.classNumber,
      title: input.title,
    },
    student: {
      username: input.username,
      name: input.name,
    },
    summary: {
      metric: input.metric,
      starLabel: input.starLabel,
      starRationales: input.starRationales,
    },
    artifacts: {
      step3SubmittedOutline: maskText(input.step3SubmittedOutline, peerUsernames),
      step4RevisedOutline: maskText(input.step4RevisedOutline, peerUsernames),
    },
    timelineMessages: input.timelineMessages.map((message) => ({
      ...message,
      text: maskText(message.text, peerUsernames),
      stepName: stepNameMap[message.step] ?? "",
    })),
  };
}

export function buildCourseImplementationPortfolioJsonString(input: CourseImplementationPdfInput): string {
  return `${JSON.stringify(buildCourseImplementationPortfolioJson(input), null, 2)}\n`;
}
