import type { CourseImplementationPdfInput, PdfMessage } from "@/src/lib/courseImplementationPdf";
import { maskPeerUsernames, normalizeReportMarkdownText } from "@/src/lib/report-rendering";
import { getWorkflowStepByCapability, getWorkflowStepName } from "@/src/lib/course-workflow";
import { COURSE_REPORT_VERSION, STUDENT_PORTFOLIO_JSON_SCHEMA_VERSION } from "@/src/lib/course-report-version";

type PortfolioArtifactType =
  | "step1_discussion"
  | "step2_discussion"
  | "step3_submitted_outline"
  | "step4_revised_outline"
  | "step5_summary_report"
  | "step6_draft"
  | "step7_feedback_report"
  | "step8_revised_draft"
  | "step10_final_report";

type PortfolioTimelineMessage = PdfMessage & {
  stepName: string;
  entryType: "message" | "artifact";
  artifactType?: PortfolioArtifactType;
  contentFormat?: "conversation" | "mermaid" | "markdown";
};

type PortfolioStepArtifact = {
  step: number;
  stepName: string;
  artifactType: PortfolioArtifactType;
  title: string;
  contentFormat: "conversation" | "mermaid" | "markdown";
  available: boolean;
  content: string;
  processMessages: Array<PdfMessage & { stepName: string }>;
  mermaid?: {
    source: string;
    fencedMarkdown: string;
  };
};

const DEIDENTIFIED_STUDENT_NAME = "***";
const DEIDENTIFIED_COURSE_SCHOOL = "*****";
const DEIDENTIFIED_COURSE_CLASS_NUMBER = "*****";

export type CourseImplementationPortfolioJson = {
  schemaVersion: typeof STUDENT_PORTFOLIO_JSON_SCHEMA_VERSION;
  reportVersion: typeof COURSE_REPORT_VERSION;
  generatedAtIso: string;
  completedAtIso?: string;
  course: {
    activityId: string;
    school: typeof DEIDENTIFIED_COURSE_SCHOOL;
    classNumber: typeof DEIDENTIFIED_COURSE_CLASS_NUMBER;
    academicYear: string;
    academicYearTerm: string;
    title: string;
  };
  student: {
    username: string;
    name: typeof DEIDENTIFIED_STUDENT_NAME;
  };
  summary: {
    metric: CourseImplementationPdfInput["metric"];
    starLabel: string;
    starRationales: string[];
  };
  stepArtifacts: PortfolioStepArtifact[];
  timelineMessages: PortfolioTimelineMessage[];
};

function maskText(text: string, peerUsernames: string[]): string {
  return normalizeReportMarkdownText(maskPeerUsernames(text, "", peerUsernames));
}

function mermaidFencedMarkdown(source: string): string {
  const trimmed = source.trim();
  return trimmed ? `\`\`\`mermaid\n${trimmed}\n\`\`\`` : "";
}

function timelineMessageKey(message: Pick<PdfMessage, "role" | "step" | "text" | "at">): string {
  return `${message.role}\u0000${message.step}\u0000${message.at}\u0000${message.text}`;
}

function artifactTimelineText(artifact: PortfolioStepArtifact): string {
  if (artifact.contentFormat === "mermaid") {
    return `## ${artifact.title}\n${artifact.mermaid?.fencedMarkdown ?? artifact.content}`;
  }
  return `## ${artifact.title}\n${artifact.content}`;
}

