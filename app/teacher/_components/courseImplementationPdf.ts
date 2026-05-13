"use client";

import { jsPDF } from "jspdf";

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
  return text.replace(/\r\n/g, "\n").replace(/\t/g, " ").replace(/\u0000/g, "").trim();
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
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 42;
  const marginTop = 42;
  const marginBottom = 42;
  const contentWidth = pageWidth - marginX * 2;

  const fontBase64 = await loadFontBase64();
  if (!fontBase64) {
    throw new Error("pdf_font_load_failed");
  }
  doc.addFileToVFS(FONT_FILE_NAME, fontBase64);
  doc.addFont(FONT_FILE_NAME, FONT_FAMILY, "normal");
  doc.setFont(FONT_FAMILY, "normal");

  let y = marginTop;
  const lineHeight = 17;

  function ensureSpace(linesNeeded: number): void {
    const needed = linesNeeded * lineHeight;
    if (y + needed <= pageHeight - marginBottom) return;
    doc.addPage();
    doc.setFont(FONT_FAMILY, "normal");
    y = marginTop;
  }

  function writeTitle(text: string): void {
    ensureSpace(2);
    doc.setFontSize(16);
    doc.text(text, marginX, y);
    y += 26;
    doc.setFontSize(11);
  }

  function writeLabelValue(label: string, value: string): void {
    const row = `${label}：${value}`;
    const lines = doc.splitTextToSize(row, contentWidth) as string[];
    ensureSpace(lines.length + 1);
    doc.text(lines, marginX, y);
    y += lines.length * lineHeight;
  }

  function writeSection(title: string, rows: string[]): void {
    ensureSpace(3);
    y += 6;
    doc.setFontSize(13);
    doc.text(title, marginX, y);
    y += 18;
    doc.setFontSize(11);
    for (const row of rows) {
      const lines = doc.splitTextToSize(row, contentWidth - 12) as string[];
      ensureSpace(lines.length + 1);
      doc.text("•", marginX, y);
      doc.text(lines, marginX + 12, y);
      y += lines.length * lineHeight;
    }
  }

  function writeParagraph(text: string, indent = 0): void {
    const lines = doc.splitTextToSize(text, contentWidth - indent) as string[];
    ensureSpace(lines.length + 1);
    doc.text(lines, marginX + indent, y);
    y += lines.length * lineHeight;
  }

  function writeMessageTimeline(messages: PdfMessage[]): void {
    ensureSpace(3);
    y += 6;
    doc.setFontSize(13);
    doc.text("完整互動歷程（依系統順序）", marginX, y);
    y += 18;
    doc.setFontSize(11);

    if (messages.length === 0) {
      writeParagraph("目前沒有可輸出的互動紀錄。");
      return;
    }

    for (let i = 0; i < messages.length; i += 1) {
      const msg = messages[i]!;
      const seq = String(i + 1).padStart(3, "0");
      const header = `[${seq}] Step ${msg.step}${stepName(msg.step) ? ` ${stepName(msg.step)}` : ""} / ${formatRole(msg.role)} / ${new Date(msg.at).toLocaleString("zh-TW")}`;
      const body = sanitize(msg.text);

      const headerLines = doc.splitTextToSize(header, contentWidth) as string[];
      const bodyLines = doc.splitTextToSize(body || "（空白）", contentWidth - 10) as string[];
      ensureSpace(headerLines.length + bodyLines.length + 2);
      doc.text(headerLines, marginX, y);
      y += headerLines.length * lineHeight;
      doc.text(bodyLines, marginX + 10, y);
      y += bodyLines.length * lineHeight + 6;
    }
  }

  function writeOutlineSection(title: string, content: string): void {
    const trimmed = sanitize(content);
    if (!trimmed) return;
    ensureSpace(3);
    y += 6;
    doc.setFontSize(13);
    doc.text(title, marginX, y);
    y += 18;
    doc.setFontSize(11);
    writeParagraph(trimmed);
  }

  writeTitle("課程實施報告 PDF v1（學生個人）");

  writeLabelValue("產出時間", new Date(input.generatedAtIso).toLocaleString("zh-TW"));
  writeLabelValue("課程", `${input.activityId} / ${input.school} / ${input.classNumber} / ${input.title}`);
  writeLabelValue("學生", `${input.name}（${input.username}）`);

  writeSection("學生摘要", [
    `完成度星等：${input.starLabel}`,
    `目前步驟：${input.metric.stepText}`,
    `最高步驟：Step ${input.metric.maxStep}`,
    `互動訊息數（學生）：${input.metric.messageCount}`,
    `是否有加入紀錄：${input.metric.joined ? "是" : "否"}`,
  ]);

  writeSection("步驟進度與產出指標", [
    `Step3 結構樹字元數：${input.metric.step3OutlineChars}`,
    `Step6 初稿字元數：${input.metric.draftStep6Chars}`,
    `回答品質拒答次數：${input.metric.rejectedCount}`,
  ]);

  writeSection("星等依據", input.starRationales);

  writeOutlineSection("步驟三完成結構樹（全文）", input.step3SubmittedOutline);
  if (sanitize(input.step4RevisedOutline) && sanitize(input.step4RevisedOutline) !== sanitize(input.step3SubmittedOutline)) {
    writeOutlineSection("步驟四修正後結構樹（全文）", input.step4RevisedOutline);
  }

  writeMessageTimeline(input.timelineMessages);

  writeSection("版本註記", [
    "本檔為課程實施報告 PDF v1（完整歷程版），內容依系統中出現順序輸出。",
    "若後續新增圖表/附件，將於 v2 擴充。",
  ]);

  return doc.output("blob");
}
