import { QualitySignals } from "@/src/lib/types";

export type { QualitySignals };

export type DiagnosticMessage = {
  role: string;
  userId?: string;
  text: string;
  at: string;
  step: number;
};

export type ArtifactDiagnostics = {
  step3OutlineChars?: Record<string, number>;
  step3OutlineUpdatedAt?: Record<string, string>;
  draftStep6Chars?: Record<string, number>;
  draftStep6UpdatedAt?: Record<string, string>;
};

export type DiagnosticSession = {
  currentStep: number;
  participants: string[];
  groupGate?: Record<string, string[]>;
  personalSteps?: Record<string, number>;
  stepState?: {
    step1Substep: number;
    step2Substep: number;
    step1Substep3Question?: number;
    step1Substep4Question?: number;
    step2Substep1Question?: number;
  };
  messages: DiagnosticMessage[];
  qualitySignals?: QualitySignals;
  artifactDiagnostics?: ArtifactDiagnostics;
};

export type AdvancedStuckRisk = {
  level: "ok" | "watch" | "stuck";
  text: string;
  pendingMembers: string[];
  affectedUsers: string[];
  reasons: string[];
  suggestions: string[];
  minutesSinceLastEvent: number | null;
};

type RejectionSignal = {
  userId: string;
  scope: string;
  count: number;
  lastAt?: string;
};

const IDLE_STUCK_MINUTES = 10;
const OUTLINE_MIN_CHARS = 20;
const DRAFT6_MIN_CHARS = 80;

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function addUnique(target: string[], value: string): void {
  if (!target.includes(value)) target.push(value);
}

function escalate(current: AdvancedStuckRisk["level"], next: AdvancedStuckRisk["level"]): AdvancedStuckRisk["level"] {
  const rank = { ok: 0, watch: 1, stuck: 2 } as const;
  return rank[next] > rank[current] ? next : current;
}

function parseRejectionKey(key: string): { userId: string; scope: string } | null {
  const [userId, ...rest] = key.split("::");
  if (!userId || rest.length === 0) return null;
  return { userId, scope: rest.join("::") };
}

export function getDiagnosticGateKey(session: DiagnosticSession): string | null {
  if (session.currentStep === 1) {
    const sub = session.stepState?.step1Substep ?? 1;
    if (sub === 3) return `1-3-${session.stepState?.step1Substep3Question ?? 1}`;
    if (sub === 4) return `1-4-${session.stepState?.step1Substep4Question ?? 1}`;
    return `1-${sub}`;
  }
  if (session.currentStep === 2) {
    const sub = session.stepState?.step2Substep ?? 1;
    if (sub === 1) return `2-1-${session.stepState?.step2Substep1Question ?? 1}`;
    return `2-${sub}`;
  }
  if (session.currentStep === 3) return "3-complete";
  if (session.currentStep === 4) return "4-complete";
  return null;
}

export function getSessionLastEventAt(session: DiagnosticSession): Date | null {
  const latest = session.messages
    .map((message) => new Date(message.at).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => b - a)[0];
  return typeof latest === "number" ? new Date(latest) : null;
}

export function recordRejectedAnswerSignal(session: { qualitySignals?: QualitySignals }, userId: string, scope: string, at = new Date().toISOString()): void {
  if (!session.qualitySignals || typeof session.qualitySignals !== "object") {
    session.qualitySignals = {};
  }
  if (!session.qualitySignals.rejectedAnswerCounts || typeof session.qualitySignals.rejectedAnswerCounts !== "object") {
    session.qualitySignals.rejectedAnswerCounts = {};
  }
  if (!session.qualitySignals.rejectedAnswerLastAt || typeof session.qualitySignals.rejectedAnswerLastAt !== "object") {
    session.qualitySignals.rejectedAnswerLastAt = {};
  }
  const key = `${userId}::${scope}`;
  session.qualitySignals.rejectedAnswerCounts[key] = (session.qualitySignals.rejectedAnswerCounts[key] ?? 0) + 1;
  session.qualitySignals.rejectedAnswerLastAt[key] = at;
}

export function recordArtifactUpdateSignal(
  session: {
    artifactSignals?: {
      outlineUpdatedAt?: Record<string, string>;
      draftStep6UpdatedAt?: Record<string, string>;
      draftStep8UpdatedAt?: Record<string, string>;
    };
  },
  type: "outline" | "draft6" | "draft8",
  userId: string,
  at = new Date().toISOString()
): void {
  if (!session.artifactSignals || typeof session.artifactSignals !== "object") {
    session.artifactSignals = { outlineUpdatedAt: {}, draftStep6UpdatedAt: {}, draftStep8UpdatedAt: {} };
  }
  if (!session.artifactSignals.outlineUpdatedAt || typeof session.artifactSignals.outlineUpdatedAt !== "object") {
    session.artifactSignals.outlineUpdatedAt = {};
  }
  if (!session.artifactSignals.draftStep6UpdatedAt || typeof session.artifactSignals.draftStep6UpdatedAt !== "object") {
    session.artifactSignals.draftStep6UpdatedAt = {};
  }
  if (!session.artifactSignals.draftStep8UpdatedAt || typeof session.artifactSignals.draftStep8UpdatedAt !== "object") {
    session.artifactSignals.draftStep8UpdatedAt = {};
  }
  if (type === "outline") session.artifactSignals.outlineUpdatedAt[userId] = at;
  if (type === "draft6") session.artifactSignals.draftStep6UpdatedAt[userId] = at;
  if (type === "draft8") session.artifactSignals.draftStep8UpdatedAt[userId] = at;
}

