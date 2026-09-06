import type { CourseImplementationPdfInput, PdfMessage } from "@/src/lib/courseImplementationPdf";
import { maskPeerUsernames, normalizeReportMarkdownText } from "@/src/lib/report-rendering";
import { getSessionWorkflowSteps, getWorkflowStepByCapability, getWorkflowStepName, getWorkflowStepOrderIndex } from "@/src/lib/course-workflow";
import { COURSE_REPORT_VERSION, STUDENT_PORTFOLIO_JSON_SCHEMA_VERSION } from "@/src/lib/course-report-version";
import { DEFAULT_ACADEMIC_YEAR, DEFAULT_ACADEMIC_YEAR_TERM } from "@/src/lib/academic-term-defaults";

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

function configuredStepTitle(input: CourseImplementationPdfInput, step: number, suffix: string): string {
  const name = getWorkflowStepName(input, step);
  return `${name}：${suffix}`;
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
  const workflowSteps = getSessionWorkflowSteps(input);
  const topicStep = getWorkflowStepByCapability(input, "topic_discussion");
  const researchStep = getWorkflowStepByCapability(input, "research_discussion");
  const outlineStep = getWorkflowStepByCapability(input, "outline");
  const peerOutlineStep = getWorkflowStepByCapability(input, "peer_outline");
  const summaryStep = getWorkflowStepByCapability(input, "summary_report");
  const draftStep = getWorkflowStepByCapability(input, "draft");
  const feedbackStep = getWorkflowStepByCapability(input, "feedback_report");
  const revisionStep = getWorkflowStepByCapability(input, "revision");
  const finalStep = getWorkflowStepByCapability(input, "final_report");
  const peerOutlineRuntimeStep = peerOutlineStep?.step;
  const step4ProcessMessages = (input.step4ProcessMessages ?? input.timelineMessages.filter((message) => message.step === peerOutlineRuntimeStep)).map((message) => ({
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
    step === peerOutlineRuntimeStep ? step4ProcessMessages : timelineMessages.filter((message) => message.step === step);
  const stepArtifacts: PortfolioStepArtifact[] = [
    topicStep
      ? {
      step: topicStep.step,
      stepName: getWorkflowStepName(input, topicStep.step),
      artifactType: "step1_discussion",
      title: configuredStepTitle(input, topicStep.step, "討論紀錄"),
      contentFormat: "conversation",
      available: processMessagesForStep(topicStep.step).length > 0,
      content: discussionTranscript(processMessagesForStep(topicStep.step)),
      processMessages: processMessagesForStep(topicStep.step),
    }
      : null,
    researchStep
      ? {
      step: researchStep.step,
      stepName: getWorkflowStepName(input, researchStep.step),
      artifactType: "step2_discussion",
      title: configuredStepTitle(input, researchStep.step, "討論紀錄"),
      contentFormat: "conversation",
      available: processMessagesForStep(researchStep.step).length > 0,
      content: discussionTranscript(processMessagesForStep(researchStep.step)),
      processMessages: processMessagesForStep(researchStep.step),
    }
      : null,
    outlineStep
      ? {
      step: outlineStep.step,
      stepName: getWorkflowStepName(input, outlineStep.step),
      artifactType: "step3_submitted_outline",
      title: configuredStepTitle(input, outlineStep.step, "原始輸入架構圖"),
      contentFormat: "mermaid",
      available: Boolean(step3SubmittedOutline.trim()),
      content: step3SubmittedOutline,
      processMessages: processMessagesForStep(outlineStep.step),
      mermaid: {
        source: step3SubmittedOutline,
        fencedMarkdown: mermaidFencedMarkdown(step3SubmittedOutline),
      },
    }
      : null,
    peerOutlineStep
      ? {
      step: peerOutlineStep.step,
      stepName: getWorkflowStepName(input, peerOutlineStep.step),
      artifactType: "step4_revised_outline",
      title: configuredStepTitle(input, peerOutlineStep.step, "討論後修正版架構圖"),
      contentFormat: "mermaid",
      available: Boolean(step4RevisedOutline.trim()),
      content: step4RevisedOutline,
      processMessages: processMessagesForStep(peerOutlineStep.step),
      mermaid: {
        source: step4RevisedOutline,
        fencedMarkdown: mermaidFencedMarkdown(step4RevisedOutline),
      },
    }
      : null,
    summaryStep
      ? {
      step: summaryStep.step,
      stepName: getWorkflowStepName(input, summaryStep.step),
      artifactType: "step5_summary_report",
      title: configuredStepTitle(input, summaryStep.step, "摘要報告"),
      contentFormat: "markdown",
      available: Boolean(step5Report.trim()),
      content: step5Report,
      processMessages: processMessagesForStep(summaryStep.step),
    }
      : null,
    draftStep
      ? {
      step: draftStep.step,
      stepName: getWorkflowStepName(input, draftStep.step),
      artifactType: "step6_draft",
      title: configuredStepTitle(input, draftStep.step, "初稿"),
      contentFormat: "markdown",
      available: Boolean(step6Draft.trim()),
      content: step6Draft,
      processMessages: processMessagesForStep(draftStep.step),
    }
      : null,
    feedbackStep
      ? {
      step: feedbackStep.step,
      stepName: getWorkflowStepName(input, feedbackStep.step),
      artifactType: "step7_feedback_report",
      title: configuredStepTitle(input, feedbackStep.step, "分析回饋"),
      contentFormat: "markdown",
      available: Boolean(step7Report.trim()),
      content: step7Report,
      processMessages: processMessagesForStep(feedbackStep.step),
    }
      : null,
    revisionStep
      ? {
      step: revisionStep.step,
      stepName: getWorkflowStepName(input, revisionStep.step),
      artifactType: "step8_revised_draft",
      title: configuredStepTitle(input, revisionStep.step, "潤飾稿"),
      contentFormat: "markdown",
      available: Boolean(step8Draft.trim()),
      content: step8Draft,
      processMessages: processMessagesForStep(revisionStep.step),
    }
      : null,
    finalStep
      ? {
      step: finalStep.step,
      stepName: getWorkflowStepName(input, finalStep.step),
      artifactType: "step10_final_report",
      title: configuredStepTitle(input, finalStep.step, "總結報告"),
      contentFormat: "markdown",
      available: Boolean(step10Report.trim()),
      content: step10Report,
      processMessages: processMessagesForStep(finalStep.step),
    }
      : null,
  ].filter((artifact): artifact is PortfolioStepArtifact => Boolean(artifact))
    .sort((a, b) => getWorkflowStepOrderIndex({ workflowSteps }, a.step) - getWorkflowStepOrderIndex({ workflowSteps }, b.step));

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
    const byWorkflowOrder = getWorkflowStepOrderIndex({ workflowSteps }, a.step) - getWorkflowStepOrderIndex({ workflowSteps }, b.step);
    if (byWorkflowOrder !== 0) return byWorkflowOrder;
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
      academicYear: input.academicYear || DEFAULT_ACADEMIC_YEAR,
      academicYearTerm: input.academicYearTerm || DEFAULT_ACADEMIC_YEAR_TERM,
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
