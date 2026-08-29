const HTML_BREAK_RE = /(?:<br\s*\/?>|&lt;br\s*\/?&gt;)/gi;
const SECTION_HEADING_WITH_BODY_RE = /^(#{1,6})\s+((?:\*\*|__).+?(?:\*\*|__))[\s:：,，、]*(\S.*)$/;

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeReportMarkdownText(input: string): string {
  return (input ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(HTML_BREAK_RE, "\n")
    .replace(/\t/g, "  ")
    .replace(/\u0000/g, "")
    .split("\n")
    .flatMap((rawLine) => {
      const line = rawLine.trimEnd();
      const inlineHeading = line.trim().match(SECTION_HEADING_WITH_BODY_RE);
      if (!inlineHeading) return [line];
      return [`${inlineHeading[1]} ${inlineHeading[2]}`, inlineHeading[3]!];
    })
    .join("\n")
    .trim();
}

export function maskPeerUsernames(
  text: string,
  currentUsername: string | undefined,
  peerUsernames: readonly string[] = []
): string {
  const peers = Array.from(
    new Set(peerUsernames.filter((username) => username && username !== currentUsername).sort((a, b) => b.length - a.length))
  );
  if (peers.length === 0) return text;
  let masked = text;
  for (const peer of peers) {
    masked = masked.replace(new RegExp(escapeRegExp(peer), "g"), "有一位組員");
  }
  return masked;
}
