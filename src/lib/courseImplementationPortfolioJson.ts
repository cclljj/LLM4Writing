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
  stepArtifacts: Array<{
    step: 3 | 4;
    stepName: string;
    artifactType: "step3_submitted_outline" | "step4_revised_outline";
    title: string;
    contentFormat: "mermaid";
    available: boolean;
    content: string;
  }>;
  timelineMessages: Array<PdfMessage & { stepName: string }>;
};

function maskText(text: string, peerUsernames: string[]): string {
  return normalizeReportMarkdownText(maskPeerUsernames(text, "", peerUsernames));
}

export function buildCourseImplementationPortfolioJson(input: CourseImplementationPdfInput): CourseImplementationPortfolioJson {
  const peerUsernames = input.privacyPeerUsernames ?? [];
  const step3SubmittedOutline = maskText(input.step3SubmittedOutline, peerUsernames);
  const step4RevisedOutline = maskText(input.step4RevisedOutline, peerUsernames);
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
      step3SubmittedOutline,
      step4RevisedOutline,
    },
    stepArtifacts: [
      {
        step: 3,
        stepName: stepNameMap[3] ?? "",
        artifactType: "step3_submitted_outline",
        title: "步驟三原始輸入架構圖",
        contentFormat: "mermaid",
        available: Boolean(step3SubmittedOutline.trim()),
        content: step3SubmittedOutline,
      },
      {
        step: 4,
        stepName: stepNameMap[4] ?? "",
        artifactType: "step4_revised_outline",
        title: "步驟四討論後修正版架構圖",
        contentFormat: "mermaid",
        available: Boolean(step4RevisedOutline.trim()),
        content: step4RevisedOutline,
      },
    ],
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
