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

export function renderMessageHtml(text: string): string {
  const lines = text.split(/\r?\n/);
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

    const h1 = escaped.match(/^#\s+(.+)$/);
    if (h1) {
      htmlParts.push(`<h2 style="margin:10px 0 6px;">${h1[1]}</h2>`);
      continue;
    }
    const h2 = escaped.match(/^##\s+(.+)$/);
    if (h2) {
      htmlParts.push(`<h3 style="margin:9px 0 5px;">${h2[1]}</h3>`);
      continue;
    }
    const h3 = escaped.match(/^###\s+(.+)$/);
    if (h3) {
      htmlParts.push(`<h4 style="margin:8px 0 4px;">${h3[1]}</h4>`);
      continue;
    }
    const h4 = escaped.match(/^####\s+(.+)$/);
    if (h4) {
      htmlParts.push(`<h5 style="margin:8px 0 4px;">${h4[1]}</h5>`);
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
