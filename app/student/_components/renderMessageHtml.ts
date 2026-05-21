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

export function renderMessageHtml(text: string): string {
  const normalizedText = stripOuterCodeFence(
    text
      .replace(/^\uFEFF/, "")
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "  ")
      .replace(/<br\s*\/?>/gi, "\n")
  );
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

    const heading = escaped.match(/^(#{1,4})\s*(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const content = heading[2];
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
