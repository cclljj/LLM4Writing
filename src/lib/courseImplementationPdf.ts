import { jsPDF } from "jspdf";
import { buildCourseReportTimelineItems } from "@/src/lib/course-report-pdf-timeline";
import { buildOutlinePreview } from "@/src/lib/outline-utils";
import { maskPeerUsernames, normalizeReportMarkdownText } from "@/src/lib/report-rendering";
import { formatTaipeiDateTime } from "@/src/lib/time-format";
import { COURSE_REPORT_VERSION } from "@/src/lib/course-report-version";
import { getWorkflowStepByCapability, getWorkflowStepName } from "@/src/lib/course-workflow";
import { DEFAULT_ACADEMIC_YEAR, DEFAULT_ACADEMIC_YEAR_TERM } from "@/src/lib/academic-term-defaults";
import { CourseWorkflowStep } from "@/src/lib/types";

export type PdfStudentMetric = {
  stars: number;
  stepText: string;
  maxStep: number;
  messageCount: number;
  rejectedCount: number;
  step3OutlineChars: number;
  draftStep6Chars: number;
  joined: boolean;
};

export type PdfMessage = {
  role: string;
  step: number;
  text: string;
  at: string;
};

export type CourseImplementationPdfInput = {
  activityId: string;
  school: string;
  classNumber: string;
  academicYear?: string;
  academicYearTerm?: string;
  title: string;
  username: string;
  name: string;
  metric: PdfStudentMetric;
  starLabel: string;
  starRationales: string[];
  timelineMessages: PdfMessage[];
  step3SubmittedOutline: string;
  step4RevisedOutline: string;
  step4ProcessMessages?: PdfMessage[];
  step5Report?: string;
  step6Draft?: string;
  step7Report?: string;
  step8Draft?: string;
  step10Report?: string;
  privacyPeerUsernames?: string[];
  generatedAtIso: string;
  /** ISO timestamp of the student's Step10 completion; falls back to course-ended or legacy activity time. */
  completedAtIso?: string;
  workflowSteps?: CourseWorkflowStep[];
};

const FONT_FILE_NAME = "NotoSansTC[wght].ttf";
const FONT_FAMILY = "NotoSansTC";
const FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf";

const PAGE = {
  width: 595.28,
  height: 841.89,
  marginX: 40,
  marginTop: 86,
  marginBottom: 44,
};

const COLORS = {
  title: [15, 23, 42] as const,
  text: [30, 41, 59] as const,
  muted: [100, 116, 139] as const,
  topBar: [30, 64, 175] as const,
  topBarSoft: [219, 234, 254] as const,
  sectionBg: [239, 246, 255] as const,
  sectionStroke: [191, 219, 254] as const,
  studentBg: [239, 246, 255] as const,
  aiBg: [240, 253, 244] as const,
  systemBg: [248, 250, 252] as const,
  quoteBg: [241, 245, 249] as const,
  codeBg: [15, 23, 42] as const,
  codeText: [226, 232, 240] as const,
  edge: [148, 163, 184] as const,
  nodeStroke: [100, 116, 139] as const,
  nodeFill: [255, 255, 255] as const,
};

let fontBase64Cache: string | null = null;
let fontLoadPromise: Promise<string | null> | null = null;

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function loadFontBase64(): Promise<string | null> {
  if (fontBase64Cache) return fontBase64Cache;
  if (fontLoadPromise) return fontLoadPromise;

  fontLoadPromise = (async () => {
    try {
      const res = await fetch(FONT_URL, { cache: "force-cache" });
      if (!res.ok) return null;
      const buffer = await res.arrayBuffer();
      const base64 = toBase64(new Uint8Array(buffer));
      fontBase64Cache = base64;
      return base64;
    } catch {
      return null;
    }
  })();

  return fontLoadPromise;
}

function sanitize(text: string): string {
  return normalizeReportMarkdownText(text ?? "");
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
}