export function getRepeatedRejectionSignals(session: DiagnosticSession): RejectionSignal[] {
  const counts = session.qualitySignals?.rejectedAnswerCounts ?? {};
  const lastAt = session.qualitySignals?.rejectedAnswerLastAt ?? {};
  return Object.entries(counts)
    .flatMap(([key, count]) => {
      const parsed = parseRejectionKey(key);
      if (!parsed || count < 2) return [];
      return [{ userId: parsed.userId, scope: parsed.scope, count, lastAt: lastAt[key] }];
    })
    .sort((a, b) => b.count - a.count);
}

export function buildAdvancedStuckRisk(session: DiagnosticSession, nowMs = Date.now()): AdvancedStuckRisk {
  const gateKey = getDiagnosticGateKey(session);
  const responders = gateKey ? session.groupGate?.[gateKey] ?? [] : [];
  const pendingMembers =
    gateKey && session.currentStep <= 4
      ? session.participants.filter((participant) => !responders.includes(participant))
      : [];
  const latest = getSessionLastEventAt(session);
  const minutesSinceLastEvent = latest ? Math.floor((nowMs - latest.getTime()) / 60000) : null;
  const reasons: string[] = [];
  const suggestions: string[] = [];
  const affectedUsers: string[] = [];
  let level: AdvancedStuckRisk["level"] = "ok";

  if (pendingMembers.length > 0) {
    addUnique(reasons, `${pendingMembers.length} 位學生尚未完成目前任務。`);
    addUnique(suggestions, `先點「查看對話」確認題目是否清楚，再提醒 ${pendingMembers.join("、")} 完成目前任務。`);
    pendingMembers.forEach((user) => addUnique(affectedUsers, user));
    level = escalate(level, minutesSinceLastEvent !== null && minutesSinceLastEvent >= IDLE_STUCK_MINUTES ? "stuck" : "watch");
  }

  if (minutesSinceLastEvent !== null && minutesSinceLastEvent >= IDLE_STUCK_MINUTES) {
    addUnique(reasons, `已 ${minutesSinceLastEvent} 分鐘沒有新的學習事件。`);
    addUnique(suggestions, "查看小組對話與個人進度，必要時口頭確認學生是否知道下一步。");
    level = escalate(level, pendingMembers.length > 0 ? "stuck" : "watch");
  }

  const rejectedSignals = getRepeatedRejectionSignals(session);
  if (rejectedSignals.length > 0) {
    const rejectedUsers = unique(rejectedSignals.map((signal) => signal.userId));
    const maxCount = Math.max(...rejectedSignals.map((signal) => signal.count));
    rejectedUsers.forEach((user) => addUnique(affectedUsers, user));
    addUnique(reasons, `${rejectedUsers.join("、")} 多次送出未通過回答品質檢查的答案。`);
    addUnique(suggestions, "請協助學生把回答補成完整句，至少加入理由、例子或關鍵詞，不要只重複題目。");
    level = escalate(level, maxCount >= 3 ? "stuck" : "watch");
  }

  if (session.currentStep === 3) {
    const completed = new Set(session.groupGate?.["3-complete"] ?? []);
    const outlineChars = session.artifactDiagnostics?.step3OutlineChars ?? {};
    const outlineUpdatedAt = session.artifactDiagnostics?.step3OutlineUpdatedAt ?? {};
    const lowOutlineUsers = session.participants.filter((participant) => !completed.has(participant) && (outlineChars[participant] ?? 0) < OUTLINE_MIN_CHARS);
    if (lowOutlineUsers.length > 0) {
      lowOutlineUsers.forEach((user) => addUnique(affectedUsers, user));
      addUnique(reasons, `${lowOutlineUsers.join("、")} 的 Step3 結構樹仍未開始或內容過少。`);
      addUnique(suggestions, "提醒學生先新增主張、理由、例子三層節點，完成後按「完成結構樹」。");
      level = escalate(level, minutesSinceLastEvent !== null && minutesSinceLastEvent >= IDLE_STUCK_MINUTES ? "stuck" : "watch");
    }
    const inactiveOutlineUsers = session.participants.filter((participant) => {
      if (completed.has(participant)) return false;
      const updated = outlineUpdatedAt[participant];
      if (!updated) return true;
      const updatedMs = new Date(updated).getTime();
      if (!Number.isFinite(updatedMs)) return true;
      return nowMs - updatedMs >= IDLE_STUCK_MINUTES * 60000;
    });
    if (inactiveOutlineUsers.length > 0) {
      inactiveOutlineUsers.forEach((user) => addUnique(affectedUsers, user));
      addUnique(reasons, `${inactiveOutlineUsers.join("、")} 的 Step3 結構樹已一段時間未更新。`);
      addUnique(suggestions, "請提醒學生先移動或編輯一個節點，讓主張、理由、例子之間的層次更清楚。");
      level = escalate(level, "watch");
    }
  }

  const draftChars = session.artifactDiagnostics?.draftStep6Chars ?? {};
  const step6Users = session.participants.filter((participant) => (session.personalSteps?.[participant] ?? session.currentStep) === 6);
  const lowDraftUsers = step6Users.filter((participant) => (draftChars[participant] ?? 0) < DRAFT6_MIN_CHARS);
  if (lowDraftUsers.length > 0) {
    lowDraftUsers.forEach((user) => addUnique(affectedUsers, user));
    addUnique(reasons, `${lowDraftUsers.join("、")} 的 Step6 初稿字數偏低。`);
    addUnique(suggestions, "建議學生先寫出開頭與一個完整理由段，再使用 AI 修改建議或進入下一步。");
    level = escalate(level, minutesSinceLastEvent !== null && minutesSinceLastEvent >= IDLE_STUCK_MINUTES ? "stuck" : "watch");
  }

  return {
    level,
    text: reasons[0] ?? "目前進行正常。",
    pendingMembers,
    affectedUsers,
    reasons,
    suggestions,
    minutesSinceLastEvent
  };
}
