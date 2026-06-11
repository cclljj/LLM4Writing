"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import { formatUserError } from "@/src/lib/error-messages";
import { formatTaipeiTime } from "@/src/lib/time-format";
import { resolveDraftHydration } from "@/src/lib/student-page-helpers";
import { SessionState, StudentSessionPayload } from "./student-session-types";

// Draft state for Step6/8 (#459). The hydration rules live in
// resolveDraftHydration (src/lib/student-page-helpers.ts) and are pinned by
// tests/student-draft-hydration.test.ts: polling must never overwrite an
// unsaved local edit.
export function useDraftEditor(input: {
  session: SessionState | null;
  loginUser: string;
  currentStep: number;
  applySessionSafely: (incoming: StudentSessionPayload) => void;
  setError: (message: string) => void;
}) {
  const { session, loginUser, currentStep, applySessionSafely, setError } = input;
  const [draftText, setDraftText] = useState("");
  const [savedDraft6Text, setSavedDraft6Text] = useState("");
  const [savedDraft8Text, setSavedDraft8Text] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState("");
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [isCompletingStep6, setIsCompletingStep6] = useState(false);
  const [isCompletingStep8, setIsCompletingStep8] = useState(false);
  const [step6RefUser, setStep6RefUser] = useState("");
  const [refUser, setRefUser] = useState("");
  const lastOwnStepRef = useRef<number | null>(null);

  useEffect(() => {
    if (!session || !loginUser) return;
    const ownStep = session.personalSteps?.[loginUser] ?? session.currentStep;
    const decision = resolveDraftHydration({
      ownStep,
      lastOwnStep: lastOwnStepRef.current,
      draftText,
      savedDraft8Text,
      latestDraft6: session.draftStep6[loginUser] ?? "",
      latestDraft8: session.draftStep8[loginUser]
    });
    if (decision.hydrateStep6) {
      deferStateUpdate(() => {
        setDraftText(decision.step6Draft);
        setSavedDraft6Text(decision.step6Draft);
        setDraftSaveError("");
        setLastDraftSavedAt(null);
        setStep6RefUser((prev) => (prev ? prev : loginUser));
      });
    }
    if (decision.hydrateStep8) {
      deferStateUpdate(() => {
        setDraftText(decision.step8Draft);
        setSavedDraft8Text(decision.step8Draft);
        setDraftSaveError("");
        setLastDraftSavedAt(null);
      });
    }
    if (!refUser && session.participants.length > 0) {
      deferStateUpdate(() =>
        setRefUser((session.participants.find((user) => user !== loginUser) ?? session.participants[0])!)
      );
    }
    lastOwnStepRef.current = ownStep;
  }, [draftText, loginUser, refUser, savedDraft8Text, session]);

  useEffect(() => {
    const ownStep = session && loginUser ? session.personalSteps?.[loginUser] ?? session.currentStep : 1;
    if (!session || !loginUser || ownStep !== 6) return;
    if (!step6RefUser || !session.participants.includes(step6RefUser)) {
      deferStateUpdate(() => setStep6RefUser(loginUser));
    }
  }, [loginUser, session, step6RefUser]);

  async function saveArtifact(type: "outline" | "draft6" | "draft8", content: string): Promise<boolean> {
    if (!session) return false;
    const isDraft = type === "draft6" || type === "draft8";
    if (isDraft) {
      setIsSavingDraft(true);
      setDraftSaveError("");
    }
    try {
      const response = await fetch("/api/session/artifact/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, type, content })
      });
      const data = await response.json();
      if (!response.ok) {
        const message = formatUserError(data.error ?? "save_failed");
        setError(message);
        if (isDraft) setDraftSaveError(message);
        return false;
      }
      if (type === "draft6") setSavedDraft6Text(content);
      if (type === "draft8") setSavedDraft8Text(content);
      if (isDraft) setLastDraftSavedAt(new Date().toISOString());
      applySessionSafely(data);
      return true;
    } finally {
      if (isDraft) setIsSavingDraft(false);
    }
  }

  const markDraftSaved = (step: 6 | 8) => {
    if (step === 6) setSavedDraft6Text(draftText);
    else setSavedDraft8Text(draftText);
    setLastDraftSavedAt(new Date().toISOString());
  };

  const unsavedDraft6Chars = currentStep === 6 && draftText !== savedDraft6Text ? draftText.length : 0;
  const unsavedDraft8Chars = currentStep === 8 && draftText !== savedDraft8Text ? draftText.length : 0;
  const currentUnsavedDraftChars = currentStep === 8 ? unsavedDraft8Chars : unsavedDraft6Chars;
  const draftSaveStatus = useMemo(() => {
    if (isSavingDraft) return { state: "saving" as const, text: "正在儲存..." };
    if (draftSaveError) return { state: "error" as const, text: draftSaveError };
    if (currentUnsavedDraftChars > 0) return { state: "dirty" as const, text: `尚有 ${currentUnsavedDraftChars} 字未保存` };
    if (lastDraftSavedAt) {
      const time = formatTaipeiTime(lastDraftSavedAt, { withSeconds: false });
      return { state: "saved" as const, text: `已自動保存於 ${time}` };
    }
    return { state: "saved" as const, text: "目前內容已保存" };
  }, [currentUnsavedDraftChars, draftSaveError, isSavingDraft, lastDraftSavedAt]);

  return {
    draftText,
    setDraftText,
    isCompletingStep6,
    setIsCompletingStep6,
    isCompletingStep8,
    setIsCompletingStep8,
    step6RefUser,
    setStep6RefUser,
    refUser,
    setRefUser,
    saveArtifact,
    markDraftSaved,
    unsavedDraft6Chars,
    unsavedDraft8Chars,
    currentUnsavedDraftChars,
    draftSaveStatus
  };
}
