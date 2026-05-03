"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type InteractionMode = "group_interaction" | "personal_interaction" | "non_interactive" | "personal_reflection";

type Course = {
  id: string;
  classNumber: string;
  title: string;
  genre: string;
  essayDescription?: string;
  durationMinutes: number;
  supplemental: string;
  groupStatus?: string;
  courseStatus?: "not_started" | "in_progress" | "paused" | "ended";
};

type ParticipatedCourse = {
  activityId: string;
  title: string;
  classNumber: string;
  lastSessionId: string;
  lastStep: number;
  lastParticipatedAt: string;
  sessionCount: number;
};

type SessionState = {
  id: string;
  currentStep: number;
  personalSteps?: Record<string, number>;
  activityId?: string;
  activityTitle?: string;
  structureTreeDebug?: {
    inputGenre: string;
    matchedGenre: string;
    templatePath: string;
    fallbackUsed: boolean;
    templateRawLength?: number;
    parsedNodeCount?: number;
    parsedEdgeCount?: number;
    outlineSource?: "template" | "backfill" | "existing";
  };
  groupName?: string;
  workflow: string;
  participants: string[];
  groupGate?: Record<string, string[]>;
  stepState: { step1Substep: number; step2Substep: number };
  outlines: Record<string, string>;
  step3SubmittedOutlines?: Record<string, string>;
  draftStep6: Record<string, string>;
  draftStep8: Record<string, string>;
  reports: { step5?: string; step7: Record<string, string>; step10: Record<string, string> };
  promptConfig?: {
    questionBanks?: Record<string, string[]>;
    stepOpenings?: Record<string, string>;
  };
  messages: Array<{
    id: string;
    role: string;
    userId?: string;
    text: string;
    at: string;
    step: number;
  }>;
};

type InteractiveItem = {
  id: string;
  kind: "question" | "student" | "ai";
  text: string;
  at: string;
  userId?: string;
};

type StepReview = {
  step: number;
  title: string;
  messages: InteractiveItem[];
};

type OutlinePreview = {
  nodes: OutlineNode[];
  width: number;
  height: number;
};

type OutlineNode = {
  id: string;
  parentId: string | null;
  text: string;
  x: number;
  y: number;
};

const stepNameMap: Record<number, string> = {
  1: "審視題目",
  2: "蒐集資料",
  3: "生成論點",
  4: "對比修正",
  5: "摘要報告",
  6: "撰寫初稿",
  7: "分析回饋",
  8: "修改潤飾",
  9: "個人反思",
  10: "總結報告"
};

function getMode(step: number): InteractionMode {
  if ([1, 2, 4].includes(step)) return "group_interaction";
  if ([3, 6, 8].includes(step)) return "personal_interaction";
  if ([5, 7, 10].includes(step)) return "non_interactive";
  return "personal_reflection";
}

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

