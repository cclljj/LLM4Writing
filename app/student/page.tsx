"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Activity = {
  id: string;
  className: string;
  title: string;
  genre: string;
  durationMinutes: number;
  supplemental: string;
};

type SessionState = {
  id: string;
  currentStep: number;
  activityId?: string;
  activityTitle?: string;
  workflow: string;
  participants: string[];
  messages: Array<{
    id: string;
    role: string;
    userId?: string;
    text: string;
    at: string;
    step: number;
  }>;
};

type HistoryItem = {
  sessionId: string;
  activityId?: string;
  activityTitle?: string;
  currentStep: number;
  messageCount: number;
  createdAt: string;
};

export default function StudentPage() {
  const [loginUser, setLoginUser] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [session, setSession] = useState<SessionState | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [detailActivity, setDetailActivity] = useState<Activity | null>(null);

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
    refreshActivities();
    refreshHistory();
  }, []);

  const sortedMessages = useMemo(
    () => [...(session?.messages ?? [])].sort((a, b) => a.at.localeCompare(b.at)),
    [session]
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function refreshActivities() {
    const response = await fetch("/api/student/activities");
    const data = await response.json();
    if (response.ok) {
      setActivities(data.activities ?? []);
    }
  }

  async function refreshHistory(activityId?: string) {
    const url = activityId ? `/api/student/history?activityId=${encodeURIComponent(activityId)}` : "/api/student/history";
    const response = await fetch(url);
    const data = await response.json();
    if (response.ok) {
      setHistory(data.history ?? []);
    }
  }

  async function joinActivity(activityId: string) {
    setError("");
    const response = await fetch("/api/student/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId })
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "join_failed");
      return;
    }

    setSession(data);
    setDetailActivity(null);
    await refreshHistory(activityId);
  }

  async function openHistorySession(sessionId: string) {
    const response = await fetch(`/api/session/${sessionId}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "fetch_failed");
      return;
    }
    setSession(data);
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!session || !text.trim()) return;
    setError("");

    const response = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, userId: loginUser || "student", text })
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "send_failed");
      return;
    }

    setSession(data);
    setText("");
  }

  async function nextPhase() {
    if (!session) return;
    const response = await fetch("/api/session/advance-phase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "advance_failed");
      return;
    }
    setSession(data);
  }

  return (
    <main>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ marginBottom: 0 }}>學生端活動列表</h1>
          <div>
            <span className="badge" style={{ marginRight: 8 }}>
              {loginUser ? `登入者: ${loginUser}` : "學生"}
            </span>
            <button type="button" className="secondary" style={{ width: "auto" }} onClick={logout}>
              登出
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>可參與任務（ActivityPage）</h2>
        {activities.length === 0 ? <small>目前沒有可加入的任務。</small> : null}
        {activities.map((activity) => (
          <div key={activity.id} style={{ borderTop: "1px solid #e5e7eb", padding: "10px 0" }}>
            <strong>{activity.title}</strong>（{activity.className} / {activity.genre} / {activity.durationMinutes} 分鐘）
            <div>
              <small>{activity.supplemental}</small>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <div style={{ width: 180 }}>
                <button type="button" onClick={() => setDetailActivity(activity)}>
                  加入討論
                </button>
              </div>
              <div style={{ width: 180 }}>
                <button type="button" className="secondary" onClick={() => refreshHistory(activity.id)}>
                  歷史紀錄
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>歷史紀錄</h2>
        {history.length === 0 ? <small>暫無歷史紀錄</small> : null}
        {history.map((item) => (
          <div key={item.sessionId} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
            <strong>{item.activityTitle ?? item.activityId}</strong>
            <div>
              <small>
                Session: {item.sessionId} / Phase {item.currentStep} / 訊息數 {item.messageCount}
              </small>
            </div>
            <div style={{ marginTop: 6, width: 180 }}>
              <button type="button" className="secondary" onClick={() => openHistorySession(item.sessionId)}>
                開啟對話
              </button>
            </div>
          </div>
        ))}
      </div>

      {detailActivity ? (
        <div className="card" style={{ borderColor: "#93c5fd", background: "#eff6ff" }}>
          <h2>CourseDetailModal（任務詳情）</h2>
          <p>
            <strong>{detailActivity.title}</strong>
          </p>
          <p>
            班級：{detailActivity.className} / 文體：{detailActivity.genre} / 討論時長：{detailActivity.durationMinutes} 分鐘
          </p>
          <p>補充資料：{detailActivity.supplemental}</p>
          <div className="row">
            <div style={{ width: 180 }}>
              <button type="button" onClick={() => joinActivity(detailActivity.id)}>
                確認加入討論
              </button>
            </div>
            <div style={{ width: 180 }}>
              <button type="button" className="secondary" onClick={() => setDetailActivity(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {session ? (
        <>
          <div className="card">
            <h2>Phase{session.currentStep} 對話頁</h2>
            <div>
              <small>
                任務：{session.activityTitle ?? "未命名"} / Session: {session.id}
              </small>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <div style={{ width: 180 }}>
                <button type="button" className="secondary" onClick={nextPhase}>
                  下一階段
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>聊天室（Phase1~5 均保留輸入）</h2>
            <form onSubmit={sendMessage}>
              <label>訊息</label>
              <textarea value={text} onChange={(e) => setText(e.target.value)} />
              <button type="submit" style={{ marginTop: 10 }}>
                發送訊息
              </button>
            </form>
            {error ? (
              <p>
                <small>{error}</small>
              </p>
            ) : null}
          </div>

          <div className="card">
            <h2>對話紀錄</h2>
            {sortedMessages.map((message) => (
              <div key={message.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                <strong>
                  [P{message.step}] {message.role}
                  {message.userId ? `(${message.userId})` : ""}
                </strong>
                <div>{message.text}</div>
                <small>{message.at}</small>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
