"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatMessage } from "@/src/lib/types";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import { formatTaipeiDateTime } from "@/src/lib/time-format";
import OutlineSvg from "@/app/_components/OutlineSvg";
import { renderMessageHtml } from "@/app/student/_components/renderMessageHtml";
import { getWorkflowStepByCapability, getWorkflowStepName } from "@/src/lib/course-workflow";
import type { CourseWorkflowStep } from "@/src/lib/types";

type HistorySummary = {
  sessionCount: number;
  lastSessionId: string;
  lastParticipatedAt: string;
  maxStepReached: number;
  totalOwnMessages: number;
  ownMessagesInLatestSession: number;
};

type HistoryActivity = {
  id: string;
  title: string;
  classNumber: string;
  genre: string;
  durationMinutes: number;
  essayDescription: string;
  supplemental: string;
};

type LatestSession = {
  sessionId: string;
  personalStep: number;
  groupName: string;
  participants: string[];
  workflowSteps?: CourseWorkflowStep[];
  messages: ChatMessage[];
};

type LatestWork = {
  outline: string;
  step3SubmittedOutline: string;
  step4Outline: string;
  draftStep6: string;
  draftStep8: string;
  step7Report: string;
  step10Report: string;
};

type SessionItem = {
  sessionId: string;
  createdAt: string;
  currentStep: number;
  workflowSteps?: CourseWorkflowStep[];
  ownMessageCount: number;
};

type HistoryPayload = {
  viewer: {
    username: string;
  };
  activity: HistoryActivity;
  summary: HistorySummary;
  latestSession: LatestSession;
  latestWork: LatestWork;
  sessions: SessionItem[];
};


