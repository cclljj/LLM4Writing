"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import { appendErrorHint, formatUserError } from "@/src/lib/error-messages";
import { validateDraftContent } from "@/src/lib/answer-validation";
import { appendTeacherHelpHint } from "@/src/lib/student-page-helpers";
import { readSseSessionStream } from "@/src/lib/sse-session-stream";
import { SessionState, StudentSessionPayload } from "./student-session-types";

// Step action handlers for the student page (#459): message sending (with
// step3 streaming), outline completion, step4-10 transitions. State that only
// these actions own (text, step9 answers, hints, busy flags) lives here.
export function useStudentStepActions(input: {
  session: SessionState | null;
  loginUser: string;
  currentStep: number;
  activityStatusMap: Record<string, "not_started" | "in_progress" | "paused" | "ended">;
  isInputEnabled: boolean;
  applySessionSafely: (incoming: StudentSessionPayload) => void;
  setError: (message: string | ((prev: string) => string)) => void;
  draftText: string;
  saveArtifact: (type: "outline" | "draft6" | "draft8", content: string) => Promise<boolean>;
  markDraftSaved: (step: 6 | 8) => void;
  setIsCompletingStep6: (value: boolean) => void;
  setIsCompletingStep8: (value: boolean) => void;
  setStep3StreamingText: (value: string) => void;
  setStep6StreamingText: (value: string) => void;
  setStep7StreamingText: (value: string) => void;
}) {
  const {
    session,
    loginUser,
    currentStep,
    activityStatusMap,
    isInputEnabled,
    applySessionSafely,
    setError,
    draftText,
    saveArtifact,
    markDraftSaved,
    setIsCompletingStep6,
    setIsCompletingStep8,
    setStep3StreamingText,
    setStep6StreamingText,
    setStep7StreamingText
  } = input;

  const [text, setText] = useState("");
  const [step9Answers, setStep9Answers] = useState(["", "", "", ""]);
  const [step3CompleteHint, setStep3CompleteHint] = useState("");
  const [makeupOutlineHint, setMakeupOutlineHint] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isAutoAdvancingStep5, setIsAutoAdvancingStep5] = useState(false);
  const [isSuggestingStep6, setIsSuggestingStep6] = useState(false);
  const outlineMermaidRef = useRef<string>("");

  useEffect(() => {
    if (currentStep !== 9) return;
    deferStateUpdate(() => setStep9Answers(["", "", "", ""]));
  }, [currentStep, session?.id]);

  useEffect(() => {
    if (currentStep !== 3) {
      deferStateUpdate(() => setStep3CompleteHint(""));
    }
  }, [currentStep, session?.id]);

  // Auto-advance from step5 once the summary report is visible.
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
          applySessionSafely(data);
        } else {
          setError(formatUserError(data.error ?? "step5_auto_advance_failed"));
        }
      } finally {
        setIsAutoAdvancingStep5(false);
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [applySessionSafely, isAutoAdvancingStep5, loginUser, session, setError]);

  function courseStatusGuardMessage(kind: "submit" | "operate"): string | null {
    if (!session) return null;
    const courseStatus = activityStatusMap[session.activityId ?? ""];
    if (courseStatus && courseStatus !== "in_progress") {
      return courseStatus === "paused"
        ? "課程目前暫停中，請等待老師繼續上課。"
        : kind === "submit"
          ? "課程目前不可提交，請等待老師指示。"
          : "課程目前不可操作，請等待老師指示。";
    }
    return null;
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!session || !text.trim() || !isInputEnabled) return;
    setError("");
    setIsSendingMessage(true);
    try {
      if (currentStep === 3) {
        setStep3StreamingText("");
        const textToSend = text;
        const response = await fetch("/api/session/step3/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.id, text: textToSend })
        });
        if (!response.ok || !response.body) {
          try {
            const data = await response.json();
            setError(appendTeacherHelpHint(formatUserError(data.error ?? "step3_stream_failed")));
          } catch {
            setError(appendTeacherHelpHint(formatUserError("step3_stream_failed")));
          }
          return;
        }
        const { finalSession, streamError } = await readSseSessionStream<SessionState>(response.body, {
          defaultError: "step3_stream_failed",
          onChunk: setStep3StreamingText
        });
        if (streamError) {
          setError(appendTeacherHelpHint(formatUserError(streamError)));
        } else if (finalSession) {
          applySessionSafely(finalSession);
          setText("");
        }
        return;
      }

      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, userId: loginUser, text })
      });
      const data = await response.json();
      if (!response.ok) {
        const errorText = typeof data.error === "string" ? data.error : "send_failed";
        const hintText = typeof data.hint === "string" && data.hint.trim() ? data.hint.trim() : "";
        setError(appendTeacherHelpHint(appendErrorHint(errorText, hintText)));
        return;
      }
      applySessionSafely(data);
      setText("");
    } finally {
      setIsSendingMessage(false);
      setStep3StreamingText("");
    }
  }

  async function submitStep9Batch(e: FormEvent) {
    e.preventDefault();
    if (!session || currentStep !== 9 || !isInputEnabled) return;
    const payload = `Q1: ${step9Answers[0]}\nQ2: ${step9Answers[1]}\nQ3: ${step9Answers[2]}\nQ4: ${step9Answers[3]}`;
    setError("");
    setIsSendingMessage(true);
    try {
      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, userId: loginUser, text: payload })
      });
      const data = await response.json();
      if (!response.ok) {
        const errorText = typeof data.error === "string" ? data.error : "send_failed";
        const hintText = typeof data.hint === "string" && data.hint.trim() ? data.hint.trim() : "";
        setError(appendTeacherHelpHint(appendErrorHint(errorText, hintText)));
        return;
      }
      applySessionSafely(data);
      setStep9Answers(["", "", "", ""]);
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function handleOutlineSave(mermaid: string) {
    outlineMermaidRef.current = mermaid;
    setStep3CompleteHint("");
    await saveArtifact("outline", mermaid);
  }

  async function completeOutlineTree(mermaid: string) {
    if (!session) return;
    const blocked = courseStatusGuardMessage("submit");
    if (blocked) { setError(blocked); return; }
    const response = await fetch("/api/session/step3/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, outline: mermaid })
    });
    const data = await response.json();
    if (!response.ok) {
      if (data?.error === "step3_outline_depth3_not_edited") {
        setStep3CompleteHint("尚未完成：請先確實編輯第三層（含）以後的所有節點內容，再按「完成結構樹」。");
      }
      setError(formatUserError(data.error ?? "complete_step3_failed"));
      return;
    }
    setStep3CompleteHint("");
    applySessionSafely(data);
  }

  async function completeMakeupOutlineTree(mermaid: string) {
    if (!session) return;
    const blocked = courseStatusGuardMessage("submit");
    if (blocked) { setError(blocked); return; }
    setError("");
    const response = await fetch("/api/session/makeup-outline/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, outline: mermaid })
    });
    const data = await response.json();
    if (!response.ok) {
      if (data?.error === "step3_outline_depth3_not_edited") {
        setMakeupOutlineHint("尚未完成：請先確實編輯第三層（含）以後的所有節點內容，再按「完成個人結構圖」。");
      }
      setError(formatUserError(data.error ?? "complete_makeup_outline_failed"));
      return;
    }
    setMakeupOutlineHint("");
    applySessionSafely(data);
  }

  async function reopenStep3Editing() {
    if (!session) return;
    const blocked = courseStatusGuardMessage("operate");
    if (blocked) { setError(blocked); return; }
    setError("");
    const response = await fetch("/api/session/step3/reopen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(formatUserError(data.error ?? "reopen_step3_failed"));
      return;
    }
    setStep3CompleteHint("");
    applySessionSafely(data);
  }

  async function completeStep4() {
    if (!session) return;
    const blocked = courseStatusGuardMessage("submit");
    if (blocked) { setError(blocked); return; }
    setError("");
    const outlineToSave = outlineMermaidRef.current || (session.outlines[loginUser] ?? "");
    const response = await fetch("/api/session/step4/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, outline: outlineToSave })
    });
    const data = await response.json();
    if (!response.ok) { setError(formatUserError(data.error ?? "complete_step4_failed")); return; }
    applySessionSafely(data);
  }

  async function requestStep6Suggestion() {
    if (!session || currentStep !== 6) return;
    const blocked = courseStatusGuardMessage("operate");
    if (blocked) { setError(blocked); return; }
    setError("");
    setStep6StreamingText("");
    setIsSuggestingStep6(true);
    try {
      const saved = await saveArtifact("draft6", draftText);
      if (!saved) {
        setError((prev) => prev || "儲存文章失敗，尚未送出 AI 建議。請先儲存成功後再試。");
        return;
      }
      const response = await fetch("/api/session/step6/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, draft: draftText })
      });
      if (!response.ok || !response.body) {
        // Fallback: try to parse JSON error body for legacy error responses.
        try {
          const data = await response.json();
          setError(formatUserError(data.error ?? "step6_suggest_failed"));
        } catch {
          setError(formatUserError("step6_suggest_failed"));
        }
        return;
      }
      const { finalSession, streamError } = await readSseSessionStream<SessionState>(response.body, {
        defaultError: "step6_suggest_failed",
        onChunk: setStep6StreamingText
      });
      if (streamError) {
        setError(formatUserError(streamError));
      } else if (finalSession) {
        applySessionSafely(finalSession);
      }
    } catch {
      setError(formatUserError("step6_suggest_failed"));
    } finally {
      setIsSuggestingStep6(false);
      setStep6StreamingText("");
    }
  }

  async function completeStep6ToStep8() {
    if (!session || currentStep !== 6) return;
    const draftError = validateDraftContent(draftText);
    if (draftError) { setError(draftError); return; }
    setError("");
    setStep7StreamingText("");
    setIsCompletingStep6(true);
    try {
      const response = await fetch("/api/session/step6/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, draft: draftText })
      });
      if (!response.ok || !response.body) {
        try {
          const data = await response.json();
          setError(appendErrorHint(data.error ?? "step6_complete_failed", typeof data.hint === "string" ? data.hint : undefined));
        } catch {
          setError(formatUserError("step6_complete_failed"));
        }
        return;
      }
      const { finalSession, streamError } = await readSseSessionStream<SessionState>(response.body, {
        defaultError: "step6_complete_failed",
        onChunk: setStep7StreamingText
      });
      if (streamError) {
        setError(formatUserError(streamError));
      } else if (finalSession) {
        markDraftSaved(6);
        applySessionSafely(finalSession);
      }
    } catch {
      setError(formatUserError("step6_complete_failed"));
    } finally {
      setIsCompletingStep6(false);
      setStep7StreamingText("");
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
        setError(appendErrorHint(data.error ?? "step8_complete_failed", typeof data.hint === "string" ? data.hint : undefined));
        return;
      }
      markDraftSaved(8);
      applySessionSafely(data);
    } finally {
      setIsCompletingStep8(false);
    }
  }

  return {
    text,
    setText,
    step9Answers,
    setStep9Answers,
    step3CompleteHint,
    makeupOutlineHint,
    isSendingMessage,
    isAutoAdvancingStep5,
    isSuggestingStep6,
    sendMessage,
    submitStep9Batch,
    handleOutlineSave,
    completeOutlineTree,
    completeMakeupOutlineTree,
    reopenStep3Editing,
    completeStep4,
    requestStep6Suggestion,
    completeStep6ToStep8,
    completeStep8ToStep9
  };
}