function discussionTranscript(messages: Array<PdfMessage & { stepName: string }>): string {
  return messages.map((message) => `### ${message.role} · ${message.at}\n${message.text}`).join("\n\n");
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
  const originalTimelineMessages: PortfolioTimelineMessage[] = input.timelineMessages.map((message) => ({
    ...message,
    text: maskText(message.text, peerUsernames),
    stepName: getWorkflowStepName(input, message.step),
    entryType: "message",
  }));
  const topicStep = getWorkflowStepByCapability(input, "topic_discussion")?.step ?? 1;
  const researchStep = getWorkflowStepByCapability(input, "research_discussion")?.step ?? 2;
  const outlineStep = getWorkflowStepByCapability(input, "outline")?.step ?? 3;
  const peerOutlineStep = getWorkflowStepByCapability(input, "peer_outline")?.step ?? 4;
  const summaryStep = getWorkflowStepByCapability(input, "summary_report")?.step ?? 5;
  const draftStep = getWorkflowStepByCapability(input, "draft")?.step ?? 6;
  const feedbackStep = getWorkflowStepByCapability(input, "feedback_report")?.step ?? 7;
  const revisionStep = getWorkflowStepByCapability(input, "revision")?.step ?? 8;
  const finalStep = getWorkflowStepByCapability(input, "final_report")?.step ?? 10;
  const step4ProcessMessages = (input.step4ProcessMessages ?? input.timelineMessages.filter((message) => message.step === peerOutlineStep)).map((message) => ({
    ...message,
    text: maskText(message.text, peerUsernames),
    stepName: getWorkflowStepName(input, message.step),
  }));
  const timelineMessages: PortfolioTimelineMessage[] = [...originalTimelineMessages];
  const timelineMessageKeys = new Set(timelineMessages.map(timelineMessageKey));
  for (const message of step4ProcessMessages) {
    const key = timelineMessageKey(message);
    if (timelineMessageKeys.has(key)) continue;
    timelineMessages.push({ ...message, entryType: "message" });
    timelineMessageKeys.add(key);
  }
  const processMessagesForStep = (step: number) =>
    step === peerOutlineStep ? step4ProcessMessages : timelineMessages.filter((message) => message.step === step);
  const stepArtifacts: PortfolioStepArtifact[] = [
    {
      step: topicStep,
      stepName: getWorkflowStepName(input, topicStep),
      artifactType: "step1_discussion",
      title: "步驟一討論紀錄",
      contentFormat: "conversation",
      available: processMessagesForStep(topicStep).length > 0,
      content: discussionTranscript(processMessagesForStep(topicStep)),
      processMessages: processMessagesForStep(topicStep),
    },
    {
      step: researchStep,
      stepName: getWorkflowStepName(input, researchStep),
      artifactType: "step2_discussion",
      title: "步驟二討論紀錄",
      contentFormat: "conversation",
      available: processMessagesForStep(researchStep).length > 0,
      content: discussionTranscript(processMessagesForStep(researchStep)),
      processMessages: processMessagesForStep(researchStep),
    },
    {
      step: outlineStep,
      stepName: getWorkflowStepName(input, outlineStep),
      artifactType: "step3_submitted_outline",
      title: "步驟三原始輸入架構圖",
      contentFormat: "mermaid",
      available: Boolean(step3SubmittedOutline.trim()),
      content: step3SubmittedOutline,
      processMessages: processMessagesForStep(outlineStep),
      mermaid: {
        source: step3SubmittedOutline,
        fencedMarkdown: mermaidFencedMarkdown(step3SubmittedOutline),
      },
    },
    {
      step: peerOutlineStep,
      stepName: getWorkflowStepName(input, peerOutlineStep),
      artifactType: "step4_revised_outline",
      title: "步驟四討論後修正版架構圖",
      contentFormat: "mermaid",
      available: Boolean(step4RevisedOutline.trim()),
      content: step4RevisedOutline,
      processMessages: processMessagesForStep(peerOutlineStep),
      mermaid: {
        source: step4RevisedOutline,
        fencedMarkdown: mermaidFencedMarkdown(step4RevisedOutline),
      },
    },
    {
      step: summaryStep,
      stepName: getWorkflowStepName(input, summaryStep),
      artifactType: "step5_summary_report",
      title: "步驟五摘要報告",
      contentFormat: "markdown",
      available: Boolean(step5Report.trim()),
      content: step5Report,
      processMessages: processMessagesForStep(summaryStep),
    },
    {
      step: draftStep,
      stepName: getWorkflowStepName(input, draftStep),
      artifactType: "step6_draft",
      title: "步驟六初稿",
      contentFormat: "markdown",
      available: Boolean(step6Draft.trim()),
      content: step6Draft,
      processMessages: processMessagesForStep(draftStep),
    },
    {
      step: feedbackStep,
      stepName: getWorkflowStepName(input, feedbackStep),
      artifactType: "step7_feedback_report",
      title: "步驟七分析回饋",
      contentFormat: "markdown",
      available: Boolean(step7Report.trim()),
      content: step7Report,
      processMessages: processMessagesForStep(feedbackStep),
    },
    {
      step: revisionStep,
      stepName: getWorkflowStepName(input, revisionStep),
      artifactType: "step8_revised_draft",
      title: "步驟八潤飾稿",
      contentFormat: "markdown",
      available: Boolean(step8Draft.trim()),
      content: step8Draft,
      processMessages: processMessagesForStep(revisionStep),
    },
    {
      step: finalStep,
      stepName: getWorkflowStepName(input, finalStep),
      artifactType: "step10_final_report",
      title: "步驟十總結報告",
      contentFormat: "markdown",
      available: Boolean(step10Report.trim()),
      content: step10Report,
      processMessages: processMessagesForStep(finalStep),
    },
  ];

  for (const artifact of stepArtifacts) {
    if (!artifact.available || artifact.contentFormat === "conversation") continue;
    const alreadyIncluded = timelineMessages.some(
      (message) => message.step === artifact.step && message.text.includes(artifact.content)
    );
    if (alreadyIncluded) continue;
    const stepMessages = timelineMessages.filter((message) => message.step === artifact.step);
    timelineMessages.push({
      role: "artifact",
      step: artifact.step,
      text: artifactTimelineText(artifact),
      at: stepMessages.at(-1)?.at ?? input.generatedAtIso,
      stepName: artifact.stepName,
      entryType: "artifact",
      artifactType: artifact.artifactType,
      contentFormat: artifact.contentFormat,
    });
  }
  timelineMessages.sort((a, b) => {
    if (a.step !== b.step) return a.step - b.step;
    const byTime = a.at.localeCompare(b.at);
    if (byTime !== 0) return byTime;
    return a.entryType === b.entryType ? 0 : a.entryType === "message" ? -1 : 1;
  });
  return {
    schemaVersion: STUDENT_PORTFOLIO_JSON_SCHEMA_VERSION,
    reportVersion: COURSE_REPORT_VERSION,
    generatedAtIso: input.generatedAtIso,
    completedAtIso: input.completedAtIso,
    course: {
      activityId: input.activityId,
      school: DEIDENTIFIED_COURSE_SCHOOL,
      classNumber: DEIDENTIFIED_COURSE_CLASS_NUMBER,
      academicYear: input.academicYear || "114",
      academicYearTerm: input.academicYearTerm || "2",
      title: input.title,
    },
    student: {
      username: input.username,
      name: DEIDENTIFIED_STUDENT_NAME,
    },
    summary: {
      metric: input.metric,
      starLabel: input.starLabel,
      starRationales: input.starRationales,
    },
    stepArtifacts,
    timelineMessages,
  };
}

export function buildCourseImplementationPortfolioJsonString(input: CourseImplementationPdfInput): string {
  return `${JSON.stringify(buildCourseImplementationPortfolioJson(input), null, 2)}\n`;
}
