"use client";

import { useEffect, useRef, useState } from "react";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import { formatUserError } from "@/src/lib/error-messages";
import { readSseSessionStream } from "@/src/lib/sse-session-stream";
import { SessionState, StudentSessionPayload } from "./student-session-types";

// Streaming UI state for Step3/6/7/10 (#459) plus the Step10 auto-stream
// trigger (#241) and its waiting-dots animation.
export function useStepStreaming(input: {
  session: SessionState | null;
  loginUser: string;
  currentStep: number;
  ownStep10Report: string | undefined;
  applySessionSafely: (incoming: StudentSessionPayload) => void;
  setError: (message: string) => void;
}) {
  const { session, loginUser, currentStep, ownStep10Report, applySessionSafely, setError } = input;
  const [step3StreamingText, setStep3StreamingText] = useState("");
  const [step6StreamingText, setStep6StreamingText] = useState("");
  const [step7StreamingText, setStep7StreamingText] = useState("");
  const [step10StreamingText, setStep10StreamingText] = useState("");
  const [step10LoadingDots, setStep10LoadingDots] = useState<"..." | "......">("...");
  const step10StreamRequestedRef = useRef<string>("");

  useEffect(() => {
    const isStep10Waiting = currentStep === 10 && !ownStep10Report?.trim();
    if (!isStep10Waiting) {
      deferStateUpdate(() => setStep10LoadingDots("..."));
      return;
    }
    const timer = window.setInterval(() => {
      setStep10LoadingDots((prev) => (prev === "..." ? "......" : "..."));
    }, 600);
    return () => window.clearInterval(timer);
  }, [currentStep, ownStep10Report]);

  async function streamStep10Report(sessionId: string): Promise<boolean> {
    setStep10StreamingText("");
    try {
      const response = await fetch("/api/session/step10/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      if (!response.ok || !response.body) {
        setError(formatUserError("step10_stream_failed"));
        return false;
      }
      const { finalSession, streamError } = await readSseSessionStream<SessionState>(response.body, {
        defaultError: "step10_stream_failed",
        onChunk: setStep10StreamingText
      });
      if (streamError) {
        setError(formatUserError(streamError));
        return false;
      }
      if (finalSession) {
        applySessionSafely(finalSession);
        return true;
      }
      return false;
    } catch {
      setError(formatUserError("step10_stream_failed"));
      return false;
    } finally {
      setStep10StreamingText("");
    }
  }

  // Auto-trigger Step 10 streaming when student personal step reaches 10
  // without a stored report yet (#241).
  useEffect(() => {
    if (!session || !loginUser) return;
    if (currentStep !== 10) return;
    if (ownStep10Report && ownStep10Report.trim()) return;
    if (step10StreamRequestedRef.current === session.id) return;
    step10StreamRequestedRef.current = session.id;
    streamStep10Report(session.id)
      .then((ok) => {
        if (!ok) {
          step10StreamRequestedRef.current = "";
        }
      })
      .catch(() => {
        step10StreamRequestedRef.current = "";
      });
    // streamStep10Report intentionally closes over the latest session helpers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, currentStep, ownStep10Report, loginUser]);

  return {
    step3StreamingText,
    setStep3StreamingText,
    step6StreamingText,
    setStep6StreamingText,
    step7StreamingText,
    setStep7StreamingText,
    step10StreamingText,
    step10LoadingDots
  };
}
