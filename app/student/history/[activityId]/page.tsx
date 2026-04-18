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
  activity: HistoryActivity;
  summary: HistorySummary;
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
            <h2>{history.activity.title}</h2>
            <p>
              班級：{history.activity.classNumber} / 文體：{history.activity.genre} / 討論時長：{history.activity.durationMinutes} 分鐘
            </p>
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
          </div>

          <div className="card">
            <h2>我的最後作品與回饋</h2>

            <h3>文章結構樹</h3>
            <pre>{history.latestWork.outline || "尚未儲存"}</pre>

            <h3 style={{ marginTop: 12 }}>步驟 6 初稿</h3>
            <pre>{history.latestWork.draftStep6 || "尚未儲存"}</pre>

            <h3 style={{ marginTop: 12 }}>步驟 8 最終稿</h3>
            <pre>{history.latestWork.draftStep8 || history.latestWork.draftStep6 || "尚未儲存"}</pre>

            <h3 style={{ marginTop: 12 }}>步驟 7 分析回饋</h3>
            <pre>{history.latestWork.step7Report || "尚未產生"}</pre>

            <h3 style={{ marginTop: 12 }}>步驟 10 總結回饋</h3>
            <pre>{history.latestWork.step10Report || "尚未產生"}</pre>
          </div>

          <div className="card">
            <h2>歷次參與清單</h2>
            {history.sessions.map((item) => (
              <div key={item.sessionId} style={{ borderTop: "1px solid #e5e7eb", padding: "10px 0" }}>
                <strong>{item.sessionId}</strong>
                <div>
                  <small>
                    {new Date(item.createdAt).toLocaleString("zh-TW")} / 最後進度 Step {item.currentStep}
                    {stepNameMap[item.currentStep] ? `（${stepNameMap[item.currentStep]}）` : ""} / 個人發言 {item.ownMessageCount} 則
                  </small>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
