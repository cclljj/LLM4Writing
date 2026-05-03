"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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

type SessionMessage = {
  id: string;
  role: string;
  userId?: string;
  text: string;
  at: string;
  step: number;
};

type LatestSession = {
  sessionId: string;
  personalStep: number;
  groupName: string;
  participants: string[];
  messages: SessionMessage[];
};

type LatestWork = {
  outline: string;
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

  const activityId = useMemo(() => String(params?.activityId ?? ""), [params?.activityId]);

  const renderMessageHtml = (text: string): string => {
    const lines = text.split(/\r?\n/);
    const htmlParts: string[] = [];
    let listBuffer: string[] = [];

    const flushList = () => {
      if (listBuffer.length === 0) return;
      htmlParts.push(`<ul>${listBuffer.join("")}</ul>`);
      listBuffer = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flushList();
        continue;
      }
      const escaped = line
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (escaped.startsWith("- ")) {
        listBuffer.push(`<li>${escaped.slice(2)}</li>`);
        continue;
      }
      flushList();
      htmlParts.push(`<p style=\"margin:6px 0;\">${escaped}</p>`);
    }
    flushList();
    return htmlParts.join("");
  };

  useEffect(() => {
    if (!activityId) {
      setError("activityId_missing");
      setLoading(false);
      return;
    }

    setLoading(true);
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
              <p style={{ margin: 0 }}>引導說明：{history.activity.essayDescription || "—"}</p>
            </div>
            <p style={{ margin: "6px 0 0" }}>補充資料：{history.activity.supplemental || "—"}</p>
          </div>

          <div className="card">
            <h2>歷史步驟說明與互動內容</h2>
            {Array.from(new Set(history.latestSession.messages.map((m) => m.step)))
              .sort((a, b) => a - b)
              .map((step) => {
                const stepMessages = history.latestSession.messages.filter((m) => {
                  if (m.step !== step) return false;
                  if (m.role === "student") return m.userId === history.viewer.username;
                  if (m.role === "ai") return !m.userId || m.userId === history.viewer.username;
                  if (m.role === "system") return !m.userId || m.userId === history.viewer.username;
                  return false;
                });
                return (
                  <div key={`history-step-${step}`} style={{ borderTop: "1px solid #e5e7eb", padding: "10px 0" }}>
                    <h3 style={{ margin: "0 0 8px" }}>
                      Step {step} {stepNameMap[step] ? `- ${stepNameMap[step]}` : ""}
                    </h3>
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