function renderMessageHtml(text: string): string {
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

function newNodeId(): string {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeDefaultOutlineNodes(): OutlineNode[] {
  return [{ id: "root", parentId: null, text: "主題", x: 380, y: 40 }];
}

function escapeMermaidLabel(text: string): string {
  return text.replaceAll('"', '\\"').replaceAll("\n", " ");
}

function toMermaid(nodes: OutlineNode[]): string {
  const lines: string[] = ["graph TD"];
  nodes.forEach((node) => {
    lines.push(`  ${node.id}["${escapeMermaidLabel(node.text || "未命名節點")}"]`);
  });
  nodes
    .filter((node) => node.parentId)
    .forEach((node) => {
      lines.push(`  ${node.parentId} --> ${node.id}`);
    });
  return lines.join("\n");
}

function fromMermaid(text: string): OutlineNode[] {
  const raw = text.trim();
  if (!raw) return makeDefaultOutlineNodes();
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("graph "))
    .filter((line) => !line.startsWith("flowchart "))
    .filter((line) => !line.startsWith("```"));

  const nodeTextMap = new Map<string, string>();
  const parentMap = new Map<string, string | null>();

  for (const line of lines) {
    const nodeMatch = line.match(/^([A-Za-z0-9_-]+)\s*\["([\s\S]*)"\]$/);
    if (nodeMatch) {
      const [, id, label] = nodeMatch;
      nodeTextMap.set(id, label.replaceAll('\\"', '"'));
      if (!parentMap.has(id)) parentMap.set(id, null);
      continue;
    }
    const edgeWithLabelMatch = line.match(/^([A-Za-z0-9_-]+)\s*-->\s*([A-Za-z0-9_-]+)\s*\["([\s\S]*)"\]$/);
    if (edgeWithLabelMatch) {
      const [, parentId, childId, childLabel] = edgeWithLabelMatch;
      parentMap.set(childId, parentId);
      if (!parentMap.has(parentId)) parentMap.set(parentId, null);
      if (!nodeTextMap.has(parentId)) nodeTextMap.set(parentId, parentId);
      nodeTextMap.set(childId, childLabel.replaceAll('\\"', '"'));
      continue;
    }
    const edgeMatch = line.match(/^([A-Za-z0-9_-]+)\s*-->\s*([A-Za-z0-9_-]+)$/);
    if (edgeMatch) {
      const [, parentId, childId] = edgeMatch;
      parentMap.set(childId, parentId);
      if (!parentMap.has(parentId)) parentMap.set(parentId, null);
      if (!nodeTextMap.has(parentId)) nodeTextMap.set(parentId, parentId);
      if (!nodeTextMap.has(childId)) nodeTextMap.set(childId, childId);
    }
  }

  if (nodeTextMap.size === 0) return makeDefaultOutlineNodes();

  const depthMap = new Map<string, number>();
  const getDepth = (id: string): number => {
    const cached = depthMap.get(id);
    if (cached) return cached;
    const parent = parentMap.get(id);
    const depth = parent ? getDepth(parent) + 1 : 1;
    depthMap.set(id, depth);
    return depth;
  };

  const ids = Array.from(nodeTextMap.keys());
  ids.forEach((id) => getDepth(id));
  const groups = new Map<number, string[]>();
  ids.forEach((id) => {
    const depth = depthMap.get(id) ?? 1;
    const arr = groups.get(depth) ?? [];
    arr.push(id);
    groups.set(depth, arr);
  });

  const sortedDepths = Array.from(groups.keys()).sort((a, b) => a - b);
  const nodes: OutlineNode[] = [];
  sortedDepths.forEach((depth) => {
    const idsAtDepth = groups.get(depth) ?? [];
    idsAtDepth.forEach((id, idx) => {
      nodes.push({
        id,
        parentId: parentMap.get(id) ?? null,
        text: nodeTextMap.get(id) ?? id,
        x: 120 + idx * 180,
        y: 40 + (depth - 1) * 120
      });
    });
  });

  return nodes.length > 0 ? nodes : makeDefaultOutlineNodes();
}

function buildOutlinePreview(outline: string): OutlinePreview {
  const nodes = fromMermaid(outline || "").map((node) => ({ ...node }));
  if (nodes.length === 0) {
    return { nodes: makeDefaultOutlineNodes(), width: 520, height: 240 };
  }
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const normalized = nodes.map((node) => ({
    ...node,
    x: node.x - minX + 20,
    y: node.y - minY + 20
  }));
  const maxX = Math.max(...normalized.map((node) => node.x + 130));
  const maxY = Math.max(...normalized.map((node) => node.y + 80));
  return {
    nodes: normalized,
    width: Math.max(520, maxX + 20),
    height: Math.max(240, maxY + 20)
  };
}

export default function StudentPage() {
  const router = useRouter();
  const [loginUser, setLoginUser] = useState("");
  const [profile, setProfile] = useState<{ name?: string; school?: string; classNumber?: string; ownerTeacherUsername?: string } | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [classCourses, setClassCourses] = useState<Course[]>([]);
  const [upcomingCourses, setUpcomingCourses] = useState<Course[]>([]);
  const [activeCourses, setActiveCourses] = useState<Course[]>([]);
  const [pausedCourses, setPausedCourses] = useState<Course[]>([]);
  const [participatedCourses, setParticipatedCourses] = useState<ParticipatedCourse[]>([]);
  const [preparingCourse, setPreparingCourse] = useState<Course | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const [outlineText, setOutlineText] = useState("");
  const [outlineNodes, setOutlineNodes] = useState<OutlineNode[]>(makeDefaultOutlineNodes);
  const [outlineDirty, setOutlineDirty] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dropTargetNodeId, setDropTargetNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draftText, setDraftText] = useState("");
  const [refUser, setRefUser] = useState("");
  const [showDraftEditor, setShowDraftEditor] = useState(false);
  const [showStep6OutlineRef, setShowStep6OutlineRef] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [isAutoAdvancingStep5, setIsAutoAdvancingStep5] = useState(false);
  const [isSuggestingStep6, setIsSuggestingStep6] = useState(false);
  const [isCompletingStep6, setIsCompletingStep6] = useState(false);
  const [savedDraft6Text, setSavedDraft6Text] = useState("");
  const [isCompletingStep8, setIsCompletingStep8] = useState(false);
  const [savedDraft8Text, setSavedDraft8Text] = useState("");
  const [step6RefUser, setStep6RefUser] = useState("");
  const [historyReviewExpanded, setHistoryReviewExpanded] = useState<Record<number, boolean>>({});
  const outlineCanvasRef = useRef<HTMLDivElement | null>(null);
  const lastOwnStepRef = useRef<number | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated) {
          setLoginUser(data.user.username);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshOverview();
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      fetch(`/api/session/${session.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.id) setSession(data);
        })
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [session?.id]);

  useEffect(() => {
    if (!session || !loginUser) return;
    const ownStep = session.personalSteps?.[loginUser] ?? session.currentStep;
    const justEnteredStep6 = lastOwnStepRef.current !== 6 && ownStep === 6;
    setOutlineText(session.outlines[loginUser] ?? "");
    if (ownStep === 6 && (justEnteredStep6 || !draftText)) {
      const latestDraft = session.draftStep6[loginUser] ?? "";
      setDraftText(latestDraft);
      setSavedDraft6Text(latestDraft);
      setShowDraftEditor(true);
      setShowStep6OutlineRef(false);
      setStep6RefUser((prev) => (prev ? prev : loginUser));
    }
    if (ownStep === 8) {
      const latestDraft = session.draftStep8[loginUser] ?? session.draftStep6[loginUser] ?? "";
      setDraftText(latestDraft);
      setSavedDraft8Text(latestDraft);
      setShowDraftEditor(false);
    }
    setOutlineDirty(false);
    if (!refUser && session.participants.length > 0) {
      setRefUser((session.participants.find((user) => user !== loginUser) ?? session.participants[0])!);
    }
    lastOwnStepRef.current = ownStep;
  }, [session?.id, session?.currentStep, session?.personalSteps, loginUser]);

  useEffect(() => {
    const ownStep = session && loginUser ? session.personalSteps?.[loginUser] ?? session.currentStep : 1;
    if (!session || ownStep !== 5 || !session.reports?.step5 || isAutoAdvancingStep5) return;
    const timer = window.setTimeout(async () => {
      setIsAutoAdvancingStep5(true);
      try {
        const response = await fetch("/api/session/step5/continue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.id })
        });
        const data = await response.json();
        if (response.ok && data?.id) {
          setSession(data);
        } else {
          setError(data.error ?? "step5_auto_advance_failed");
        }
      } finally {
        setIsAutoAdvancingStep5(false);
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [isAutoAdvancingStep5, loginUser, session]);

  useEffect(() => {
    const ownStep = session && loginUser ? session.personalSteps?.[loginUser] ?? session.currentStep : 1;
    if (!session || !loginUser || ownStep !== 6) return;
    if (!step6RefUser || !session.participants.includes(step6RefUser)) {
      setStep6RefUser(loginUser);
    }
  }, [loginUser, session, step6RefUser]);

  useEffect(() => {
    const ownStep = session && loginUser ? session.personalSteps?.[loginUser] ?? session.currentStep : 1;
    if (!(ownStep === 3 || ownStep === 4) || !loginUser) return;
    const shouldSyncFromSession = ownStep === 3 || ownStep === 4;
    if (!shouldSyncFromSession) return;
    if (outlineDirty || draggingNodeId || editingNodeId) return;
    const saved = session?.outlines[loginUser]?.trim() ?? "";
    setOutlineNodes(saved ? fromMermaid(saved) : makeDefaultOutlineNodes());
    setEditingNodeId(null);
  }, [
    session?.id,
    session?.currentStep,
    session?.personalSteps,
    loginUser,
    session?.outlines,
    outlineDirty,
    draggingNodeId,
    editingNodeId
  ]);

  useEffect(() => {
    if (!draggingNodeId) return;

    function onMouseMove(event: MouseEvent) {
      const canvas = outlineCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left - dragOffset.x;
      const y = event.clientY - rect.top - dragOffset.y;
      const limitX = Math.max(980, canvas.scrollWidth - 130);
      const limitY = Math.max(520, canvas.scrollHeight - 80);
      setOutlineDirty(true);
      setOutlineNodes((prev) =>
        prev.map((node) =>
          node.id === draggingNodeId
            ? {
                ...node,
                x: Math.max(10, Math.min(limitX, x)),
                y: Math.max(10, Math.min(limitY, y))
              }
            : node
        )
      );
    }

    function onMouseUp() {
      setOutlineNodes((prev) => {
        if (!draggingNodeId || !dropTargetNodeId || draggingNodeId === dropTargetNodeId) return prev;
        const dragging = prev.find((node) => node.id === draggingNodeId);
        const target = prev.find((node) => node.id === dropTargetNodeId);
        if (!dragging || !target) return prev;
        const ancestorSet = new Set<string>();
        let cursor: OutlineNode | undefined = target;
        while (cursor?.parentId) {
          ancestorSet.add(cursor.parentId);
          cursor = prev.find((node) => node.id === cursor?.parentId);
        }
        if (ancestorSet.has(dragging.id)) return prev;
        setOutlineDirty(true);
        return prev.map((node) =>
          node.id === draggingNodeId ? { ...node, parentId: target.id, y: target.y + 120 } : node
        );
      });
      setDraggingNodeId(null);
      setDropTargetNodeId(null);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragOffset.x, dragOffset.y, draggingNodeId, dropTargetNodeId]);

  const sortedMessages = useMemo(
    () => [...(session?.messages ?? [])].sort((a, b) => a.at.localeCompare(b.at)),
    [session]
  );
  const interactiveMessages = useMemo(() => {
    if (!session) return [] as InteractiveItem[];
    const currentStep = loginUser ? session.personalSteps?.[loginUser] ?? session.currentStep : session.currentStep;
    const currentMode = getMode(currentStep);
    const activeGateKey =
      currentStep === 1
        ? `1-${session.stepState.step1Substep ?? 1}`
        : currentStep === 2
          ? `2-${session.stepState.step2Substep ?? 1}`
          : null;
    const responders = activeGateKey ? session.groupGate?.[activeGateKey] ?? [] : [];
    const hasSubmittedThisTurn = Boolean(loginUser && responders.includes(loginUser));
    const hidePeerAnswersBeforeOwn =
      currentMode === "group_interaction" &&
      Array.isArray(responders) &&
      responders.length > 0 &&
      !hasSubmittedThisTurn;

    const stepMessages = sortedMessages.filter((m) => m.step === currentStep);
    let currentTurnStartIndex = -1;
    for (let i = stepMessages.length - 1; i >= 0; i -= 1) {
      const m = stepMessages[i]!;
      if (activeGateKey) {
        if (m.role === "system" && m.text.includes(`子步驟 ${activeGateKey}：`)) {
          currentTurnStartIndex = i;
          break;
        }
      } else if (m.role === "system" && m.text.startsWith("步驟 4 開頭詞：")) {
        currentTurnStartIndex = i;
        break;
      }
    }

    const toQuestionText = (text: string): string | null => {
      if (text.includes("子步驟 ")) {
        const idx = text.indexOf("子步驟 ");
        const extracted = text.slice(idx).trim();
        const m = extracted.match(/^子步驟\s+(\d-\d)：([\s\S]*)$/);
        if (!m) return extracted;
        const substep = m[1];
        const content = m[2]?.trim() ?? "";
        // Do not leak prompt instructions in student-facing interaction stream.
        if (content.startsWith("請討論：")) {
          return `子步驟 ${substep}：請依上一則 AI 提問進行回答。`;
        }
        return `子步驟 ${substep}：${content}`;
      }
      if (text.startsWith("下一題：")) {
        return text.replace("下一題：", "").trim();
      }
      if (text.startsWith("步驟 9 開始：")) {
        return text.replace("步驟 9 開始：", "").trim();
      }
      if (text.startsWith("步驟 3 開頭詞：")) {
        return text.replace("步驟 3 開頭詞：", "").trim();
      }
      return null;
    };

    const result: InteractiveItem[] = [];
    stepMessages.forEach((m, idx) => {
        if (m.role === "student") {
          if (currentStep >= 5 && m.userId && m.userId !== loginUser) {
            return;
          }
          if (currentStep === 3 && m.userId && m.userId !== loginUser) {
            return;
          }
          const isCurrentTurnMessage = currentTurnStartIndex >= 0 ? idx > currentTurnStartIndex : false;
          if (hidePeerAnswersBeforeOwn && isCurrentTurnMessage && m.userId && m.userId !== loginUser) {
            return;
          }
          result.push({ id: m.id, kind: "student", text: m.text, at: m.at, userId: m.userId });
          return;
        }
        if (m.role === "ai") {
          if (currentStep >= 5 && m.userId && m.userId !== loginUser) {
            return;
          }
          if (currentStep === 3 && m.userId !== loginUser) {
            return;
          }
          result.push({ id: m.id, kind: "ai", text: m.text, at: m.at });
          return;
        }
        if (m.role === "system") {
          if (currentStep >= 5 && m.userId && m.userId !== loginUser) {
            return;
          }
          if (currentStep === 3) {
            return;
          }
          const q = toQuestionText(m.text);
          if (q) {
            result.push({ id: m.id, kind: "question", text: q, at: m.at });
          }
        }
      });
    return result;
  }, [session, sortedMessages, loginUser]);
  const historyReviewSteps = useMemo(() => {
    const ownStep = session && loginUser ? session.personalSteps?.[loginUser] ?? session.currentStep : 1;
    if (!session || !loginUser || ownStep <= 1) return [] as StepReview[];
    const reviews: StepReview[] = [];
    for (let step = 1; step < ownStep; step += 1) {
      const messages = sortedMessages
        .filter((m) => m.step === step)
        .flatMap((m): InteractiveItem[] => {
          if (m.role === "system" || m.role === "teacher") return [];
          if (m.role === "student") {
            if (m.userId !== loginUser) return [];
            return [{ id: m.id, kind: "student", text: m.text, at: m.at, userId: m.userId }];
          }
          if (m.role === "ai") {
            if (m.userId && m.userId !== loginUser) return [];
            return [{ id: m.id, kind: "ai", text: m.text, at: m.at, userId: m.userId }];
          }
          return [];
        });
      reviews.push({
        step,
        title: stepNameMap[step] ?? `步驟 ${step}`,
        messages
      });
    }
    return reviews;
  }, [loginUser, session, sortedMessages]);
  const step3SubmittedOutlinePreview = useMemo(() => {
    const ownStep = session && loginUser ? session.personalSteps?.[loginUser] ?? session.currentStep : 1;
    if (!session || !loginUser || ownStep < 4) return null;
    const submitted = session.step3SubmittedOutlines?.[loginUser]?.trim() ?? "";
    if (!submitted) return null;
    return buildOutlinePreview(submitted);
  }, [loginUser, session]);
  const step4OutlinePreview = useMemo(() => {
    const ownStep = session && loginUser ? session.personalSteps?.[loginUser] ?? session.currentStep : 1;
    if (!session || !loginUser || ownStep < 5) return null;
    const step4Outline = session.outlines?.[loginUser]?.trim() ?? "";
    if (!step4Outline) return null;
    return buildOutlinePreview(step4Outline);
  }, [loginUser, session]);
  useEffect(() => {
    if (historyReviewSteps.length === 0) {
      setHistoryReviewExpanded({});
      return;
    }
    setHistoryReviewExpanded((prev) => {
      const next: Record<number, boolean> = {};
      historyReviewSteps.forEach((review) => {
        next[review.step] = prev[review.step] ?? false;
      });
      return next;
    });
  }, [historyReviewSteps]);
  const currentActivity = useMemo(
    () => {
      const all = [...classCourses];
      if (preparingCourse) all.push(preparingCourse);
      return all.find((item) => item.id === session?.activityId) ?? preparingCourse;
    },
    [classCourses, preparingCourse, session?.activityId]
  );
  const teammateUsers = useMemo(() => {
    if (!session) return [];
    return session.participants.filter((user) => user !== loginUser);
  }, [session, loginUser]);
  const childrenMap = useMemo(() => {
    const map = new Map<string, OutlineNode[]>();
    outlineNodes.forEach((node) => {
      if (!node.parentId) return;
      const list = map.get(node.parentId) ?? [];
      list.push(node);
      map.set(node.parentId, list);
    });
    return map;
  }, [outlineNodes]);
  const outlineCanvasSize = useMemo(() => {
    const defaultWidth = 1100;
    const defaultHeight = 640;
    if (outlineNodes.length === 0) return { width: defaultWidth, height: defaultHeight };
    const maxX = Math.max(...outlineNodes.map((node) => node.x + 170));
    const maxY = Math.max(...outlineNodes.map((node) => node.y + 130));
    return {
      width: Math.max(defaultWidth, maxX),
      height: Math.max(defaultHeight, maxY)
    };
  }, [outlineNodes]);

  function getDepth(nodeId: string): number {
    let depth = 1;
    let cursor = outlineNodes.find((node) => node.id === nodeId);
    while (cursor?.parentId) {
      depth += 1;
      cursor = outlineNodes.find((node) => node.id === cursor?.parentId);
    }
    return depth;
  }

  function addChildNode(parentId: string) {
    const parent = outlineNodes.find((node) => node.id === parentId);
    if (!parent) return;
    const siblings = outlineNodes.filter((node) => node.parentId === parentId);
    const next: OutlineNode = {
      id: newNodeId(),
      parentId,
      text: `新節點 ${siblings.length + 1}`,
      x: parent.x + siblings.length * 140,
      y: parent.y + 120
    };
    setOutlineDirty(true);
    setOutlineNodes((prev) => [...prev, next]);
  }

  function removeLeafNode(nodeId: string) {
    const hasChildren = outlineNodes.some((node) => node.parentId === nodeId);
    if (hasChildren) return;
    setOutlineDirty(true);
    setOutlineNodes((prev) => prev.filter((node) => node.id !== nodeId));
    if (editingNodeId === nodeId) setEditingNodeId(null);
  }

  async function saveOutlineTree() {
    const mermaidText = toMermaid(outlineNodes);
    setOutlineText(mermaidText);
    await saveArtifact("outline", mermaidText);
    setOutlineDirty(false);
  }

  async function completeOutlineTree() {
    if (!session) return;
    const mermaidText = toMermaid(outlineNodes);
    setOutlineText(mermaidText);
    const response = await fetch("/api/session/step3/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, outline: mermaidText })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "complete_step3_failed");
      return;
    }
    setOutlineDirty(false);
    setSession(data);
  }

  async function completeStep4() {
    if (!session) return;
    setError("");
    const outlineToSave = currentStep === 3 || currentStep === 4 ? toMermaid(outlineNodes) : session.outlines[loginUser] ?? "";
    setOutlineText(outlineToSave);
    const response = await fetch("/api/session/step4/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, outline: outlineToSave })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "complete_step4_failed");
      return;
    }
    setOutlineDirty(false);
    setSession(data);
  }

  async function requestStep6Suggestion() {
    if (!session || currentStep !== 6) return;
    setError("");
    setIsSuggestingStep6(true);
    try {
      const response = await fetch("/api/session/step6/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, draft: draftText })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "step6_suggest_failed");
        return;
      }
      setSession(data);
    } finally {
      setIsSuggestingStep6(false);
    }
  }

  async function completeStep6ToStep8() {
    if (!session || currentStep !== 6) return;
    setError("");
    setIsCompletingStep6(true);
    try {
      const response = await fetch("/api/session/step6/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, draft: draftText })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "step6_complete_failed");
        return;
      }
      setSavedDraft6Text(draftText);
      setSession(data);
    } finally {
      setIsCompletingStep6(false);
    }
  }

  async function completeStep8ToStep9() {
    if (!session || currentStep !== 8) return;
    setError("");
    setIsCompletingStep8(true);
    try {
      const response = await fetch("/api/session/step8/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, draft: draftText })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "step8_complete_failed");
        return;
      }
      setSavedDraft8Text(draftText);
      setSession(data);
    } finally {
      setIsCompletingStep8(false);
    }
  }

  const currentStep = session && loginUser ? session.personalSteps?.[loginUser] ?? session.currentStep : session?.currentStep ?? 1;
  const currentMode = getMode(currentStep);
  const currentModeLabel =
    currentMode === "group_interaction"
      ? "小組互動"
      : currentMode === "personal_interaction"
        ? "個人互動"
        : currentMode === "non_interactive"
          ? "無互動"
          : "個人反思";
  const isInputEnabled = currentMode !== "non_interactive";

  async function refreshOverview() {
    setIsLoadingOverview(true);
    try {
      const response = await fetch("/api/student/overview");
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "overview_failed");
        return;
      }

      setProfile(data.profile ?? null);
      setMissingFields(data.missingFields ?? []);
      setClassCourses(data.classCourses ?? []);
      setUpcomingCourses(data.upcomingCourses ?? []);
      setActiveCourses(data.activeCourses ?? []);
      setPausedCourses(data.pausedCourses ?? []);
      setParticipatedCourses(data.participatedCourses ?? []);
      setError("");
    } finally {
      setIsLoadingOverview(false);
    }
  }

  async function joinActivity(activityId: string) {
    setError("");
    const response = await fetch("/api/student/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId })
    });

    const raw = await response.text();
    let data: Record<string, unknown> = {};
    if (raw) {
      try {
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        data = {};
      }
    }
    if (!response.ok) {
      if (data.error === "course_not_started") {
        setError("課程尚未開始，請等待老師開始上課後再進入討論。");
        return;
      }
      if (data.error === "course_ended") {
        setError("課程已結束，無法再進入討論。");
        return;
      }
      if (data.error === "course_paused") {
        setError("課程目前暫停中，請等待老師繼續上課後再進入討論。");
        return;
      }
      if (data.error === "not_group_member") {
        setError("你尚未被分配到該課程小組，請向老師確認分組設定。");
        return;
      }
      if (data.error === "student_join_failed") {
        const detail = typeof data.detail === "string" ? data.detail : "unknown";
        setError(`進入課程失敗：${detail}`);
        return;
      }
      setError(typeof data.error === "string" ? data.error : "join_failed");
      return;
    }

    setSession(data as SessionState);
    setPreparingCourse(null);
    await refreshOverview();
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!session || !text.trim() || !isInputEnabled) return;
    setError("");
    setIsSendingMessage(true);

    try {
      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, userId: loginUser, text })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "send_failed");
        return;
      }

      setSession(data);
      setText("");
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function saveArtifact(type: "outline" | "draft6" | "draft8", content: string) {
    if (!session) return;
    const response = await fetch("/api/session/artifact/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, type, content })
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "save_failed");
      return;
    }
    if (type === "draft6") {
      setSavedDraft6Text(content);
    }
    if (type === "draft8") {
      setSavedDraft8Text(content);
    }
    setSession(data);
  }

  const stepSubstepText =
    currentStep === 1
      ? `目前子步驟：1-${session?.stepState.step1Substep ?? 1}`
      : currentStep === 2
        ? `目前子步驟：2-${session?.stepState.step2Substep ?? 1}`
        : null;
  const stepModeLine = `${stepSubstepText ?? "目前子步驟：—"} ｜ 模式：${currentModeLabel}`;
  const lastInteractive = interactiveMessages[interactiveMessages.length - 1];
  const lastIsQuestion = lastInteractive?.kind === "question";
  const activeGateKey =
    currentStep === 1
      ? `1-${session?.stepState.step1Substep ?? 1}`
      : currentStep === 2
        ? `2-${session?.stepState.step2Substep ?? 1}`
        : null;
  const responders = activeGateKey ? session?.groupGate?.[activeGateKey] ?? [] : [];
  const step3CompletedUsers = session?.groupGate?.["3-complete"] ?? [];
  const step4CompletedUsers = session?.groupGate?.["4-complete"] ?? [];
  const step3CompletedByMe = Boolean(loginUser && step3CompletedUsers.includes(loginUser));
  const step4CompletedByMe = Boolean(loginUser && step4CompletedUsers.includes(loginUser));
  const step4CompletedPeers = useMemo(
    () => (session?.participants ?? []).filter((participant) => participant !== loginUser && step4CompletedUsers.includes(participant)),
    [loginUser, session?.participants, step4CompletedUsers]
  );
  const allStep4Completed =
    currentStep === 4 &&
    !!session &&
    session.participants.length > 0 &&
    session.participants.every((participant) => step4CompletedUsers.includes(participant));
  const hasSubmittedThisTurn = Boolean(loginUser && responders.includes(loginUser));
  const allRespondedThisTurn =
    currentMode === "group_interaction" && !!session && session.participants.every((p) => responders.includes(p));
  const canReplyToQuestion =
    currentStep === 4
      ? !step4CompletedByMe
      :
    currentMode === "group_interaction"
      ? !hasSubmittedThisTurn && !allRespondedThisTurn
      : currentStep === 3
        ? !step3CompletedByMe
        : Boolean(lastIsQuestion);
  const waitingGroupMembers =
    currentStep === 4
      ? !!session && step4CompletedByMe && !allStep4Completed
      :
    currentMode === "group_interaction" &&
    !!session &&
    Array.isArray(responders) &&
    hasSubmittedThisTurn &&
    !session.participants.every((p) => responders.includes(p));
  const latestStepMessage =
    session?.messages
      .filter((message) => message.step === currentStep)
      .at(-1) ?? null;
  const waitingAiForGroup =
    currentStep === 4
      ? false
      :
    currentMode === "group_interaction" &&
    !!session &&
    session.participants.length > 0 &&
    session.participants.every((p) => responders.includes(p)) &&
    latestStepMessage?.role !== "ai";
  const step1CompletedWaitingTeacher =
    currentStep === 1 &&
    latestStepMessage?.role === "system" &&
    latestStepMessage.text.includes("步驟 1 子步驟已完成，等待教師切換下一步");
  const step2CompletedWaitingTeacher =
    currentStep === 2 &&
    latestStepMessage?.role === "system" &&
    latestStepMessage.text.includes("步驟 2 子步驟已完成，等待教師切換下一步");
  const waitingStep3Members =
    currentStep === 3 &&
    !!session &&
    step3CompletedByMe &&
    !session.participants.every((participant) => step3CompletedUsers.includes(participant));

  const ownStep7Report = session && loginUser ? session.reports.step7[loginUser] : undefined;
  const ownStep10Report = session && loginUser ? session.reports.step10[loginUser] : undefined;
  const unsavedDraft6Chars = currentStep === 6 && draftText !== savedDraft6Text ? draftText.length : 0;
  const unsavedDraft8Chars = currentStep === 8 && draftText !== savedDraft8Text ? draftText.length : 0;
  const stepOpeningText = session?.promptConfig?.stepOpenings?.[String(currentStep)]?.trim() ?? "";
  return (
    <main>
      {error ? (
        <div className="card" style={{ borderColor: "#fecaca", background: "#fff1f2" }}>
          <small>{error}</small>
        </div>
      ) : null}

      {missingFields.length > 0 ? (
        <div className="card" style={{ borderColor: "#fecaca", background: "#fff1f2" }}>
          <h2>資料警告</h2>
          <small>
            你的帳號資料不完整（{missingFields.join(", ")}），請向老師反映。
          </small>
        </div>
      ) : null}

      {!session ? (
      <>
      {isLoadingOverview ? (
        <div className="card" style={{ borderColor: "#2563eb", background: "#dbeafe", padding: "14px 16px" }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1d4ed8" }}>系統正在載入資料中，請稍候...</p>
          <small style={{ display: "block", marginTop: 6, color: "#1e3a8a" }}>載入完成後會自動顯示課程清單。</small>
        </div>
      ) : null}
      <div className="card">
        <h2>進行中課程（本班）</h2>
        {activeCourses.length === 0 ? <small>目前沒有進行中的課程。</small> : null}
        {activeCourses.map((course) => (
          <div key={course.id} style={{ borderTop: "1px solid #e5e7eb", padding: "10px 0" }}>
            <strong>{course.title}</strong>（班級 {course.classNumber} / {course.genre} / {course.durationMinutes} 分鐘）
            <div>
              <small>分組狀態：{course.groupStatus ?? "尚未分組"}</small>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <div style={{ width: 180 }}>
                <button
                  type="button"
                  onClick={() => joinActivity(course.id)}
                >
                  進入課程
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>尚未開始課程（本班）</h2>
        <small>
          班級：{profile?.classNumber ?? "—"} / 學校：{profile?.school ?? "—"}
        </small>
        {upcomingCourses.length === 0 ? <small style={{ display: "block", marginTop: 8 }}>目前沒有尚未開始課程。</small> : null}
        {upcomingCourses.map((course) => (
          <div key={course.id} style={{ borderTop: "1px solid #e5e7eb", padding: "10px 0" }}>
            <strong>{course.title}</strong>（班級 {course.classNumber} / {course.genre} / {course.durationMinutes} 分鐘）
            <div>
              <small>分組狀態：{course.groupStatus ?? "尚未分組"}</small>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <div style={{ width: 180 }}>
                <button
                  type="button"
                  onClick={() => {
                    setPreparingCourse(course);
                  }}
                >
                  進入課程
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>暫停中課程（本班）</h2>
        {pausedCourses.length === 0 ? <small>目前沒有暫停中的課程。</small> : null}
        {pausedCourses.map((course) => (
          <div key={course.id} style={{ borderTop: "1px solid #e5e7eb", padding: "10px 0" }}>
            <strong>{course.title}</strong>（班級 {course.classNumber} / {course.genre}）
            <div>
              <small>課程目前暫停中，請等待老師繼續上課。</small>
            </div>
            <div>
              <small>分組狀態：{course.groupStatus ?? "尚未分組"}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>自己參與過的課程清單</h2>
        {participatedCourses.length === 0 ? <small>目前沒有已參與課程紀錄。</small> : null}
        {participatedCourses.map((course) => (
          <div key={course.activityId} style={{ borderTop: "1px solid #e5e7eb", padding: "10px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <strong>{course.title}</strong>（班級 {course.classNumber}）
                <div>
                  <small>
                    最近參與：{new Date(course.lastParticipatedAt).toLocaleString("zh-TW")} / 最近步驟 Step {course.lastStep} / 參與次數 {course.sessionCount}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="secondary"
                style={{ width: "fit-content", padding: "4px 10px", whiteSpace: "nowrap", flex: "0 0 auto" }}
                onClick={() => router.push(`/student/history/${course.activityId}`)}
              >
                查詢紀錄
              </button>
            </div>
          </div>
        ))}
      </div>

      {classCourses.length === 0 ? (
        <div className="card" style={{ borderColor: "#bfdbfe", background: "#eff6ff" }}>
          <h2>目前沒有可顯示課程</h2>
          <small>請確認老師已建立寫作任務，且你的學校與班級資料設定正確。</small>
        </div>
      ) : null}
      </>
      ) : null}

      {preparingCourse ? (
        <div className="card" style={{ borderColor: "#93c5fd", background: "#eff6ff" }}>
          <h2>準備開始上課</h2>
          <p>
            <strong>{preparingCourse.title}</strong>
          </p>
          <p>
            班級：{preparingCourse.classNumber} / 文體：{preparingCourse.genre} / 討論時長：{preparingCourse.durationMinutes} 分鐘
          </p>
          <small>你已進入準備階段，請等待老師點選「開始上課」。</small>
          <div className="row" style={{ marginTop: 10 }}>
            <div style={{ width: 220 }}>
              <button type="button" onClick={() => joinActivity(preparingCourse.id)}>
                檢查並進入討論
              </button>
            </div>
            <div style={{ width: 180 }}>
              <button type="button" className="secondary" onClick={() => refreshOverview()}>
                重新整理狀態
              </button>
            </div>
            <div style={{ width: 180 }}>
              <button type="button" className="secondary" onClick={() => setPreparingCourse(null)}>
                離開準備
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {session ? (
        <>
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ marginBottom: 0 }}>課程內容</h2>
              <div className="row" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="secondary"
                  style={{ width: "auto" }}
                  onClick={() => {
                    setSession(null);
                    setPreparingCourse(null);
                    refreshOverview().catch(() => undefined);
                  }}
                >
                  返回學生端課程首頁
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={{ borderColor: "#93c5fd", background: "#eff6ff", padding: "10px 14px" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 20, lineHeight: 1.4 }}>
              {session.activityTitle ?? currentActivity?.title ?? "未命名課程"}
            </p>
            <p style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
              文體：{currentActivity?.genre ?? "—"} / 時長：{currentActivity?.durationMinutes ?? "—"} 分鐘
            </p>
            <p style={{ margin: "4px 0 0", lineHeight: 1.5 }}>
              班級：{currentActivity?.classNumber ?? "—"} / 組別：{session.groupName ?? "—"}
            </p>
            <p style={{ margin: "4px 0 0", lineHeight: 1.5 }}>
              組員名單：{session.participants.length > 0 ? session.participants.join("、") : "—"}
            </p>
            <div style={{ marginTop: 10 }}>
              <p style={{ margin: 0 }}><strong>引導說明</strong></p>
              <div
                style={{ marginTop: 4 }}
                dangerouslySetInnerHTML={{ __html: renderMessageHtml(currentActivity?.essayDescription || "—") }}
              />
            </div>
            <div style={{ marginTop: 10, borderTop: "1px solid #dbeafe", paddingTop: 8 }}>
              <p style={{ margin: 0 }}><strong>補充資料</strong></p>
              <div
                style={{ marginTop: 4 }}
                dangerouslySetInnerHTML={{ __html: renderMessageHtml(currentActivity?.supplemental || "—") }}
              />
            </div>
          </div>

          {historyReviewSteps.length > 0 ? (
            <>
              <div className="card">
                <h2>前序步驟回顧</h2>
                <small>以下僅顯示你在先前步驟與 AI 的互動紀錄。</small>
              </div>
              {historyReviewSteps.map((review) => (
                <div key={`review-step-wrap-${review.step}`}>
                  <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <h2 style={{ margin: 0 }}>
                        Step {review.step} - {review.title}
                      </h2>
                      <button
                        type="button"
                        className="secondary"
                        aria-expanded={historyReviewExpanded[review.step] ?? false}
                        onClick={() =>
                          setHistoryReviewExpanded((prev) => ({ ...prev, [review.step]: !(prev[review.step] ?? false) }))
                        }
                        style={{
                          fontSize: 12,
                          lineHeight: 1.1,
                          padding: "3px 6px",
                          minHeight: "unset",
                          width: "fit-content",
                          whiteSpace: "nowrap",
                          flex: "0 0 auto"
                        }}
                      >
                        {historyReviewExpanded[review.step] ? "▾ 閉合" : "▸ 展開"}
                      </button>
                    </div>
                  {historyReviewExpanded[review.step] ? (
                  <>
                    <p>
                      <small>此為歷史步驟回顧（僅本人與 AI 互動）。</small>
                    </p>
                    <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "10px 0" }} />
                    <h3 style={{ margin: "0 0 8px" }}>互動內容</h3>
                    {review.messages.length > 0 ? (
                      review.messages.map((message) => (
                        <div key={`review-msg-${message.id}`} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                          <strong>{message.kind === "student" ? "你" : "AI 回覆"}</strong>
                          <div
                            style={{ marginTop: 4 }}
                            dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }}
                          />
                          <small>{message.at}</small>
                        </div>
                      ))
                    ) : (
                      <small>此步驟目前沒有可顯示的個人互動紀錄。</small>
                    )}
                    {review.step === 3 && step3SubmittedOutlinePreview ? (
                      <div style={{ marginTop: 14, borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
                        <strong>步驟三完成時繳交的結構樹</strong>
                        <div style={{ marginTop: 8, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                          <svg
                            width={step3SubmittedOutlinePreview.width}
                            height={step3SubmittedOutlinePreview.height}
                            style={{ display: "block", background: "#ffffff" }}
                          >
                            {step3SubmittedOutlinePreview.nodes
                              .filter((node) => node.parentId)
                              .map((node) => {
                                const parent = step3SubmittedOutlinePreview.nodes.find((item) => item.id === node.parentId);
                                if (!parent) return null;
                                return (
                                  <line
                                    key={`review-edge-${parent.id}-${node.id}`}
                                    x1={parent.x + 55}
                                    y1={parent.y + 30}
                                    x2={node.x + 55}
                                    y2={node.y}
                                    stroke="#64748b"
                                    strokeWidth={2}
                                  />
                                );
                              })}
                            {step3SubmittedOutlinePreview.nodes.map((node) => (
                              <g key={`review-node-${node.id}`}>
                                <rect
                                  x={node.x}
                                  y={node.y}
                                  width={110}
                                  height={64}
                                  rx={10}
                                  ry={10}
                                  fill="#f8fafc"
                                  stroke="#94a3b8"
                                />
                                <text x={node.x + 55} y={node.y + 36} textAnchor="middle" fontSize="12" fill="#0f172a">
                                  {node.text.length > 20 ? `${node.text.slice(0, 20)}...` : node.text}
                                </text>
                              </g>
                            ))}
                          </svg>
                        </div>
                      </div>
                    ) : null}
                    {review.step === 4 && step4OutlinePreview ? (
                      <div style={{ marginTop: 14, borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
                        <strong>步驟四修正後結構樹</strong>
                        <div style={{ marginTop: 8, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                          <svg
                            width={step4OutlinePreview.width}
                            height={step4OutlinePreview.height}
                            style={{ display: "block", background: "#ffffff" }}
                          >
                            {step4OutlinePreview.nodes
                              .filter((node) => node.parentId)
                              .map((node) => {
                                const parent = step4OutlinePreview.nodes.find((item) => item.id === node.parentId);
                                if (!parent) return null;
                                return (
                                  <line
                                    key={`review-s4-edge-${parent.id}-${node.id}`}
                                    x1={parent.x + 55}
                                    y1={parent.y + 30}
                                    x2={node.x + 55}
                                    y2={node.y}
                                    stroke="#64748b"
                                    strokeWidth={2}
                                  />
                                );
                              })}
                            {step4OutlinePreview.nodes.map((node) => (
                              <g key={`review-s4-node-${node.id}`}>
                                <rect
                                  x={node.x}
                                  y={node.y}
                                  width={110}
                                  height={64}
                                  rx={10}
                                  ry={10}
                                  fill="#f8fafc"
                                  stroke="#94a3b8"
                                />
                                <text x={node.x + 55} y={node.y + 36} textAnchor="middle" fontSize="12" fill="#0f172a">
                                  {node.text.length > 20 ? `${node.text.slice(0, 20)}...` : node.text}
                                </text>
                              </g>
                            ))}
                          </svg>
                        </div>
                      </div>
                    ) : null}
                  </>
                  ) : null}
                  </div>
                </div>
              ))}
            </>
          ) : null}

          <div className="card">
            <h2>
              Step {currentStep} - {stepNameMap[currentStep] ?? "未知步驟"}
            </h2>
            <div style={{ marginTop: 8 }}>
              <span className="badge">{stepModeLine}</span>
            </div>
            {[1, 2, 3, 4, 6, 8, 9].includes(currentStep) && stepOpeningText ? (
              <p>
                <small>
                  <span dangerouslySetInnerHTML={{ __html: renderMessageHtml(stepOpeningText) }} />
                </small>
              </p>
            ) : null}
            <p>
              <small>
                {currentStep >= 5
                  ? "此階段為個人步調，系統會依你的完成狀態自動推進步驟（例如步驟 9 完成後自動進入步驟 10）。"
                  : "步驟切換由教師端控制，你的頁面會自動同步。"}
              </small>
            </p>
            {currentStep === 10 ? (
              <>
                <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "10px 0" }} />
                <h3 style={{ margin: "0 0 8px" }}>總結報告</h3>
                <div
                  style={{ marginTop: 4 }}
                  dangerouslySetInnerHTML={{ __html: renderMessageHtml(ownStep10Report ?? "系統尚未產生總結。") }}
                />
              </>
            ) : null}
          </div>

          {currentStep === 3 ? (
            <div className="card">
              <h2>互動內容</h2>
              {interactiveMessages.map((message) => (
                <div key={message.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                  <strong>
                    {message.kind === "question"
                      ? "系統提問"
                      : message.kind === "student"
                        ? `學生${message.userId ? `(${message.userId})` : ""}`
                        : "AI 回覆"}
                  </strong>
                  <div
                    style={{ marginTop: 4 }}
                    dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }}
                  />
                  <small>{message.at}</small>
                </div>
              ))}

              {interactiveMessages.length === 0 ? (
                <small>請先描述你目前想建構的文章主軸，或直接提出你在結構樹規劃上遇到的問題。</small>
              ) : null}
              {isSendingMessage ? (
                <p style={{ marginTop: 10 }}>
                  <small>AI 正在整理回覆中，請稍候...</small>
                </p>
              ) : null}
              {step3CompletedByMe ? (
                <p style={{ marginTop: 10 }}>
                  <small>
                    {waitingStep3Members ? "你已完成結構樹，等待其他同學完成..." : "你已完成結構樹，可等待老師切換下一步。"}
                  </small>
                </p>
              ) : null}
              {!step3CompletedByMe && isInputEnabled && canReplyToQuestion && !isSendingMessage ? (
                <form onSubmit={sendMessage}>
                  <label>你的回答</label>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} />
                  <button type="submit" style={{ marginTop: 10 }}>
                    發送訊息
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}

          {currentStep === 3 && loginUser ? (
            <div className="card">
              <h2>文章結構樹</h2>
              {session.structureTreeDebug ? (
                <div style={{ marginBottom: 8, padding: "8px 10px", border: "1px dashed #94a3b8", borderRadius: 8, background: "#f8fafc" }}>
                  <small>
                    debug: inputGenre={session.structureTreeDebug.inputGenre || "—"} / matchedGenre={session.structureTreeDebug.matchedGenre || "—"} / templatePath={session.structureTreeDebug.templatePath || "—"} / fallback={session.structureTreeDebug.fallbackUsed ? "yes" : "no"} / rawLen={session.structureTreeDebug.templateRawLength ?? "—"} / nodes={session.structureTreeDebug.parsedNodeCount ?? "—"} / edges={session.structureTreeDebug.parsedEdgeCount ?? "—"} / source={session.structureTreeDebug.outlineSource || "—"}
                  </small>
                </div>
              ) : null}
              <>
                <small>按節點右上角 ➕ 新增下一層；第二層以下且無子節點可用 ➖ 刪除。雙擊節點可編輯文字，拖曳可調整位置與層次。</small>
                <div
                  style={{
                    width: "100%",
                    maxHeight: 560,
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    marginTop: 10,
                    overflow: "auto",
                    background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)"
                  }}
                >
                  <div
                    ref={outlineCanvasRef}
                    style={{
                      position: "relative",
                      width: outlineCanvasSize.width,
                      height: outlineCanvasSize.height,
                      minWidth: "100%",
                      minHeight: 560
                    }}
                  >
                    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                      {outlineNodes
                        .filter((node) => node.parentId)
                        .map((node) => {
                          const parent = outlineNodes.find((item) => item.id === node.parentId);
                          if (!parent) return null;
                          return (
                            <line
                              key={`edge-${parent.id}-${node.id}`}
                              x1={parent.x + 60}
                              y1={parent.y + 34}
                              x2={node.x + 60}
                              y2={node.y}
                              stroke="#64748b"
                              strokeWidth={2}
                            />
                          );
                        })}
                    </svg>

                    {outlineNodes.map((node) => {
                      const children = childrenMap.get(node.id) ?? [];
                      const depth = getDepth(node.id);
                      const canDelete = depth >= 2 && children.length === 0;
                      return (
                        <div
                          key={node.id}
                          onMouseEnter={() => draggingNodeId && setDropTargetNodeId(node.id)}
                          onMouseDown={(event) => {
                            const target = event.target as HTMLElement;
                            if (target.closest("button") || target.closest("input")) return;
                            const box = event.currentTarget.getBoundingClientRect();
                            setDragOffset({ x: event.clientX - box.left, y: event.clientY - box.top });
                            setDraggingNodeId(node.id);
                          }}
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            setDraggingNodeId(null);
                            setDropTargetNodeId(null);
                            setEditingNodeId(node.id);
                          }}
                          style={{
                            position: "absolute",
                            left: node.x,
                            top: node.y,
                            width: 120,
                            minHeight: 68,
                            borderRadius: 10,
                            border: node.id === dropTargetNodeId ? "2px solid #0ea5e9" : "1px solid #94a3b8",
                            background: "#ffffff",
                            boxShadow: "0 4px 14px rgba(15, 23, 42, 0.08)",
                            padding: "8px 10px 6px",
                            cursor: "move",
                            userSelect: "none"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginBottom: 4 }}>
                            <button
                              type="button"
                              className="secondary"
                              style={{ width: 24, height: 24, padding: 0, lineHeight: 1 }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={() => addChildNode(node.id)}
                            >
                              ➕
                            </button>
                            {canDelete ? (
                              <button
                                type="button"
                                className="secondary"
                                style={{ width: 24, height: 24, padding: 0, lineHeight: 1 }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={() => removeLeafNode(node.id)}
                              >
                                ➖
                              </button>
                            ) : null}
                          </div>
                          {editingNodeId === node.id ? (
                            <input
                              autoFocus
                              value={node.text}
                            onChange={(e) =>
                              {
                                setOutlineDirty(true);
                                setOutlineNodes((prev) =>
                                  prev.map((item) => (item.id === node.id ? { ...item, text: e.target.value } : item))
                                );
                              }
                            }
                              onBlur={() => setEditingNodeId(null)}
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", whiteSpace: "pre-wrap" }}>
                              {node.text}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="row" style={{ marginTop: 10, gap: 10 }}>
                  <div style={{ width: 180 }}>
                    <button type="button" onClick={saveOutlineTree}>
                      儲存變更
                    </button>
                  </div>
                  <div style={{ width: 180 }}>
                    <button type="button" className="secondary" onClick={completeOutlineTree} disabled={step3CompletedByMe}>
                      完成結構樹
                    </button>
                  </div>
                </div>
                {step3CompletedByMe ? (
                  <small style={{ display: "block", marginTop: 8 }}>
                    {waitingStep3Members ? "你已完成結構樹，等待其他同學完成..." : "你已完成結構樹，可等待老師切換下一步。"}
                  </small>
                ) : null}
              </>
            </div>
          ) : null}

          {currentStep === 4 && session && loginUser ? (
            <>
              <div className="card">
                <h2>同組同學結構樹</h2>
                <label style={{ marginTop: 10 }}>選擇同學</label>
                <select value={refUser} onChange={(e) => setRefUser(e.target.value)}>
                  {(teammateUsers.length > 0 ? teammateUsers : session.participants).map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
                {(() => {
                  const preview = buildOutlinePreview(session.outlines[refUser] ?? "");
                  return (
                    <div style={{ marginTop: 10, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                      <svg width={preview.width} height={preview.height} style={{ display: "block", background: "#ffffff" }}>
                        {preview.nodes
                          .filter((node) => node.parentId)
                          .map((node) => {
                            const parent = preview.nodes.find((item) => item.id === node.parentId);
                            if (!parent) return null;
                            return (
                              <line
                                key={`peer-edge-${parent.id}-${node.id}`}
                                x1={parent.x + 55}
                                y1={parent.y + 30}
                                x2={node.x + 55}
                                y2={node.y}
                                stroke="#64748b"
                                strokeWidth={2}
                              />
                            );
                          })}
                        {preview.nodes.map((node) => (
                          <g key={`peer-node-${node.id}`}>
                            <rect x={node.x} y={node.y} width={110} height={64} rx={10} ry={10} fill="#f8fafc" stroke="#94a3b8" />
                            <text x={node.x + 55} y={node.y + 36} textAnchor="middle" fontSize="12" fill="#0f172a">
                              {node.text.length > 20 ? `${node.text.slice(0, 20)}...` : node.text}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  );
                })()}
              </div>

              <div className="card">
                <h2>我的結構樹（可編修）</h2>
                {step4CompletedByMe ? (
                  <>
                    <small>你已確認完成此步驟，已鎖定編修。</small>
                    <pre style={{ marginTop: 8 }}>{session.outlines[loginUser] ?? "尚未提供"}</pre>
                  </>
                ) : (
                  <>
                    <small>雙擊節點可編輯，拖曳可調整位置與層次；完成後請先存檔。</small>
                    <div
                      style={{
                        width: "100%",
                        maxHeight: 560,
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        marginTop: 10,
                        overflow: "auto",
                        background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)"
                      }}
                    >
                      <div
                        ref={outlineCanvasRef}
                        style={{ position: "relative", width: outlineCanvasSize.width, height: outlineCanvasSize.height, minWidth: "100%", minHeight: 560 }}
                      >
                        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                          {outlineNodes
                            .filter((node) => node.parentId)
                            .map((node) => {
                              const parent = outlineNodes.find((item) => item.id === node.parentId);
                              if (!parent) return null;
                              return (
                                <line key={`s4-edge-${parent.id}-${node.id}`} x1={parent.x + 60} y1={parent.y + 34} x2={node.x + 60} y2={node.y} stroke="#64748b" strokeWidth={2} />
                              );
                            })}
                        </svg>
                        {outlineNodes.map((node) => {
                          const children = childrenMap.get(node.id) ?? [];
                          const depth = getDepth(node.id);
                          const canDelete = depth >= 2 && children.length === 0;
                          return (
                            <div
                              key={`s4-node-${node.id}`}
                              onMouseEnter={() => draggingNodeId && setDropTargetNodeId(node.id)}
                              onMouseDown={(event) => {
                                const target = event.target as HTMLElement;
                                if (target.closest("button") || target.closest("input")) return;
                                const box = event.currentTarget.getBoundingClientRect();
                                setDragOffset({ x: event.clientX - box.left, y: event.clientY - box.top });
                                setDraggingNodeId(node.id);
                              }}
                              onDoubleClick={(event) => {
                                event.stopPropagation();
                                setDraggingNodeId(null);
                                setDropTargetNodeId(null);
                                setEditingNodeId(node.id);
                              }}
                              style={{
                                position: "absolute",
                                left: node.x,
                                top: node.y,
                                width: 120,
                                minHeight: 68,
                                borderRadius: 10,
                                border: node.id === dropTargetNodeId ? "2px solid #0ea5e9" : "1px solid #94a3b8",
                                background: "#ffffff",
                                boxShadow: "0 4px 14px rgba(15, 23, 42, 0.08)",
                                padding: "8px 10px 6px",
                                cursor: "move",
                                userSelect: "none"
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginBottom: 4 }}>
                                <button type="button" className="secondary" style={{ width: 24, height: 24, padding: 0, lineHeight: 1 }} onMouseDown={(e) => e.stopPropagation()} onClick={() => addChildNode(node.id)}>
                                  ➕
                                </button>
                                {canDelete ? (
                                  <button type="button" className="secondary" style={{ width: 24, height: 24, padding: 0, lineHeight: 1 }} onMouseDown={(e) => e.stopPropagation()} onClick={() => removeLeafNode(node.id)}>
                                    ➖
                                  </button>
                                ) : null}
                              </div>
                              {editingNodeId === node.id ? (
                                <input
                                  autoFocus
                                  value={node.text}
                                  onChange={(e) => {
                                    setOutlineDirty(true);
                                    setOutlineNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, text: e.target.value } : item)));
                                  }}
                                  onBlur={() => setEditingNodeId(null)}
                                  onMouseDown={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", whiteSpace: "pre-wrap" }}>{node.text}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="row" style={{ marginTop: 10 }}>
                      <div style={{ width: 180 }}>
                        <button type="button" onClick={saveOutlineTree} disabled={step4CompletedByMe}>
                          存檔
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}

          {(currentStep === 6 || currentStep === 8) && loginUser ? (
            <div className="card">
              <h2>{currentStep === 6 ? "撰寫初稿" : "修改潤飾"}</h2>
              {currentStep === 6 ? (
                <>
                  <label style={{ marginTop: 10 }}>同組結構樹（唯讀）</label>
                  <select value={step6RefUser || loginUser} onChange={(e) => setStep6RefUser(e.target.value)}>
                    {session.participants.map((user) => (
                      <option key={user} value={user}>
                        {user}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const preview = buildOutlinePreview(session.outlines[step6RefUser || loginUser] ?? "");
                    return (
                      <div style={{ marginTop: 10, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                        <svg width={preview.width} height={preview.height} style={{ display: "block", background: "#ffffff" }}>
                          {preview.nodes
                            .filter((node) => node.parentId)
                            .map((node) => {
                              const parent = preview.nodes.find((item) => item.id === node.parentId);
                              if (!parent) return null;
                              return (
                                <line
                                  key={`step6-outline-edge-${parent.id}-${node.id}`}
                                  x1={parent.x + 55}
                                  y1={parent.y + 30}
                                  x2={node.x + 55}
                                  y2={node.y}
                                  stroke="#64748b"
                                  strokeWidth={2}
                                />
                              );
                            })}
                          {preview.nodes.map((node) => (
                            <g key={`step6-outline-node-${node.id}`}>
                              <rect x={node.x} y={node.y} width={110} height={64} rx={10} ry={10} fill="#f8fafc" stroke="#94a3b8" />
                              <text x={node.x + 55} y={node.y + 36} textAnchor="middle" fontSize="12" fill="#0f172a">
                                {node.text.length > 20 ? `${node.text.slice(0, 20)}...` : node.text}
                              </text>
                            </g>
                          ))}
                        </svg>
                      </div>
                    );
                  })()}
                </>
              ) : null}
              {currentStep === 8 ? <small style={{ display: "block", marginTop: 8 }}>已預載步驟 6 初稿內容，可直接修改後儲存。</small> : null}
              <textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={10} style={{ minHeight: 220 }} />
              <div className="row" style={{ marginTop: 10, gap: 10 }}>
                <div style={{ width: 180 }}>
                  <button type="button" onClick={() => saveArtifact(currentStep === 6 ? "draft6" : "draft8", draftText)}>
                    儲存文章
                  </button>
                </div>
                {currentStep === 6 ? (
                  <div style={{ width: 180 }}>
                    <button type="button" className="secondary" onClick={requestStep6Suggestion} disabled={isSuggestingStep6 || isCompletingStep6}>
                      AI 修改建議
                    </button>
                  </div>
                ) : null}
                {currentStep === 8 ? (
                  <div style={{ width: 180 }}>
                    <button type="button" className="secondary" onClick={completeStep8ToStep9} disabled={isCompletingStep8}>
                      完成潤飾步驟
                    </button>
                  </div>
                ) : null}
              </div>
              {currentStep === 6 && isSuggestingStep6 ? (
                <small style={{ display: "block", marginTop: 6, color: "#94a3b8" }}>AI 正在分析你的文章並產生修改建議，請稍候...</small>
              ) : null}
              {currentStep === 6 && isCompletingStep6 ? (
                <small style={{ display: "block", marginTop: 6, color: "#94a3b8" }}>AI 正在產生步驟 7 分析回饋，請稍候...</small>
              ) : null}
              {currentStep === 6 ? (
                <small style={{ display: "block", marginTop: 8, color: "#94a3b8" }}>未儲存字數：{unsavedDraft6Chars}</small>
              ) : null}
              {currentStep === 8 ? (
                <small style={{ display: "block", marginTop: 8, color: "#94a3b8" }}>未儲存字數：{unsavedDraft8Chars}</small>
              ) : null}
            </div>
          ) : null}

          {currentStep === 5 ? (
            <div className="card">
              <h2>摘要報告</h2>
              <pre>{session.reports.step5 ?? "系統尚未產生摘要。"}</pre>
              <small>摘要顯示後將自動進入步驟 6。</small>
            </div>
          ) : null}

          {currentStep === 7 ? (
            <div className="card">
              <h2>分析回饋</h2>
              <h3>步驟 6 作文內容</h3>
              <pre>{loginUser ? session.draftStep6[loginUser] ?? "尚未提交初稿。" : "尚未提交初稿。"}</pre>
              <h3 style={{ marginTop: 12 }}>AI 分析回饋</h3>
              <pre>{ownStep7Report ?? "系統尚未產生分析。"}</pre>
            </div>
          ) : null}

          {currentStep === 10 ? (
            <div className="card" style={{ borderColor: "#bfdbfe", background: "#eff6ff" }}>
              <h2>課程已完成</h2>
              <small>整個課程已經結束，請等待老師指示進行後續課程。</small>
            </div>
          ) : null}

          {currentStep !== 3 && currentStep !== 5 && currentStep !== 8 && currentStep !== 10 ? (
          <div className="card">
            <h2>{currentStep === 4 ? "小組討論區" : "互動內容"}</h2>
            {currentMode === "non_interactive" ? (
              <small>本步驟為無互動模式，請閱讀系統/AI 產出內容。</small>
            ) : null}
            {currentMode === "personal_reflection" ? (
              <small>個人反思模式：系統發問，AI 不回覆。</small>
            ) : null}

            {interactiveMessages.map((message) => (
              currentStep === 6 && message.kind === "student" ? null : (
              <div key={message.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                {currentStep === 4 && message.kind === "student" ? (
                  <p style={{ margin: 0 }}>
                    <strong>{message.userId || "學生"}：</strong>
                    <span style={{ marginLeft: 4, whiteSpace: "pre-wrap" }}>{message.text}</span>
                    <small style={{ marginLeft: 6 }}>({message.at})</small>
                  </p>
                ) : (
                  <>
                    <strong>
                      {message.kind === "question"
                        ? "系統提問"
                        : message.kind === "student"
                          ? `學生${message.userId ? `(${message.userId})` : ""}`
                          : "AI 回覆"}
                    </strong>
                    <div
                      style={{ marginTop: 4 }}
                      dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }}
                    />
                    <small>{message.at}</small>
                  </>
                )}
              </div>
            )))}

            {interactiveMessages.length === 0 ? <small>目前此步驟尚無互動內容。</small> : null}
            {currentStep === 4 && step4CompletedPeers.length > 0 ? (
              <div style={{ marginTop: 8 }}>
                {step4CompletedPeers.map((user) => (
                  <p key={`step4-done-${user}`} style={{ margin: "4px 0" }}>
                    <small>{user} 已確認完成此步驟。</small>
                  </p>
                ))}
              </div>
            ) : null}

            {isSendingMessage || waitingAiForGroup ? (
              <p style={{ marginTop: 10 }}>
                <small>等待遠端 AI 回答中...</small>
              </p>
            ) : null}
            {waitingGroupMembers ? (
              <p style={{ marginTop: 10 }}>
                <small>{currentStep === 4 ? "你已確認完成此步驟，等待同組其他同學完成..." : "等待同組其他同學完成本題回覆..."}</small>
              </p>
            ) : null}
            {currentStep === 4 && allStep4Completed ? (
              <p style={{ marginTop: 10 }}>
                <small>全組皆已確認完成此步驟，請等待老師切換至步驟 5。</small>
              </p>
            ) : null}
            {step1CompletedWaitingTeacher ? (
              <p style={{ marginTop: 10 }}>
                <small>步驟 1 已完成，請等待老師切換到步驟 2。</small>
              </p>
            ) : null}
            {step2CompletedWaitingTeacher ? (
              <p style={{ marginTop: 10 }}>
                <small>步驟 2 子步驟已完成，請等待老師切換下一步。</small>
              </p>
            ) : null}

            {isInputEnabled &&
            canReplyToQuestion &&
            !waitingGroupMembers &&
            !isSendingMessage &&
            !step1CompletedWaitingTeacher &&
            !step2CompletedWaitingTeacher ? (
              <form onSubmit={sendMessage}>
                <label>{currentStep === 4 ? "我的發言" : "你的回答"}</label>
                <textarea value={text} onChange={(e) => setText(e.target.value)} />
                <button type="submit" style={{ marginTop: 10 }}>
                  發送訊息
                </button>
                {currentStep === 4 ? (
                  <button type="button" className="secondary" style={{ marginTop: 10 }} onClick={completeStep4}>
                    確認完成此步驟
                  </button>
                ) : null}
              </form>
            ) : null}
            {currentStep === 6 ? (
              <div style={{ marginTop: 10 }}>
                <button type="button" className="secondary" onClick={completeStep6ToStep8} disabled={isCompletingStep6 || isSuggestingStep6}>
                  完成文章撰寫，進入下一步驟
                </button>
                {isCompletingStep6 ? (
                  <small style={{ display: "block", marginTop: 6, color: "#94a3b8" }}>AI 正在處理中，請稍候...</small>
                ) : null}
              </div>
            ) : null}
            {currentStep === 4 && step4CompletedByMe && !allStep4Completed ? (
              <button type="button" className="secondary" style={{ marginTop: 10 }} disabled>
                已確認完成此步驟
              </button>
            ) : null}

            {error ? (
              <p>
                <small>{error}</small>
              </p>
            ) : null}
          </div>
          ) : null}

          <hr />
          <div className="card">
            <h2>完整對話紀錄（除錯）</h2>
            {sortedMessages.map((message) => (
              <div key={message.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                <strong>
                  [S{message.step}] {message.role}
                  {message.userId ? `(${message.userId})` : ""}
                </strong>
                <div
                  style={{ marginTop: 4 }}
                  dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }}
                />
                <small>{message.at}</small>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
