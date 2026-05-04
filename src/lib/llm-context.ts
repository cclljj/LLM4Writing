import { SessionState } from "@/src/lib/types";

type BuildStudentContextOptions = {
  maxMessages?: number;
  maxChars?: number;
  includeSystem?: boolean;
};

function isNecessarySystemMessage(text: string): boolean {
  return /子步驟|步驟\s*\d+|下一題|個人反思完成|等待教師切換|已達最後階段|進入\s*Phase/i.test(text);
}

export function buildStudentCourseContext(
  session: SessionState,
  userId: string,
  currentStep: number,
  options: BuildStudentContextOptions = {}
): string {
  const maxMessages = options.maxMessages ?? 40;
  const maxChars = options.maxChars ?? 6000;
  const includeSystem = options.includeSystem ?? true;

  const scoped = session.messages.filter((m) => {
    if (m.step > currentStep) return false;
    if (m.role === "student") return m.userId === userId;
    if (m.role === "ai") return m.userId === userId;
    if (m.role === "system") return includeSystem && (!m.userId || m.userId === userId) && isNecessarySystemMessage(m.text);
    return false;
  });

  const sliced = scoped.slice(-maxMessages);
  const lines = sliced.map((m) => {
    if (m.role === "student") return `S${m.step}-學生(${userId})：${m.text}`;
    if (m.role === "ai") return `S${m.step}-AI：${m.text}`;
    return `S${m.step}-系統：${m.text}`;
  });

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

