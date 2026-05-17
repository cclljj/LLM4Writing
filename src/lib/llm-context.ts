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

  let total = 0;
  const kept: string[] = [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]!;
    if (total + line.length + 1 > resolved.maxChars) break;
    kept.push(line);
    total += line.length + 1;
  }
  const built = kept.reverse().join("\n");
  studentContextCache.set(cacheKey, {
    expiresAt: nowMs + STUDENT_CONTEXT_CACHE_TTL_MS,
    value: built
  });
  enforceStudentContextCacheCap();
  return built;
}
