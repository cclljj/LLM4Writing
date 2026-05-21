function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function applyInlineMarkdown(input: string): string {
  return input
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>");
}

function stripOuterCodeFence(input: string): string {
  const lines = input.split(/\r?\n/);
  if (lines.length < 3) return input;
  const first = lines[0]?.trim() ?? "";
  const last = lines[lines.length - 1]?.trim() ?? "";
  if (!first.startsWith("```") || last !== "```") return input;
  return lines.slice(1, -1).join("\n");
}

function hasMarkdownSignal(text: string): boolean {
  return /(^|\n)\s*(#{1,6}\s*|[-*]\s+|\d+\.\s+|>\s+)/.test(text) || text.includes("\\n");
}

function pickRenderableText(candidates: string[]): string | null {
  if (candidates.length === 0) return null;
  const scored = candidates
    .map((text) => ({
      text,
      score: (hasMarkdownSignal(text) ? 10_000 : 0) + text.length
    }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.text ?? null;
}

function readRenderableJsonValue(value: unknown, depth = 0): string | null {
  if (depth > 5) return null;
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    return pickRenderableText(value.map((item) => readRenderableJsonValue(item, depth + 1)).filter((item): item is string => Boolean(item)));
  }
  const record = value as Record<string, unknown>;
  const directKeys = ["report", "step10Report", "summary", "content", "text", "feedback", "message", "output_text"];
  for (const key of directKeys) {
    if (typeof record[key] === "string") return record[key];
  }
  const recursiveKeys = [...directKeys, "parts"];
  for (const key of recursiveKeys) {
    const nested = readRenderableJsonValue(record[key], depth + 1);
    if (nested) return nested;
  }

  const openAiContent = (record.choices as Array<{ message?: { content?: unknown }; text?: unknown }> | undefined)?.[0];
  const openAiText = readRenderableJsonValue(openAiContent?.message?.content ?? openAiContent?.text, depth + 1);
  if (openAiText) return openAiText;

  const geminiPart = (record.candidates as Array<{ content?: { parts?: unknown[] } }> | undefined)?.[0]?.content?.parts;
  const geminiText = readRenderableJsonValue(geminiPart, depth + 1);
  if (geminiText) return geminiText;

  for (const key of ["data", "result", "response", "output"]) {
    const nested = readRenderableJsonValue(record[key], depth + 1);
    if (nested) return nested;
  }
  return null;
}

function decodeMarkdownMarkerEntities(input: string): string {
  return input
    .replace(/&num;|&#35;|&#x23;/gi, "#")
    .replace(/&ast;|&#42;|&#x2a;/gi, "*")
    .replace(/&hyphen;|&#45;|&#x2d;/gi, "-");
}

function unwrapRenderableText(input: string): string {
  let current = decodeMarkdownMarkerEntities(input.trim());
  for (let round = 0; round < 3; round += 1) {
    const fenced = stripOuterCodeFence(current).trim();
    if (fenced !== current) {
      current = fenced;
      continue;
    }

    if (
      (current.startsWith('"') && current.endsWith('"')) ||
      (current.startsWith("{") && current.endsWith("}"))
    ) {
      try {
        const parsed = JSON.parse(current) as unknown;
        const value = readRenderableJsonValue(parsed);
        if (value && value.trim() !== current) {
          current = value.trim();
          continue;
        }
      } catch {
        // Fall through to escaped text normalization below.
      }
    }

    const unescaped = decodeMarkdownMarkerEntities(current)
      .replace(/\\u000d\\u000a/g, "\n")
      .replace(/\\u000a/g, "\n")
      .replace(/\\u0009/g, "  ")
      .replace(/\\\\r\\\\n/g, "\n")
      .replace(/\\\\n/g, "\n")
      .replace(/\\\\t/g, "  ")
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "  ")
      .trim();
    if (unescaped === current) return current;
    current = unescaped;
  }
  return current;
}

export function renderMessageHtml(text: string): string {
  const normalizedText = unwrapRenderableText(text.replace(/^\uFEFF/, "").replace(/<br\s*\/?>/gi, "\n"));
  const lines = normalizedText.split(/\r?\n/);
  const htmlParts: string[] = [];
  let unorderedListBuffer: string[] = [];
  let orderedListBuffer: string[] = [];

  const flushLists = () => {
    if (unorderedListBuffer.length > 0) {
      htmlParts.push(`<ul>${unorderedListBuffer.join("")}</ul>`);
      unorderedListBuffer = [];
    }
    if (orderedListBuffer.length > 0) {
      htmlParts.push(`<ol>${orderedListBuffer.join("")}</ol>`);
      orderedListBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushLists();
      continue;
    }

    const inlineHeading = line.match(/^(#{1,6})\s+(?:\*\*|__)(.+?)(?:\*\*|__)(\S.*)$/);
    if (inlineHeading) {
      flushLists();
      const level = Math.min(4, inlineHeading[1]!.length);
      const title = escapeHtml(inlineHeading[2]!.trim());
      const body = applyInlineMarkdown(escapeHtml(inlineHeading[3]!.trim()));
      if (level === 1) htmlParts.push(`<h2 style="margin:10px 0 6px;">${title}</h2>`);
      if (level === 2) htmlParts.push(`<h3 style="margin:9px 0 5px;">${title}</h3>`);
      if (level === 3) htmlParts.push(`<h4 style="margin:8px 0 4px;">${title}</h4>`);
      if (level === 4) htmlParts.push(`<h5 style="margin:8px 0 4px;">${title}</h5>`);
      htmlParts.push(`<p style="margin:6px 0;">${body}</p>`);
      continue;
    }

    const escaped = applyInlineMarkdown(escapeHtml(line));
    if (escaped.startsWith("- ") || escaped.startsWith("* ")) {
      orderedListBuffer = [];
      unorderedListBuffer.push(`<li>${escaped.slice(2)}</li>`);
      continue;
    }
    const ordered = escaped.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      unorderedListBuffer = [];
      orderedListBuffer.push(`<li>${ordered[1]}</li>`);
      continue;
    }

    flushLists();

    const heading = escaped.match(/^((?:#{1,6}\s*)+)(.+)$/);
    if (heading) {
      const headingMarkers = heading[1].match(/#{1,6}/g) ?? ["#"];
      const level = Math.min(4, headingMarkers[headingMarkers.length - 1]!.length);
      const content = heading[2].replace(/^#{1,6}\s*/, "").trim();
      if (level === 1) htmlParts.push(`<h2 style="margin:10px 0 6px;">${content}</h2>`);
      if (level === 2) htmlParts.push(`<h3 style="margin:9px 0 5px;">${content}</h3>`);
      if (level === 3) htmlParts.push(`<h4 style="margin:8px 0 4px;">${content}</h4>`);
      if (level === 4) htmlParts.push(`<h5 style="margin:8px 0 4px;">${content}</h5>`);
      continue;
    }
    const quote = escaped.match(/^>\s?(.+)$/);
    if (quote) {
      htmlParts.push(`<blockquote style="margin:6px 0; padding-left:10px; border-left:3px solid #cbd5e1;">${quote[1]}</blockquote>`);
      continue;
    }

    htmlParts.push(`<p style="margin:6px 0;">${escaped}</p>`);
  }

  flushLists();
  return htmlParts.join("");
}
