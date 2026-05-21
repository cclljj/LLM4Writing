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
