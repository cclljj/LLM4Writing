"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatMessage } from "@/src/lib/types";
import { deferStateUpdate } from "@/src/lib/defer-state-update";
import OutlineSvg from "@/app/_components/OutlineSvg";
import { renderMessageHtml } from "@/app/student/_components/renderMessageHtml";

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

  const historySteps = useMemo(() => {
    if (!history) return [] as number[];
    const steps = new Set(history.latestSession.messages.map((m) => m.step));
    if (history.latestWork.step3SubmittedOutline) steps.add(3);
    if (history.latestWork.step4Outline) steps.add(4);
    if (history.latestWork.draftStep6) steps.add(6);
    if (history.latestWork.step7Report) steps.add(7);
    if (history.latestWork.draftStep8) steps.add(8);
    if (history.latestWork.step10Report) steps.add(10);
    return Array.from(steps).sort((a, b) => a - b);
  }, [history]);

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
        <div className="card" style={{ borderColor: "#fecaca", background: "#fff1f2" }}>
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
                        Step {step} {stepNameMap[step] ? `- ${stepNameMap[step]}` : ""}
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
                        <hr style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "10px 0" }} />
                        {stepMessages.length === 0 ? (
                          <small>此步驟沒有可顯示內容。</small>
                        ) : (
                          stepMessages.map((message) => (
                            <div key={message.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
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
                        {step === 3 && history.latestWork.step3SubmittedOutline ? (
                          <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
                            <strong>步驟三完成時繳交的結構樹</strong>
                            <OutlineSvg compact mermaidText={history.latestWork.step3SubmittedOutline} />
                          </div>
                        ) : null}
                        {step === 4 && history.latestWork.step4Outline ? (
                          <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
                            <strong>步驟四修正後結構樹</strong>
                            <OutlineSvg compact mermaidText={history.latestWork.step4Outline} />
                          </div>
                        ) : null}
                        {step === 6 && history.latestWork.draftStep6 ? (
                          <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
                            <strong>步驟六初稿</strong>
                            <div
                              style={{ marginTop: 4 }}
                              dangerouslySetInnerHTML={{ __html: renderMessageHtml(history.latestWork.draftStep6) }}
                            />
                          </div>
                        ) : null}
                        {step === 7 && history.latestWork.step7Report ? (
                          <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
                            <strong>步驟七分析回饋</strong>
                            <div
                              style={{ marginTop: 4 }}
                              dangerouslySetInnerHTML={{ __html: renderMessageHtml(history.latestWork.step7Report) }}
                            />
                          </div>
                        ) : null}
                        {step === 8 && history.latestWork.draftStep8 ? (
                          <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
                            <strong>步驟八潤飾稿</strong>
                            <div
                              style={{ marginTop: 4 }}
                              dangerouslySetInnerHTML={{ __html: renderMessageHtml(history.latestWork.draftStep8) }}
                            />
                          </div>
                        ) : null}
                        {step === 10 && history.latestWork.step10Report ? (
                          <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
                            <strong>步驟十總結報告</strong>
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
              共參與 {history.summary.sessionCount} 次，最近一次：{new Date(history.summary.lastParticipatedAt).toLocaleString("zh-TW")}（
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
                <div key={item.sessionId} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                  <small>
                    {new Date(item.createdAt).toLocaleString("zh-TW")} / 最後進度 Step {item.currentStep}
                    {stepNameMap[item.currentStep] ? `（${stepNameMap[item.currentStep]}）` : ""} / 個人發言 {item.ownMessageCount} 則
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