export default function StudentCourseHistoryPage() {
  const params = useParams<{ activityId: string }>();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [stepExpanded, setStepExpanded] = useState<Record<number, boolean>>({});

  const activityId = useMemo(() => String(params?.activityId ?? ""), [params?.activityId]);

  useEffect(() => {
    if (!activityId) {
      deferStateUpdate(() => {
        setError("activityId_missing");
        setLoading(false);
      });
      return;
    }

    deferStateUpdate(() => setLoading(true));
    fetch(`/api/student/course-history/${activityId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          if (data.error === "no_participation_record") {
            throw new Error("你尚未參與過這堂課，暫時無法查詢紀錄。");
          }
          throw new Error(data.error ?? "history_fetch_failed");
        }
        return data as HistoryPayload;
      })
      .then((data) => {
        setHistory(data);
        setError("");
      })
      .catch((err: unknown) => {
        setHistory(null);
        setError(err instanceof Error ? err.message : "history_fetch_failed");
      })
      .finally(() => setLoading(false));
  }, [activityId]);

  const artifactSteps = useMemo(() => {
    const owner = history?.latestSession;
    return {
      outline: owner ? getWorkflowStepByCapability(owner, "outline")?.step ?? 3 : 3,
      peerOutline: owner ? getWorkflowStepByCapability(owner, "peer_outline")?.step ?? 4 : 4,
      draft: owner ? getWorkflowStepByCapability(owner, "draft")?.step ?? 6 : 6,
      feedback: owner ? getWorkflowStepByCapability(owner, "feedback_report")?.step ?? 7 : 7,
      revision: owner ? getWorkflowStepByCapability(owner, "revision")?.step ?? 8 : 8,
      finalReport: owner ? getWorkflowStepByCapability(owner, "final_report")?.step ?? 10 : 10,
    };
  }, [history?.latestSession]);

  const historySteps = useMemo(() => {
    if (!history) return [] as number[];
    const steps = new Set(history.latestSession.messages.map((m) => m.step));
    if (history.latestWork.step3SubmittedOutline) steps.add(artifactSteps.outline);
    if (history.latestWork.step4Outline) steps.add(artifactSteps.peerOutline);
    if (history.latestWork.draftStep6) steps.add(artifactSteps.draft);
    if (history.latestWork.step7Report) steps.add(artifactSteps.feedback);
    if (history.latestWork.draftStep8) steps.add(artifactSteps.revision);
    if (history.latestWork.step10Report) steps.add(artifactSteps.finalReport);
    return Array.from(steps).sort((a, b) => a - b);
  }, [artifactSteps, history]);

  useEffect(() => {
    if (historySteps.length === 0) {
      deferStateUpdate(() => setStepExpanded({}));
      return;
    }
    deferStateUpdate(() => {
      setStepExpanded((prev) => {
        const next: Record<number, boolean> = {};
        historySteps.forEach((step) => {
          next[step] = prev[step] ?? false;
        });
        return next;
      });
    });
  }, [historySteps]);

  return (
    <main>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ marginBottom: 0 }}>課程參與紀錄</h1>
          <div style={{ width: 160 }}>
            <button type="button" className="secondary" onClick={() => router.push("/student")}>
              返回學生首頁
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <small>載入中...</small>
        </div>
      ) : null}

      {error ? (
        <div className="card" style={{ borderColor: "var(--danger-border)", background: "var(--danger-bg)" }}>
          <h2>無法載入紀錄</h2>
          <small>{error}</small>
        </div>
      ) : null}

      {!loading && !error && history ? (
        <>
          <div className="card">
            <h2>課程內容</h2>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
                lineHeight: 1.4
              }}
            >
              <strong>題目：{history.activity.title}</strong>
              <span>班級：{history.activity.classNumber}</span>
              <span>文體：{history.activity.genre}</span>
              <span>時長：{history.activity.durationMinutes} 分鐘</span>
              <span>小組：{history.latestSession.groupName || "—"}</span>
              <span>組員：{history.latestSession.participants.length > 0 ? history.latestSession.participants.join("、") : "—"}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <p style={{ margin: 0 }}><strong>引導說明：</strong></p>
              <div
                style={{ marginTop: 4 }}
                dangerouslySetInnerHTML={{ __html: renderMessageHtml(history.activity.essayDescription || "—") }}
              />
            </div>
            <p style={{ margin: "6px 0 0" }}>補充資料：{history.activity.supplemental || "—"}</p>
          </div>

          <div className="card">
            <h2>歷史步驟說明與互動內容</h2>
            {historySteps.map((step) => {
                const stepMessages = history.latestSession.messages.filter((m) => {
                  if (m.step !== step) return false;
                  if (m.role === "student") return m.userId === history.viewer.username;
                  if (m.role === "ai") return !m.userId || m.userId === history.viewer.username;
                  if (m.role === "system") return !m.userId || m.userId === history.viewer.username;
                  return false;
                });
                return (
                  <div key={`history-step-${step}`} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <h3 style={{ margin: 0 }}>
                        Step {step} - {getWorkflowStepName(history.latestSession, step)}
                      </h3>
                      <button
                        type="button"
                        className="secondary"
                        aria-expanded={stepExpanded[step] ?? false}
                        onClick={() => setStepExpanded((prev) => ({ ...prev, [step]: !(prev[step] ?? false) }))}
                        style={{ width: "fit-content", padding: "3px 6px", whiteSpace: "nowrap" }}
                      >
                        {stepExpanded[step] ? "▾ 閉合" : "▸ 展開"}
                      </button>
                    </div>
                    {stepExpanded[step] ? (
                      <>
                        <hr style={{ border: 0, borderTop: "1px solid var(--line-soft)", margin: "10px 0" }} />
                        {stepMessages.length === 0 ? (
                          <small>此步驟沒有可顯示內容。</small>
                        ) : (
                          stepMessages.map((message) => (
                            <div key={message.id} style={{ borderTop: "1px solid var(--line-soft)", padding: "8px 0" }}>
                              <strong>
                                {message.role === "student"
                                  ? "你"
                                  : message.role === "ai"
                                    ? "AI 回覆"
                                    : message.role === "system"
                                      ? "系統訊息"
                                      : message.role}
                              </strong>
                              <div
                                style={{ marginTop: 4 }}
                                dangerouslySetInnerHTML={{ __html: renderMessageHtml(message.text) }}
                              />
                              <small>{message.at}</small>
                            </div>
                          ))
                        )}
                        {step === artifactSteps.outline && history.latestWork.step3SubmittedOutline ? (
                          <div style={{ marginTop: 12, borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
                            <strong>{getWorkflowStepName(history.latestSession, artifactSteps.outline)}原始輸入架構圖</strong>
                            <OutlineSvg compact mermaidText={history.latestWork.step3SubmittedOutline} label={`${getWorkflowStepName(history.latestSession, artifactSteps.outline)}原始輸入架構圖`} />
                          </div>
                        ) : null}
                        {step === artifactSteps.peerOutline && history.latestWork.step4Outline ? (
                          <div style={{ marginTop: 12, borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
                            <strong>{getWorkflowStepName(history.latestSession, artifactSteps.peerOutline)}修正後結構樹</strong>
                            <OutlineSvg compact mermaidText={history.latestWork.step4Outline} />
                          </div>
                        ) : null}
                        {step === artifactSteps.draft && history.latestWork.draftStep6 ? (
                          <div style={{ marginTop: 12, borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
                            <strong>{getWorkflowStepName(history.latestSession, artifactSteps.draft)}初稿</strong>
                            <div
                              style={{ marginTop: 4 }}
                              dangerouslySetInnerHTML={{ __html: renderMessageHtml(history.latestWork.draftStep6) }}
                            />
                          </div>
                        ) : null}
                        {step === artifactSteps.feedback && history.latestWork.step7Report ? (
                          <div style={{ marginTop: 12, borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
                            <strong>{getWorkflowStepName(history.latestSession, artifactSteps.feedback)}</strong>
                            <div
                              style={{ marginTop: 4 }}
                              dangerouslySetInnerHTML={{ __html: renderMessageHtml(history.latestWork.step7Report) }}
                            />
                          </div>
                        ) : null}
                        {step === artifactSteps.revision && history.latestWork.draftStep8 ? (
                          <div style={{ marginTop: 12, borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
                            <strong>{getWorkflowStepName(history.latestSession, artifactSteps.revision)}稿</strong>
                            <div
                              style={{ marginTop: 4 }}
                              dangerouslySetInnerHTML={{ __html: renderMessageHtml(history.latestWork.draftStep8) }}
                            />
                          </div>
                        ) : null}
                        {step === artifactSteps.finalReport && history.latestWork.step10Report ? (
                          <div style={{ marginTop: 12, borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
                            <strong>{getWorkflowStepName(history.latestSession, artifactSteps.finalReport)}</strong>
                            <div
                              style={{ marginTop: 4 }}
                              dangerouslySetInnerHTML={{ __html: renderMessageHtml(history.latestWork.step10Report) }}
                            />
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                );
              })}
          </div>

          <div className="card">
            <h2>參與摘要</h2>
            <small>
              共參與 {history.summary.sessionCount} 次，最近一次：{formatTaipeiDateTime(history.summary.lastParticipatedAt)}（
              {history.summary.lastSessionId}）
            </small>
            <div style={{ marginTop: 8 }}>
              <small>
                最高進度 Step {history.summary.maxStepReached} / 累積發言 {history.summary.totalOwnMessages} 則 / 最近一次發言
                {history.summary.ownMessagesInLatestSession} 則
              </small>
            </div>
            <div style={{ marginTop: 10 }}>
              {history.sessions.map((item) => (
                <div key={item.sessionId} style={{ borderTop: "1px solid var(--line-soft)", padding: "8px 0" }}>
                  <small>
                    {formatTaipeiDateTime(item.createdAt)} / 最後進度 Step {item.currentStep}
                    {`（${getWorkflowStepName(item, item.currentStep)}）`} / 個人發言 {item.ownMessageCount} 則
                  </small>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
