const HTML_BREAK_RE = /(?:<br\s*\/?>|&lt;br\s*\/?&gt;)/gi;
const SECTION_HEADING_WITH_BODY_RE = /^(#{1,6})\s+((?:\*\*|__).+?(?:\*\*|__))[\s:：,，、]*(\S.*)$/;
const KNOWN_REPORT_SECTION_TITLES = [
  "錯別字、格式與標點符號",
  "錯別字與標點符號",
  "我們討論了什麼",
  "我們學到了什麼",
  "讚美與鼓勵",
  "下一步補強",
  "建議回饋",
  "重點摘要",
  "結構組織",
  "遣詞造句",
  "立意取材",
  "總評語",
];

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
      if (inlineHeading) return [`${inlineHeading[1]} ${inlineHeading[2]}`, inlineHeading[3]!];

      const heading = line.trim().match(/^(#{1,6})\s+(.+)$/);
      if (!heading) return [line];
      const headingMarker = heading[1]!;
      const content = heading[2]!.trim();
      for (const title of KNOWN_REPORT_SECTION_TITLES) {
        const plainTitle = escapeRegExp(title);
        const titleMatch = content.match(new RegExp(`^(?:\\*\\*|__)?(${plainTitle})(?:\\*\\*|__)?[\\s:：,，、]*(\\S[\\s\\S]*)?$`));
        if (!titleMatch) continue;
        const body = titleMatch[2]?.trim();
        return body ? [`${headingMarker} ${title}`, body] : [`${headingMarker} ${title}`];
      }

      return [line];
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
