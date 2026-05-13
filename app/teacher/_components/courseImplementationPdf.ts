"use client";

import { jsPDF } from "jspdf";
import { buildOutlinePreview } from "@/src/lib/outline-utils";

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
  title: string;
  username: string;
  name: string;
  metric: PdfStudentMetric;
  starLabel: string;
  starRationales: string[];
  timelineMessages: PdfMessage[];
  step3SubmittedOutline: string;
  step4RevisedOutline: string;
  generatedAtIso: string;
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
  return (text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/\u0000/g, "")
    .trim();
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
}

function formatRole(role: string): string {
  if (role === "student") return "學生";
  if (role === "ai") return "AI";
  if (role === "system") return "系統";
  return role || "未知";
}

function stepName(step: number): string {
  const names: Record<number, string> = {
    1: "審視題目",
    2: "蒐集資料",
    3: "生成論點",
    4: "對比修正",
    5: "摘要報告",
    6: "撰寫初稿",
    7: "分析回饋",
    8: "修改潤飾",
    9: "個人反思",
    10: "總結報告",
  };
  return names[step] ?? "";
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
    setTextColor(COLORS.muted);
    doc.text(`LLM4Writing 課程實施報告`, PAGE.marginX, 26);
    doc.text(`第 ${pageNo} 頁`, PAGE.width - PAGE.marginX - 48, PAGE.height - 18);
    setTextColor(COLORS.text);
  }

  function newPage(): void {
    doc.addPage();
    pageNo += 1;
    y = PAGE.marginTop;
    drawPageChrome();
  }

  function ensureSpacePx(heightPx: number): void {
    if (y + heightPx <= PAGE.height - PAGE.marginBottom) return;
    newPage();
  }

  function writeWrapped(text: string, x: number, width: number, fontSize = 11, lineHeight = 1.55): number {
    doc.setFontSize(fontSize);
    const normalized = stripInlineMarkdown(text);
    const lines = doc.splitTextToSize(normalized || "（空白）", width) as string[];
    const lh = Math.round(fontSize * lineHeight);
    ensureSpacePx(lines.length * lh + 4);
    doc.text(lines, x, y);
    const consumed = lines.length * lh;
    y += consumed;
    return consumed;
  }

  function writeSectionHeader(title: string): void {
    ensureSpacePx(34);
    setFillColor(COLORS.sectionBg);
    setDrawColor(COLORS.sectionStroke);
    doc.roundedRect(PAGE.marginX, y, contentWidth, 26, 6, 6, "FD");
    doc.setFontSize(12);
    setTextColor(COLORS.title);
    doc.text(title, PAGE.marginX + 10, y + 17);
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
        writeWrapped(text, x, width, size, 1.4);
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
        writeWrapped(unordered[1]!, x + 14, width - 14, baseFontSize, 1.55);
        y += 3;
        continue;
      }

      const ordered = trimmed.match(/^(\d+)\.\s+(.+)$/);
      if (ordered) {
        const prefix = `${ordered[1]}. `;
        doc.setFontSize(baseFontSize);
        ensureSpacePx(16);
        doc.text(prefix, x + 1, y);
        writeWrapped(ordered[2]!, x + 18, width - 18, baseFontSize, 1.55);
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

      writeWrapped(trimmed, x, width, baseFontSize, 1.6);
      y += 3;
    }
  }

  function roleColor(role: string): readonly [number, number, number] {
    if (role === "student") return COLORS.studentBg;
    if (role === "ai") return COLORS.aiBg;
    return COLORS.systemBg;
  }

  function drawOutlineGraph(step: 3 | 4, mermaidText: string): void {
    const preview = buildOutlinePreview(mermaidText);
    if (!preview) return;

    const title = step === 3 ? "步驟三完成結構樹（圖形）" : "步驟四修正後結構樹（圖形）";
    writeSectionHeader(title);

    const graphScale = Math.min((contentWidth - 24) / preview.width, 1);
    const graphW = preview.width * graphScale;
    const graphH = preview.height * graphScale;
    const boxX = PAGE.marginX + (contentWidth - graphW) / 2;

    ensureSpacePx(graphH + 18);
    setFillColor([248, 250, 252]);
    setDrawColor(COLORS.sectionStroke);
    doc.roundedRect(PAGE.marginX, y - 6, contentWidth, graphH + 12, 8, 8, "FD");

    const nodeW = 130 * graphScale;
    const nodeH = 80 * graphScale;
    const centerX = nodeW / 2;
    const edgeY = nodeH / 2;

    const nodeMap = new Map(preview.nodes.map((n) => [n.id, n]));

    setDrawColor(COLORS.edge);
    doc.setLineWidth(1.2);
    preview.nodes
      .filter((n) => n.parentId)
      .forEach((node) => {
        const parent = node.parentId ? nodeMap.get(node.parentId) : null;
        if (!parent) return;
        doc.line(
          boxX + (parent.x + centerX),
          y + (parent.y + edgeY),
          boxX + (node.x + centerX),
          y + node.y
        );
      });

    preview.nodes.forEach((node) => {
      setFillColor(COLORS.nodeFill);
      setDrawColor(COLORS.nodeStroke);
      doc.roundedRect(boxX + node.x, y + node.y, nodeW, nodeH, 8, 8, "FD");

      const textMaxWidth = nodeW - 12;
      const lines = doc.splitTextToSize(stripInlineMarkdown(node.text), textMaxWidth) as string[];
      const clipped = lines.length > 4 ? [...lines.slice(0, 3), `${lines[3]}...`] : lines;
      doc.setFontSize(Math.max(8, 11 * graphScale));
      setTextColor(COLORS.title);
      doc.text(clipped, boxX + node.x + 6, y + node.y + 16);
      setTextColor(COLORS.text);
    });

    y += graphH + 18;
  }

  function drawMessageCard(msg: PdfMessage, index: number): void {
    const header = `#${String(index).padStart(3, "0")} · ${formatRole(msg.role)} · ${new Date(msg.at).toLocaleString("zh-TW")}`;
    const cardX = PAGE.marginX;
    const cardW = contentWidth;

    const messageLines = Math.max(1, Math.ceil(sanitize(msg.text).length / 42));
    const estimatedHeight = 34 + messageLines * 18;
    ensureSpacePx(estimatedHeight + 12);

    setFillColor(roleColor(msg.role));
    setDrawColor(COLORS.sectionStroke);
    doc.roundedRect(cardX, y - 6, cardW, 28, 6, 6, "FD");

    doc.setFontSize(10);
    setTextColor(COLORS.muted);
    doc.text(header, cardX + 10, y + 12);
    setTextColor(COLORS.text);

    y += 30;
    renderMarkdown(msg.text, cardX + 8, cardW - 16, 11);
    y += 8;
  }

  function renderTimeline(messages: PdfMessage[]): void {
    writeSectionHeader("完整互動歷程（依系統順序，Markdown 排版）");

    if (messages.length === 0) {
      renderMarkdown("目前沒有可輸出的互動紀錄。", PAGE.marginX, contentWidth, 11);
      return;
    }

    const step3Outline = sanitize(input.step3SubmittedOutline);
    const step4Outline = sanitize(input.step4RevisedOutline);
    const hasStep4Outline = step4Outline.length > 0 && step4Outline !== step3Outline;

    let currentStep = -1;
    let insertedStep3 = false;
    let insertedStep4 = false;

    for (let i = 0; i < messages.length; i += 1) {
      const msg = messages[i]!;
      if (msg.step !== currentStep) {
        currentStep = msg.step;
        ensureSpacePx(34);
        setFillColor([226, 232, 240]);
        doc.roundedRect(PAGE.marginX, y - 4, contentWidth, 24, 5, 5, "F");
        doc.setFontSize(11);
        setTextColor(COLORS.title);
        doc.text(`Step ${msg.step}${stepName(msg.step) ? ` - ${stepName(msg.step)}` : ""}`, PAGE.marginX + 8, y + 12);
        setTextColor(COLORS.text);
        y += 30;

        if (msg.step === 3 && step3Outline && !insertedStep3) {
          drawOutlineGraph(3, step3Outline);
          insertedStep3 = true;
        }
        if (msg.step === 4 && hasStep4Outline && !insertedStep4) {
          drawOutlineGraph(4, step4Outline);
          insertedStep4 = true;
        }
      }
      drawMessageCard(msg, i + 1);
    }

    // Fallback placement in case outlines exist but step messages are absent.
    if (step3Outline && !insertedStep3) {
      drawOutlineGraph(3, step3Outline);
    }
    if (hasStep4Outline && !insertedStep4) {
      drawOutlineGraph(4, step4Outline);
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
  doc.text("Student Portfolio PDF v1", PAGE.marginX + 18, y + 42);
  setTextColor(COLORS.text);
  doc.setFontSize(11);
  doc.text(`產出時間：${new Date(input.generatedAtIso).toLocaleString("zh-TW")}`, PAGE.marginX + 18, y + 62);
  doc.text(`${input.school} / ${input.classNumber} / ${input.title}`, PAGE.marginX + 18, y + 80);
  y += 108;

  writeSectionHeader("學生摘要");
  renderMarkdown(
    [
      `### ${input.name}（${input.username}）`,
      `- 課程 ID：${input.activityId}`,
      `- 完成度星等：${input.starLabel}`,
      `- 目前步驟：${input.metric.stepText}`,
      `- 最高步驟：Step ${input.metric.maxStep}`,
      `- 互動訊息數（學生）：${input.metric.messageCount}`,
      `- 是否有加入紀錄：${input.metric.joined ? "是" : "否"}`,
    ].join("\n"),
    PAGE.marginX,
    contentWidth,
    11
  );

  writeSectionHeader("步驟進度與產出指標");
  renderMarkdown(
    [
      `- Step3 結構樹字元數：${input.metric.step3OutlineChars}`,
      `- Step6 初稿字元數：${input.metric.draftStep6Chars}`,
      `- 回答品質拒答次數：${input.metric.rejectedCount}`,
    ].join("\n"),
    PAGE.marginX,
    contentWidth,
    11
  );

  writeSectionHeader("星等依據");
  renderMarkdown(
    input.starRationales.map((reason, idx) => `${idx + 1}. ${reason}`).join("\n"),
    PAGE.marginX,
    contentWidth,
    11
  );

  renderTimeline(input.timelineMessages);

  writeSectionHeader("版本註記");
  renderMarkdown(
    [
      "> 本報告依系統記錄順序完整呈現學生與系統互動內容。",
      "- 本檔可作為學生個人留存版學習歷程。",
      "- 若需跨學生比較，請使用教師端課程實施報告清單。",
    ].join("\n"),
    PAGE.marginX,
    contentWidth,
    10
  );

  return doc.output("blob");
}
