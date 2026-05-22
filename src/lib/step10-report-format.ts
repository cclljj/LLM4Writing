import { Step10ReportConfig, Step10ReportSectionConfig } from "@/src/lib/types";

const DEFAULT_STEP10_SECTIONS: Step10ReportSectionConfig[] = [
  {
    id: "content",
    title: "立意取材",
    focus: "切題性、材料運用、主旨凸顯情況",
    instruction: "說明學生如何取材、是否扣合題目、主旨是否明確，並提供下一步改善方向。"
  },
  {
    id: "organization",
    title: "結構組織",
    focus: "結構完整性、段落分明、前後連貫性",
    instruction: "說明文章架構、段落安排、轉折連貫性，並提供可操作的調整建議。"
  },
  {
    id: "wording",
    title: "遣詞造句",
    focus: "詞語精確度、句型多樣性與流暢性",
    instruction: "說明語詞、句型、語氣與表達清楚程度，並提供不代寫的修正方向。"
  },
  {
    id: "mechanics",
    title: "錯別字、格式與標點符號",
    focus: "錯別字、標點符號、格式規範",
    instruction: "說明錯別字、標點、段落格式與書寫規範，並提醒可檢查的重點。"
  },
  {
    id: "overall",
    title: "總評語",
    focus: "整體表現、成長重點、後續建議",
    instruction: "綜合學生在課程中的成長，給予鼓勵性總結與後續寫作練習建議。"
  }
];

const DEFAULT_SECTION_PROMPT_TEMPLATE =
  "你正在撰寫「{{title}}」這一節。聚焦：{{focus}}。任務：{{instruction}} 請只輸出本節內文，不要輸出標題、Markdown、粗體、清單符號，也不要輸出其他向度。語氣溫和、白話、具體，禁止代寫。";

export function resolveStep10ReportConfig(config?: Step10ReportConfig): Required<Step10ReportConfig> {
  const sections = Array.isArray(config?.sections) && config.sections.length > 0
    ? config.sections.filter((section) => section.title?.trim())
    : DEFAULT_STEP10_SECTIONS;
  return {
    sections: sections.length > 0 ? sections : DEFAULT_STEP10_SECTIONS,
    baseInstruction:
      config?.baseInstruction?.trim() ||
      "你是國中會考寫作閱卷視角的回饋者。請使用台灣繁體中文、白話、具體。僅提供總結與建議，禁止代寫段落或全文。回饋需對應指定向度並提供下一步修正重點。",
    sectionPromptTemplate: config?.sectionPromptTemplate?.trim() || DEFAULT_SECTION_PROMPT_TEMPLATE,
    finalPolishPrompt:
      config?.finalPolishPrompt?.trim() ||
      "以下是分段草稿，請檢查是否有重複句段或不完整句子，必要時只做順句潤飾。不得新增 Markdown 標題，不得加入粗體符號，不得提到截斷或續寫過程，每句要完整收尾。",
    completionReminder:
      config?.completionReminder?.trim() ||
      "恭喜你完成本次作文引導課程！請把這次學到的拆題、取材、組織與修正方法，帶到下一次寫作中。"
  };
}

function normalizeTitleKey(text: string): string {
  return normalizeStep10SectionTitle(text).replace(/\s+/g, "");
}

export function normalizeStep10SectionTitle(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:markdown)?\s*/i, "")
    .replace(/```$/g, "")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/^\s*[\d一二三四五六七八九十]+[.)、．]\s*/, "")
    .replace(/^(?:#{1,6}\s*)+/, "")
    .replace(/^\s*[\d一二三四五六七八九十]+[.)、．]\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/^["'「『]+|["'」』]+$/g, "")
    .replace(/[：:]\s*$/g, "")
    .trim();
}

export function parseStep10SectionTitles(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map(normalizeStep10SectionTitle)
    .filter((line) => line.length > 0);
  const deduped = Array.from(new Set(lines));
  return deduped.slice(0, 4);
}

export function stripLeadingStep10SectionHeading(sectionText: string, title: string): string {
  const lines = sectionText.split(/\r?\n/);
  const titleKey = normalizeTitleKey(title);
  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentIndex === -1) return sectionText.trim();

  const firstLine = lines[firstContentIndex]!;
  if (normalizeTitleKey(firstLine) !== titleKey) return sectionText.trim();

  lines.splice(firstContentIndex, 1);
  return lines.join("\n").trim();
}

export function buildStep10SectionPrompt(
  template: string,
  section: Step10ReportSectionConfig
): string {
  return template
    .replaceAll("{{id}}", section.id ?? "")
    .replaceAll("{{title}}", section.title)
    .replaceAll("{{focus}}", section.focus ?? "")
    .replaceAll("{{instruction}}", section.instruction ?? "");
}

function splitHeadingAndRemainder(line: string): { title: string; remainder: string } | null {
  const normalized = line
    .trim()
    .replace(/^(?:#{1,6}\s*)+/, "")
    .replace(/^\s*[-*]\s+/, "")
    .trim();
  const bold = normalized.match(/^(?:\*\*|__)(.+?)(?:\*\*|__)\s*(.*)$/);
  if (bold) {
    return { title: normalizeStep10SectionTitle(bold[1] ?? ""), remainder: (bold[2] ?? "").trim() };
  }
  const plain = normalized.match(/^([^：:]{2,30})[：:]\s*(.*)$/);
  if (plain) {
    return { title: normalizeStep10SectionTitle(plain[1] ?? ""), remainder: (plain[2] ?? "").trim() };
  }
  if (/^(?:#{1,6}\s*)/.test(line.trim())) {
    return { title: normalizeStep10SectionTitle(line), remainder: "" };
  }
  return null;
}

export function normalizeStep10SectionBody(
  sectionText: string,
  currentTitle: string,
  allTitles: string[]
): string {
  const currentKey = normalizeTitleKey(currentTitle);
  const otherKeys = new Set(allTitles.filter((title) => normalizeTitleKey(title) !== currentKey).map(normalizeTitleKey));
  otherKeys.add(normalizeTitleKey("課程完成提醒"));
  const kept: string[] = [];
  for (const rawLine of sectionText.split(/\r?\n/)) {
    const parsed = splitHeadingAndRemainder(rawLine);
    if (parsed) {
      const key = normalizeTitleKey(parsed.title);
      if (otherKeys.has(key)) break;
      if (key === currentKey) {
        if (parsed.remainder) kept.push(parsed.remainder);
        continue;
      }
    }
    kept.push(rawLine.replace(/\*\*/g, "").replace(/__/g, ""));
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function composeStep10Report(
  sections: Array<{ title: string; body: string }>,
  completionReminder?: string
): string {
  const report = sections
    .filter((section) => section.title.trim() && section.body.trim())
    .map((section) => `## ${normalizeStep10SectionTitle(section.title)}\n${section.body.trim()}`)
    .join("\n\n");
  const reminder = completionReminder?.trim();
  return reminder ? `${report}\n\n## 課程完成提醒\n${reminder}` : report;
}
