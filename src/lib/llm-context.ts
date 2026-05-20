import { SessionState } from "@/src/lib/types";

type BuildStudentContextOptions = {
  maxMessages?: number;
  maxChars?: number;
  includeSystem?: boolean;
};

type StudentContextCacheEntry = {
  expiresAt: number;
  value: string;
};

const STUDENT_CONTEXT_CACHE_TTL_MS = 15_000;
const STUDENT_CONTEXT_CACHE_MAX_SIZE = 2000;
const RAW_RECENT_LINE_LIMIT = 12;
const studentContextCache = new Map<string, StudentContextCacheEntry>();

function pruneExpiredStudentContextCache(nowMs: number): void {
  for (const [key, entry] of studentContextCache) {
    if (entry.expiresAt <= nowMs) {
      studentContextCache.delete(key);
    }
  }
}

function enforceStudentContextCacheCap(): void {
  if (studentContextCache.size <= STUDENT_CONTEXT_CACHE_MAX_SIZE) return;
  const overflow = studentContextCache.size - STUDENT_CONTEXT_CACHE_MAX_SIZE;
  let removed = 0;
  for (const key of studentContextCache.keys()) {
    studentContextCache.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

function buildStudentContextCacheKey(
  session: SessionState,
  userId: string,
  currentStep: number,
  options: Required<BuildStudentContextOptions>
): string {
  const last = session.messages.at(-1);
  const lastSig = last
    ? `${last.id}|${last.at}|${last.step}|${last.role}|${last.userId ?? ""}|${last.text.length}`
    : "none";
  const participantsSig = (session.participants ?? []).join(",");
  const joinedSig = (session.joinedUsers ?? []).join(",");
  return [
    session.id,
    userId,
    currentStep,
    options.maxMessages,
    options.maxChars,
    options.includeSystem ? "1" : "0",
    session.messages.length,
    participantsSig,
    joinedSig,
    lastSig
  ].join("::");
}

function isNecessarySystemMessage(text: string): boolean {
  return /子步驟|步驟\s*\d+|下一題|個人反思完成|等待教師切換|已達最後階段|進入\s*Phase/i.test(text);
}

function cleanContextText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/[#>*`~_]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

function normalizeForDedup(text: string): string {
  return text
    .toLowerCase()
    .replace(/[，。！？、,.!?;:：；\s]/g, "")
    .trim();
}

function isLowInformationLine(text: string): boolean {
  if (!text) return true;
  if (text.length <= 6) return true;
  return /(收到|了解|謝謝|好的|ok|請繼續|繼續下一題|已收到本輪回覆|整理得很好)/i.test(text);
}

function pickUniqueSnippets(lines: string[], limit: number): string[] {
  const seen = new Set<string>();
  const picked: string[] = [];
  for (const line of lines) {
    const cleaned = cleanContextText(line);
    if (!cleaned || isLowInformationLine(cleaned)) continue;
    const key = normalizeForDedup(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    picked.push(cleaned);
    if (picked.length >= limit) break;
  }
  return picked;
}

function buildLayeredSummary(rawLines: string[]): string[] {
  const conclusionCandidates = rawLines.filter((line) => /(結論|總結|主張|因此|所以|重點|建議|可改進)/.test(line));
  const disputeCandidates = rawLines.filter((line) => /(但是|然而|不同意|爭議|衝突|疑慮|反對)/.test(line));
  const unresolvedCandidates = rawLines.filter((line) => /[？?]|(未|待|還需|下一步|補充|釐清|確認)/.test(line));

  const conclusions = pickUniqueSnippets(conclusionCandidates, 4);
  const disputes = pickUniqueSnippets(disputeCandidates, 3);
  const unresolved = pickUniqueSnippets(unresolvedCandidates, 3);

  const out: string[] = [];
  if (conclusions.length > 0) {
    out.push("[歷史摘要-結論]");
    conclusions.forEach((item, idx) => out.push(`${idx + 1}. ${item}`));
  }
  if (disputes.length > 0) {
    out.push("[歷史摘要-爭點]");
    disputes.forEach((item, idx) => out.push(`${idx + 1}. ${item}`));
  }
  if (unresolved.length > 0) {
    out.push("[歷史摘要-未解事項]");
    unresolved.forEach((item, idx) => out.push(`${idx + 1}. ${item}`));
  }
  return out;
}

function clampByChars(lines: string[], maxChars: number): string {
  let total = 0;
  const kept: string[] = [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]!;
    if (total + line.length + 1 > maxChars) break;
    kept.push(line);
    total += line.length + 1;
  }
  return kept.reverse().join("\n");
}

export function buildStudentCourseContext(
  session: SessionState,
  userId: string,
  currentStep: number,
  options: BuildStudentContextOptions = {}
): string {
  const resolved: Required<BuildStudentContextOptions> = {
    maxMessages: options.maxMessages ?? 40,
    maxChars: options.maxChars ?? 6000,
    includeSystem: options.includeSystem ?? true
  };
  const nowMs = Date.now();
  const cacheKey = buildStudentContextCacheKey(session, userId, currentStep, resolved);
  const cached = studentContextCache.get(cacheKey);
  if (cached && cached.expiresAt > nowMs) {
    return cached.value;
  }
  pruneExpiredStudentContextCache(nowMs);

  const participantSet = new Set(session.participants ?? []);
  const isGroupPhase = currentStep >= 1 && currentStep <= 4;

  const scoped = session.messages.filter((m) => {
    if (m.step > currentStep) return false;

    // Step 1-4: group phase, include all teammates' answers and AI/system records.
    if (isGroupPhase) {
      if (m.role === "student") return Boolean(m.userId && participantSet.has(m.userId));
      if (m.role === "ai") return !m.userId || participantSet.has(m.userId);
      if (m.role === "system") return resolved.includeSystem && (!m.userId || participantSet.has(m.userId)) && isNecessarySystemMessage(m.text);
      return false;
    }

    // Step 5+: keep shared memory from Step1-4, while Step5+ keeps only self history.
    if (m.step <= 4) {
      if (m.role === "student") return Boolean(m.userId && participantSet.has(m.userId));
      if (m.role === "ai") return !m.userId || participantSet.has(m.userId);
      if (m.role === "system") return resolved.includeSystem && (!m.userId || participantSet.has(m.userId)) && isNecessarySystemMessage(m.text);
      return false;
    }

    if (m.role === "student") return m.userId === userId;
    if (m.role === "ai") return !m.userId || m.userId === userId;
    if (m.role === "system") return resolved.includeSystem && (!m.userId || m.userId === userId) && isNecessarySystemMessage(m.text);
    return false;
  });

  const sliced = scoped.slice(-resolved.maxMessages);
  const lines = sliced.map((m) => {
    if (m.role === "student") return `S${m.step}-學生(${m.userId ?? userId})：${m.text}`;
    if (m.role === "ai") return `S${m.step}-AI${m.userId ? `(${m.userId})` : ""}：${m.text}`;
    return `S${m.step}-系統：${m.text}`;
  });

  const recentLimit = Math.min(RAW_RECENT_LINE_LIMIT, lines.length);
  const older = lines.slice(0, Math.max(0, lines.length - recentLimit));
  const recent = lines.slice(-recentLimit);

  const layeredSummary = buildLayeredSummary(older);
  const dedupedRecent = pickUniqueSnippets(recent, recent.length).map((item) => `[近期原文] ${item}`);
  const merged = [...layeredSummary, ...dedupedRecent];
  const built = clampByChars(merged, resolved.maxChars);
  studentContextCache.set(cacheKey, {
    expiresAt: nowMs + STUDENT_CONTEXT_CACHE_TTL_MS,
    value: built
  });
  enforceStudentContextCacheCap();
  return built;
}
