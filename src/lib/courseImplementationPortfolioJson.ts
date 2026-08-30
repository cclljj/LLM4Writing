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
    step: 3 | 4 | 5 | 6 | 7 | 8 | 10;
    stepName: string;
    artifactType:
      | "step3_submitted_outline"
      | "step4_revised_outline"
      | "step5_summary_report"
      | "step6_draft"
      | "step7_feedback_report"
      | "step8_revised_draft"
      | "step10_final_report";
    title: string;
    contentFormat: "mermaid" | "markdown";
    available: boolean;
    content: string;
    processMessages: Array<PdfMessage & { stepName: string }>;
    mermaid?: {
      source: string;
      fencedMarkdown: string;
    };
  }>;
  timelineMessages: Array<PdfMessage & { stepName: string }>;
};

function maskText(text: string, peerUsernames: string[]): string {
  return normalizeReportMarkdownText(maskPeerUsernames(text, "", peerUsernames));
}

function mermaidFencedMarkdown(source: string): string {
  const trimmed = source.trim();
  return trimmed ? `\`\`\`mermaid\n${trimmed}\n\`\`\`` : "";
}

export function buildCourseImplementationPortfolioJson(input: CourseImplementationPdfInput): CourseImplementationPortfolioJson {
  const peerUsernames = input.privacyPeerUsernames ?? [];
  const step3SubmittedOutline = maskText(input.step3SubmittedOutline, peerUsernames);
  const step4RevisedOutline = maskText(input.step4RevisedOutline, peerUsernames);
  const step5Report = maskText(input.step5Report ?? "", peerUsernames);
  const step6Draft = maskText(input.step6Draft ?? "", peerUsernames);
  const step7Report = maskText(input.step7Report ?? "", peerUsernames);
  const step8Draft = maskText(input.step8Draft ?? "", peerUsernames);
  const step10Report = maskText(input.step10Report ?? "", peerUsernames);
  const timelineMessages = input.timelineMessages.map((message) => ({
    ...message,
    text: maskText(message.text, peerUsernames),
    stepName: stepNameMap[message.step] ?? "",
  }));
  const step4ProcessMessages = (input.step4ProcessMessages ?? input.timelineMessages.filter((message) => message.step === 4)).map((message) => ({
    ...message,
    text: maskText(message.text, peerUsernames),
    stepName: stepNameMap[message.step] ?? "",
  }));
  const processMessagesForStep = (step: number) => (step === 4 ? step4ProcessMessages : timelineMessages.filter((message) => message.step === step));
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
        processMessages: processMessagesForStep(3),
        mermaid: {
          source: step3SubmittedOutline,
          fencedMarkdown: mermaidFencedMarkdown(step3SubmittedOutline),
        },
      },
      {
        step: 4,
        stepName: stepNameMap[4] ?? "",
        artifactType: "step4_revised_outline",
        title: "步驟四討論後修正版架構圖",
        contentFormat: "mermaid",
        available: Boolean(step4RevisedOutline.trim()),
        content: step4RevisedOutline,
        processMessages: processMessagesForStep(4),
        mermaid: {
          source: step4RevisedOutline,
          fencedMarkdown: mermaidFencedMarkdown(step4RevisedOutline),
        },
      },
      {
        step: 5,
        stepName: stepNameMap[5] ?? "",
        artifactType: "step5_summary_report",
        title: "步驟五摘要報告",
        contentFormat: "markdown",
        available: Boolean(step5Report.trim()),
        content: step5Report,
        processMessages: processMessagesForStep(5),
      },
      {
        step: 6,
        stepName: stepNameMap[6] ?? "",
        artifactType: "step6_draft",
        title: "步驟六初稿",
        contentFormat: "markdown",
        available: Boolean(step6Draft.trim()),
        content: step6Draft,
        processMessages: processMessagesForStep(6),
      },
      {
        step: 7,
        stepName: stepNameMap[7] ?? "",
        artifactType: "step7_feedback_report",
        title: "步驟七分析回饋",
        contentFormat: "markdown",
        available: Boolean(step7Report.trim()),
        content: step7Report,
        processMessages: processMessagesForStep(7),
      },
      {
        step: 8,
        stepName: stepNameMap[8] ?? "",
        artifactType: "step8_revised_draft",
        title: "步驟八潤飾稿",
        contentFormat: "markdown",
        available: Boolean(step8Draft.trim()),
        content: step8Draft,
        processMessages: processMessagesForStep(8),
      },
      {
        step: 10,
        stepName: stepNameMap[10] ?? "",
        artifactType: "step10_final_report",
        title: "步驟十總結報告",
        contentFormat: "markdown",
        available: Boolean(step10Report.trim()),
        content: step10Report,
        processMessages: processMessagesForStep(10),
      },
    ],
    timelineMessages,
  };
}

export function buildCourseImplementationPortfolioJsonString(input: CourseImplementationPdfInput): string {
  return `${JSON.stringify(buildCourseImplementationPortfolioJson(input), null, 2)}\n`;
}
