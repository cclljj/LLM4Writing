"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeStudentSessionPayloadHash,
  resolveStudentSessionNextPollDelay,
  STUDENT_SESSION_FAST_POLL_MS
} from "@/src/lib/student-session-polling";
import {
  fetchStudentJson,
  getOwnStepFromSession,
  getStudentRetryableMessage,
  shouldAcceptIncomingSession,
  StudentFetchError
} from "@/src/lib/student-page-helpers";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import { formatUserError } from "@/src/lib/error-messages";
import { Course, SessionState, StudentSessionPayload } from "./student-session-types";

const LAST_ACTIVITY_STORAGE_KEY = "student:lastActivityId";

export function rememberLastActivity(activityId: string | null) {
  if (typeof window === "undefined") return;
  if (activityId) {
    window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, activityId);
  } else {
    window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
  }
}

export function syncActivityQuery(activityId: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (activityId) {
    url.searchParams.set("activityId", activityId);
  } else {
    url.searchParams.delete("activityId");
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

// Session lifecycle for the student page (#459): adaptive polling with
// summary payloads, rollback-safe session application, course join and
// last-activity restore.
export function useStudentSession(input: {
  authReady: boolean;
  loginUser: string;
  setError: (message: string) => void;
  refreshOverview: () => Promise<void>;
  refreshActivityStatuses: () => Promise<void>;
  isLoadingOverview: boolean;
  classCourses: Course[];
  upcomingCourses: Course[];
  activeCourses: Course[];
  pausedCourses: Course[];
}) {
  const {
    authReady,
    loginUser,
    setError,
    refreshOverview,
    refreshActivityStatuses,
    isLoadingOverview,
    classCourses,
    upcomingCourses,
    activeCourses,
    pausedCourses
  } = input;

  const [session, setSession] = useState<SessionState | null>(null);
  const [preparingCourse, setPreparingCourse] = useState<Course | null>(null);
  const sessionEtagRef = useRef<string>("");
  const sessionPayloadHashRef = useRef<string>("");
  const sessionPollDelayRef = useRef<number>(STUDENT_SESSION_FAST_POLL_MS);
  const sessionPollingBusyRef = useRef(false);
  const sessionMessageSignatureRef = useRef<{ count: number; lastAt: string }>({ count: 0, lastAt: "" });
  const restoreAttemptedRef = useRef<string>("");

  const applySessionSafely = useCallback((incoming: StudentSessionPayload) => {
    setSession((prev) => {
      if (!prev || !loginUser) return { ...incoming, messages: incoming.messages ?? [] };
      if (prev.id !== incoming.id) return { ...incoming, messages: incoming.messages ?? [] };
      const mergedIncoming =
        incoming.participantDisplayNames && Object.keys(incoming.participantDisplayNames).length > 0
          ? incoming
          : {
              ...incoming,
              participantDisplayNames: prev.participantDisplayNames
            };
      const incomingWithMessages = {
        ...mergedIncoming,
        messages: mergedIncoming.messages ?? prev.messages
      };
      const accepted = shouldAcceptIncomingSession({
        prevOwnStep: getOwnStepFromSession(prev, loginUser),
        nextOwnStep: getOwnStepFromSession(incomingWithMessages, loginUser),
        prevMessageCount: prev.messages?.length ?? 0,
        nextMessageCount: incomingWithMessages.messages?.length ?? 0
      });
      if (!accepted) return prev;
      return incomingWithMessages;
    });
  }, [loginUser]);

  useEffect(() => {
    const messages = session?.messages ?? [];
    sessionMessageSignatureRef.current = {
      count: messages.length,
      lastAt: messages.at(-1)?.at ?? ""
    };
  }, [session?.messages]);

  useEffect(() => {
    if (!authReady || !loginUser) return;
    if (!session?.id) {
      const timer = window.setInterval(() => {
        refreshOverview().catch(() => undefined);
      }, 15000);
      return () => window.clearInterval(timer);
    }
    const sessionId = session.id;
    let canceled = false;
    let timerId: number | null = null;
    let successfulPollCount = 0;
    sessionPollDelayRef.current = STUDENT_SESSION_FAST_POLL_MS;
    sessionPayloadHashRef.current = "";

    const scheduleNext = (delayMs: number) => {
      if (canceled) return;
      timerId = window.setTimeout(tick, delayMs);
    };

    const tick = async () => {
      if (canceled) return;
      if (sessionPollingBusyRef.current) {
        scheduleNext(STUDENT_SESSION_FAST_POLL_MS);
        return;
      }
      sessionPollingBusyRef.current = true;
      const headers: Record<string, string> = {};
      if (sessionEtagRef.current) headers["If-None-Match"] = sessionEtagRef.current;
      let unchanged = true;
      let failed = false;
      try {
        const res = await fetch(`/api/session/${sessionId}?view=poll`, { headers });
        const newEtag = res.headers.get("ETag");
        if (newEtag) sessionEtagRef.current = newEtag;
        if (res.status !== 304) {
          const data = await res.json();
          if (data?.id) {
            const nextHash = computeStudentSessionPayloadHash(data, loginUser);
            unchanged = nextHash === sessionPayloadHashRef.current;
            if (!unchanged) {
              sessionPayloadHashRef.current = nextHash;
              const previousMessageSignature = sessionMessageSignatureRef.current;
              const nextMessageCount = typeof data.messageCount === "number" ? data.messageCount : data.messages?.length ?? 0;
              const nextLastMessageAt = data.lastMessageAt ?? data.messages?.at?.(-1)?.at ?? "";
              if (data.pollSummary && (nextMessageCount !== previousMessageSignature.count || nextLastMessageAt !== previousMessageSignature.lastAt)) {
                const fullRes = await fetch(`/api/session/${sessionId}`, { cache: "no-store" });
                const fullData = await fullRes.json();
                if (fullRes.ok && fullData?.id) {
                  applySessionSafely(fullData);
                  sessionMessageSignatureRef.current = {
                    count: fullData.messages?.length ?? 0,
                    lastAt: fullData.messages?.at?.(-1)?.at ?? ""
                  };
                }
              } else {
                applySessionSafely(data);
              }
            }
          }
        }
        successfulPollCount++;
        if (successfulPollCount % 3 === 0) refreshActivityStatuses().catch(() => undefined);
      } catch {
        failed = true;
      } finally {
        sessionPollingBusyRef.current = false;
      }
      if (!canceled) {
        sessionPollDelayRef.current = failed
          ? STUDENT_SESSION_FAST_POLL_MS
          : resolveStudentSessionNextPollDelay({
              currentDelayMs: sessionPollDelayRef.current,
              unchanged
            });
        scheduleNext(sessionPollDelayRef.current);
      }
    };

    scheduleNext(STUDENT_SESSION_FAST_POLL_MS);
    return () => {
      canceled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
    // refreshOverview/refreshActivityStatuses are stable per render and
    // intentionally excluded, matching the original page effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applySessionSafely, authReady, loginUser, session?.id]);

  async function joinActivity(activityId: string, options?: { silent?: boolean }) {
    if (!loginUser) { setError(formatUserError("auth_not_ready")); return; }
    if (!options?.silent) setError("");
    try {
      const { data } = await fetchStudentJson<SessionState>("/api/student/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId })
      }, { retryDelaysMs: [700] });
      applySessionSafely(data);
      rememberLastActivity(activityId);
      syncActivityQuery(activityId);
      setPreparingCourse(null);
      await refreshOverview();
    } catch (error) {
      if (options?.silent) return;
      if (error instanceof StudentFetchError) {
        if (error.message === "course_not_started") { setError(formatUserError("course_not_started")); return; }
        if (error.message === "course_ended") { setError(formatUserError("course_ended")); return; }
        if (error.message === "course_paused") { setError(formatUserError("course_paused")); return; }
        if (error.message === "not_group_member") { setError(formatUserError("not_group_member")); return; }
        if (error.message === "student_join_failed") {
          setError("進入課程失敗。建議：請重新整理後再試，或請教師確認課程設定。");
          return;
        }
        if (error.code === "http" && error.status && error.status < 500 && error.status !== 429) {
          setError(formatUserError(error.message || "join_failed"));
          return;
        }
        setError(getStudentRetryableMessage("join"));
        return;
      }
      setError(getStudentRetryableMessage("join"));
    }
  }

  useEffect(() => {
    if (!session?.activityId) return;
    rememberLastActivity(session.activityId);
    syncActivityQuery(session.activityId);
  }, [session?.activityId]);

  useEffect(() => {
    if (!authReady || !loginUser || session || isLoadingOverview) return;
    if (restoreAttemptedRef.current) return;
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get("activityId")?.trim() ?? "";
    const fromStorage = window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY)?.trim() ?? "";
    const candidate = fromQuery || fromStorage;
    if (!candidate) {
      restoreAttemptedRef.current = "__none__";
      return;
    }

    const allKnownCourses = [...activeCourses, ...pausedCourses, ...upcomingCourses, ...classCourses];
    const known = allKnownCourses.find((c) => c.id === candidate);
    if (!known) {
      restoreAttemptedRef.current = "__unknown__";
      rememberLastActivity(null);
      syncActivityQuery(null);
      return;
    }
    if (known.courseStatus !== "in_progress" && known.courseStatus !== "paused") {
      restoreAttemptedRef.current = "__not_resumable__";
      rememberLastActivity(null);
      syncActivityQuery(null);
      return;
    }

    restoreAttemptedRef.current = candidate;
    deferStateUpdate(() => {
      joinActivity(candidate, { silent: true }).catch(() => undefined);
    });
    // joinActivity depends on broad page state; this restore guard must run once per candidate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeCourses,
    authReady,
    classCourses,
    isLoadingOverview,
    loginUser,
    pausedCourses,
    session,
    upcomingCourses
  ]);

  return {
    session,
    setSession,
    applySessionSafely,
    preparingCourse,
    setPreparingCourse,
    joinActivity
  };
}