function inlineSegments(text: string): Array<{ text: string; strong: boolean }> {
  const segments: Array<{ text: string; strong: boolean }> = [];
  const re = /(\*\*.+?\*\*|__.+?__|`.+?`)/g;
  let cursor = 0;
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ text: stripInlineMarkdown(text.slice(cursor, index)), strong: false });
    const raw = match[0];
    const strong = raw.startsWith("**") || raw.startsWith("__");
    segments.push({ text: stripInlineMarkdown(raw), strong });
    cursor = index + raw.length;
  }
  if (cursor < text.length) segments.push({ text: stripInlineMarkdown(text.slice(cursor)), strong: false });
  return segments.filter((segment) => segment.text.length > 0);
}

function formatRole(role: string): string {
  if (role === "student") return "學生";
  if (role === "ai") return "AI";
  if (role === "system") return "系統";
  return role || "未知";
}

/**
 * Use the same dagre-generated graph model as the web OutlineSvg component.
 * The PDF renderer draws it on its own landscape page, rather than trying to
 * invent a separate compact tree layout for A4 portrait pages.
 */
export function buildPrintableOutlinePreview(mermaidText: string) {
  return buildOutlinePreview(mermaidText, { maxLines: 40 });
}

export async function generateCourseImplementationPdf(input: CourseImplementationPdfInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const contentWidth = PAGE.width - PAGE.marginX * 2;

  const fontBase64 = await loadFontBase64();
  if (!fontBase64) {
    throw new Error("pdf_font_load_failed");
  }
  doc.addFileToVFS(FONT_FILE_NAME, fontBase64);
  doc.addFont(FONT_FILE_NAME, FONT_FAMILY, "normal");
  doc.addFont(FONT_FILE_NAME, FONT_FAMILY, "bold");
  doc.setFont(FONT_FAMILY, "normal");

  let y = PAGE.marginTop;
  let pageNo = 1;

  const setTextColor = (rgb: readonly [number, number, number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setFillColor = (rgb: readonly [number, number, number]) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setDrawColor = (rgb: readonly [number, number, number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  function drawPageChrome(): void {
    setFillColor(COLORS.topBar);
    doc.rect(0, 0, PAGE.width, 34, "F");
    setFillColor(COLORS.topBarSoft);
    doc.rect(0, 34, PAGE.width, 8, "F");

    doc.setFontSize(9);
    setTextColor([255, 255, 255]);
    doc.text(`LLM4Writing 課程實施報告`, PAGE.marginX, 26);
    setTextColor(COLORS.muted);
    doc.text(`第 ${pageNo} 頁`, PAGE.width - PAGE.marginX - 48, PAGE.height - 18);
    setTextColor(COLORS.text);
  }

  function newPage(): void {
    doc.addPage("a4", "portrait");
    pageNo += 1;
    y = PAGE.marginTop;
    drawPageChrome();
  }

  function ensureSpacePx(heightPx: number): void {
    if (y + heightPx <= PAGE.height - PAGE.marginBottom) return;
    newPage();
  }

  function setFontStyle(style: "normal" | "bold"): void {
    doc.setFont(FONT_FAMILY, style);
  }

  function writeWrapped(text: string, x: number, width: number, fontSize = 11, lineHeight = 1.55, options?: { strong?: boolean }): number {
    doc.setFontSize(fontSize);
    setFontStyle(options?.strong ? "bold" : "normal");
    const normalized = stripInlineMarkdown(text);
    const lines = doc.splitTextToSize(normalized || "（空白）", width) as string[];
    const lh = Math.round(fontSize * lineHeight);
    ensureSpacePx(lines.length * lh + 4);
    doc.text(lines, x, y);
    const consumed = lines.length * lh;
    y += consumed;
    setFontStyle("normal");
    return consumed;
  }

  function writeRichWrapped(text: string, x: number, width: number, fontSize = 11, lineHeight = 1.55): number {
    const segments = inlineSegments(text);
    if (segments.length === 0) return writeWrapped(text, x, width, fontSize, lineHeight);
    const lines: Array<Array<{ text: string; strong: boolean }>> = [[]];
    let currentWidth = 0;

    const append = (ch: string, strong: boolean) => {
      setFontStyle(strong ? "bold" : "normal");
      doc.setFontSize(fontSize);
      const chWidth = doc.getTextWidth(ch);
      if (currentWidth > 0 && currentWidth + chWidth > width) {
        lines.push([]);
        currentWidth = 0;
      }
      lines[lines.length - 1]!.push({ text: ch, strong });
      currentWidth += chWidth;
    };

    for (const segment of segments) {
      for (const ch of Array.from(segment.text)) append(ch, segment.strong);
    }

    const lh = Math.round(fontSize * lineHeight);
    ensureSpacePx(lines.length * lh + 4);
    let lineY = y;
    for (const line of lines) {
      let lineX = x;
      let buffer = "";
      let activeStrong = line[0]?.strong ?? false;
      const flush = () => {
        if (!buffer) return;
        setFontStyle(activeStrong ? "bold" : "normal");
        doc.setFontSize(fontSize);
        doc.text(buffer, lineX, lineY);
        lineX += doc.getTextWidth(buffer);
        buffer = "";
      };
      for (const part of line) {
        if (part.strong !== activeStrong) {
          flush();
          activeStrong = part.strong;
        }
        buffer += part.text;
      }
      flush();
      lineY += lh;
    }
    const consumed = lines.length * lh;
    y += consumed;
    setFontStyle("normal");
    return consumed;
  }

  function writeSectionHeader(title: string): void {
    ensureSpacePx(34);
    setFillColor(COLORS.sectionBg);
    setDrawColor(COLORS.sectionStroke);
    doc.roundedRect(PAGE.marginX, y, contentWidth, 26, 6, 6, "FD");
    doc.setFontSize(12);
    setFontStyle("bold");
    setTextColor(COLORS.title);
    doc.text(title, PAGE.marginX + 10, y + 17);
    setFontStyle("normal");
    setTextColor(COLORS.text);
    y += 34;
  }

  function renderMarkdown(markdown: string, x: number, width: number, baseFontSize = 11): void {
    const lines = sanitize(markdown).split("\n");
    let inCode = false;

    for (const raw of lines) {
      const line = raw.replace(/\t/g, "  ");
      const trimmed = line.trim();

      if (trimmed.startsWith("```")) {
        inCode = !inCode;
        y += 4;
        continue;
      }

      if (!trimmed) {
        y += 6;
        continue;
      }

      if (inCode) {
        const codeFont = 9;
        const codeLines = doc.splitTextToSize(line, width - 14) as string[];
        const lh = Math.round(codeFont * 1.45);
        const h = codeLines.length * lh + 10;
        ensureSpacePx(h + 4);
        setFillColor(COLORS.codeBg);
        doc.roundedRect(x, y - 8, width, h, 4, 4, "F");
        doc.setFontSize(codeFont);
        setTextColor(COLORS.codeText);
        doc.text(codeLines, x + 7, y + 2);
        setTextColor(COLORS.text);
        y += codeLines.length * lh + 6;
        continue;
      }

      const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const level = heading[1]!.length;
        const text = heading[2]!;
        const sizeMap: Record<number, number> = { 1: 16, 2: 14, 3: 13, 4: 12, 5: 11, 6: 10 };
        const size = sizeMap[level] ?? 11;
        y += level <= 2 ? 8 : 4;
        setTextColor(COLORS.title);
        writeWrapped(text, x, width, size, 1.4, { strong: true });
        setTextColor(COLORS.text);
        y += 4;
        continue;
      }

      if (/^---+$/.test(trimmed)) {
        ensureSpacePx(10);
        setDrawColor(COLORS.sectionStroke);
        doc.line(x, y, x + width, y);
        y += 10;
        continue;
      }

      const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
      if (unordered) {
        ensureSpacePx(16);
        doc.setFontSize(baseFontSize);
        doc.text("•", x + 2, y);
        writeRichWrapped(unordered[1]!, x + 14, width - 14, baseFontSize, 1.55);
        y += 3;
        continue;
      }

      const ordered = trimmed.match(/^(\d+)\.\s+(.+)$/);
      if (ordered) {
        const prefix = `${ordered[1]}. `;
        doc.setFontSize(baseFontSize);
        ensureSpacePx(16);
        doc.text(prefix, x + 1, y);
        writeRichWrapped(ordered[2]!, x + 18, width - 18, baseFontSize, 1.55);
        y += 3;
        continue;
      }

      const quote = trimmed.match(/^>\s+(.+)$/);
      if (quote) {
        const qText = quote[1]!;
        const quoteLines = doc.splitTextToSize(stripInlineMarkdown(qText), width - 20) as string[];
        const qFont = Math.max(10, baseFontSize - 1);
        const lh = Math.round(qFont * 1.5);
        const boxH = quoteLines.length * lh + 8;
        ensureSpacePx(boxH + 4);
        setFillColor(COLORS.quoteBg);
        doc.roundedRect(x, y - 8, width, boxH, 4, 4, "F");
        setDrawColor(COLORS.sectionStroke);
        doc.line(x + 6, y - 4, x + 6, y + boxH - 8);
        doc.setFontSize(qFont);
        setTextColor(COLORS.muted);
        doc.text(quoteLines, x + 12, y + 1);
        setTextColor(COLORS.text);
        y += quoteLines.length * lh + 6;
        continue;
      }

      writeRichWrapped(trimmed, x, width, baseFontSize, 1.6);
      y += 3;
    }
  }

  function roleColor(role: string): readonly [number, number, number] {
    if (role === "student") return COLORS.studentBg;
    if (role === "ai") return COLORS.aiBg;
    return COLORS.systemBg;
  }

  const outlineStep = getWorkflowStepByCapability(input, "outline")?.step;
  const peerOutlineStep = getWorkflowStepByCapability(input, "peer_outline")?.step;
  const outlineTitle = outlineStep !== undefined ? `${getWorkflowStepName(input, outlineStep)}原始輸入架構圖` : "原始輸入架構圖";
  const peerOutlineTitle = peerOutlineStep !== undefined ? `${getWorkflowStepName(input, peerOutlineStep)}修正後架構圖` : "修正後架構圖";

  function drawOutlineTree(kind: "submitted_outline" | "revised_outline", mermaidText: string): void {
    const preview = buildPrintableOutlinePreview(mermaidText);
    if (!preview) return;
    const title = kind === "submitted_outline" ? outlineTitle : peerOutlineTitle;
    doc.addPage("a4", "landscape");
    pageNo += 1;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageMargin = 30;
    const titleHeight = 38;
    const availableWidth = pageWidth - pageMargin * 2;
    const availableHeight = pageHeight - pageMargin * 2 - titleHeight;
    const scale = Math.min(1.15, availableWidth / preview.width, availableHeight / preview.height);
    const offsetX = (pageWidth - preview.width * scale) / 2;
    const offsetY = pageMargin + titleHeight + (availableHeight - preview.height * scale) / 2;

    setFillColor(COLORS.topBar);
    doc.rect(0, 0, pageWidth, 30, "F");
    doc.setFontSize(12);
    setFontStyle("bold");
    setTextColor([255, 255, 255]);
    doc.text(`LLM4Writing 課程實施報告 - ${title}`, pageMargin, 20);
    doc.setFontSize(9);
    doc.text(`第 ${pageNo} 頁`, pageWidth - pageMargin - 44, pageHeight - 14);
    setFontStyle("normal");
    setTextColor(COLORS.text);

    setDrawColor(COLORS.edge);
    doc.setLineWidth(2 * scale);
    for (const edge of preview.edges) {
      for (let index = 1; index < edge.points.length; index += 1) {
        const from = edge.points[index - 1]!;
        const to = edge.points[index]!;
        doc.line(offsetX + from.x * scale, offsetY + from.y * scale, offsetX + to.x * scale, offsetY + to.y * scale);
      }
    }

    for (const node of preview.nodes) {
      const width = (node.w ?? 180) * scale;
      const height = (node.h ?? 84) * scale;
      const x = offsetX + node.x * scale;
      const nodeY = offsetY + node.y * scale;
      setFillColor(COLORS.nodeFill);
      setDrawColor(COLORS.nodeStroke);
      doc.roundedRect(x, nodeY, width, height, 10 * scale, 10 * scale, "FD");
      doc.setFontSize(12 * scale);
      setFontStyle("normal");
      setTextColor(COLORS.title);
      const lines = node.lines && node.lines.length > 0 ? node.lines : node.text.split("\n");
      const textX = x + width / 2;
      const textY = nodeY + 18 * scale;
      lines.forEach((line, index) => doc.text(line, textX, textY + index * 16 * scale, { align: "center" }));
    }
    setFontStyle("normal");
    setTextColor(COLORS.text);
    y = PAGE.height;
  }

  function drawMessageCard(msg: PdfMessage, index: number): void {
    const header = `#${String(index).padStart(3, "0")} · ${formatRole(msg.role)} · ${formatTaipeiDateTime(msg.at)}`;
    const cardX = PAGE.marginX;
    const cardW = contentWidth;

    ensureSpacePx(44);

    setFillColor(roleColor(msg.role));
    setDrawColor(COLORS.sectionStroke);
    doc.roundedRect(cardX, y - 6, cardW, 28, 6, 6, "FD");

    doc.setFontSize(10);
    setTextColor(COLORS.muted);
    doc.text(header, cardX + 10, y + 12);
    setTextColor(COLORS.text);

    y += 30;
    const reportText = maskPeerUsernames(msg.text, input.username, input.privacyPeerUsernames);
    renderMarkdown(reportText, cardX + 8, cardW - 16, 11);
    y += 8;
  }

  async function renderTimeline(messages: PdfMessage[]): Promise<void> {
    writeSectionHeader("完整互動歷程");

    if (messages.length === 0) {
      renderMarkdown("目前沒有可輸出的互動紀錄。", PAGE.marginX, contentWidth, 11);
      return;
    }

    const step3Outline = sanitize(input.step3SubmittedOutline);
    const step4Outline = sanitize(input.step4RevisedOutline);
    const hasStep4Outline = step4Outline.length > 0;

    const timelineItems = buildCourseReportTimelineItems({
      messages,
      hasStep3Outline: Boolean(step3Outline) && outlineStep !== undefined,
      hasStep4Outline: hasStep4Outline && peerOutlineStep !== undefined,
      outlineStep,
      peerOutlineStep,
      workflowSteps: input.workflowSteps,
    });

    let insertedStep3 = false;
    let insertedStep4 = false;
    let messageIndex = 0;

    for (let i = 0; i < timelineItems.length; i += 1) {
      const item = timelineItems[i]!;
      const step = item.type === "outline" ? item.step : item.msg.step;
      const previous = timelineItems[i - 1];
      const previousStep = previous ? (previous.type === "outline" ? previous.step : previous.msg.step) : -1;
      if (step !== previousStep) {
        if (outlineStep !== undefined && step === outlineStep && step3Outline && !insertedStep3) {
          drawOutlineTree("submitted_outline", step3Outline);
          insertedStep3 = true;
        }
        if (peerOutlineStep !== undefined && step === peerOutlineStep && hasStep4Outline && !insertedStep4) {
          drawOutlineTree("revised_outline", step4Outline);
          insertedStep4 = true;
        }
        const hasMessageInStep = timelineItems.some((timelineItem) => timelineItem.type === "message" && timelineItem.msg.step === step);
        if (hasMessageInStep) {
          ensureSpacePx(34);
          setFillColor([226, 232, 240]);
          doc.roundedRect(PAGE.marginX, y - 4, contentWidth, 24, 5, 5, "F");
          doc.setFontSize(11);
          setTextColor(COLORS.title);
          const name = getWorkflowStepName(input, step);
          doc.text(`Step ${step}${name ? ` - ${name}` : ""}`, PAGE.marginX + 8, y + 12);
          setTextColor(COLORS.text);
          y += 30;
        }
      }

      if (item.type === "outline") {
        if (item.outlineKind === "submitted_outline" && step3Outline && !insertedStep3) {
          drawOutlineTree("submitted_outline", step3Outline);
          insertedStep3 = true;
        }
        if (item.outlineKind === "revised_outline" && hasStep4Outline && !insertedStep4) {
          drawOutlineTree("revised_outline", step4Outline);
          insertedStep4 = true;
        }
        continue;
      }

      const msg = item.msg;
      drawMessageCard(msg, messageIndex + 1);
      messageIndex += 1;
    }

    // Fallback placement in case outlines exist but step messages are absent.
    if (outlineStep !== undefined && step3Outline && !insertedStep3) {
      drawOutlineTree("submitted_outline", step3Outline);
    }
    if (peerOutlineStep !== undefined && hasStep4Outline && !insertedStep4) {
      drawOutlineTree("revised_outline", step4Outline);
    }
  }

  drawPageChrome();

  // Cover block
  ensureSpacePx(110);
  setFillColor([248, 250, 252]);
  setDrawColor(COLORS.sectionStroke);
  doc.roundedRect(PAGE.marginX, y - 8, contentWidth, 96, 10, 10, "FD");
  doc.setFontSize(20);
  setTextColor(COLORS.title);
  doc.text("課程實施報告", PAGE.marginX + 16, y + 20);
  doc.setFontSize(12);
  setTextColor(COLORS.muted);
  doc.text(`Version: ${COURSE_REPORT_VERSION}`, PAGE.marginX + 18, y + 42);
  setTextColor(COLORS.text);
  doc.setFontSize(11);
  doc.text(`產出時間：${formatTaipeiDateTime(input.generatedAtIso)}`, PAGE.marginX + 18, y + 62);
  const academicYear = input.academicYear || DEFAULT_ACADEMIC_YEAR;
  const academicYearTerm = input.academicYearTerm || DEFAULT_ACADEMIC_YEAR_TERM;
  doc.text(`${input.school} / ${input.classNumber} / ${academicYear} 學年第 ${academicYearTerm} 學期 / ${input.title}`, PAGE.marginX + 18, y + 80);
  y += 108;

  writeSectionHeader("學生摘要");
  renderMarkdown(
    [
      `- 學生帳號：${input.username}`,
      `- 學生姓名：${input.name}`,
      `- 班級：${input.classNumber}`,
      `- 校名：${input.school}`,
      `- 學年：${academicYear}`,
      `- 學期：第 ${academicYearTerm} 學期`,
      `- 課程 ID：${input.activityId}`,
      `- 完成課程日期時間：${input.completedAtIso ? formatTaipeiDateTime(input.completedAtIso) : "—"}`,
    ].join("\n"),
    PAGE.marginX,
    contentWidth,
    11
  );

  await renderTimeline(input.timelineMessages);

  writeSectionHeader("版本註記");
  renderMarkdown(
    [
      "> 本報告依系統記錄順序完整呈現學生與系統互動內容。",
      "- 本檔可作為學生個人留存版學習歷程。",
    ].join("\n"),
    PAGE.marginX,
    contentWidth,
    10
  );

  return doc.output("blob");
}

export async function generateCourseImplementationPdfBytes(input: CourseImplementationPdfInput): Promise<Uint8Array> {
  const blob = await generateCourseImplementationPdf(input);
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}
