"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type InteractionMode = "group_interaction" | "personal_interaction" | "non_interactive" | "personal_reflection";

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

  const sortedMessages = useMemo(
    () => [...(session?.messages ?? [])].sort((a, b) => a.at.localeCompare(b.at)),
    [session]
  );

  const currentStep = session?.currentStep ?? 1;
  const currentMode = getMode(currentStep);
  const isInputEnabled = currentMode !== "non_interactive";

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
    if (!session || !text.trim() || !isInputEnabled) return;
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
                Session: {item.sessionId} / Step {item.currentStep} / 訊息數 {item.messageCount}
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
            <h2>
              Step {session.currentStep} - {stepNameMap[session.currentStep] ?? "未知步驟"}
            </h2>
            <div>
              <small>
                任務：{session.activityTitle ?? "未命名"} / Session: {session.id}
              </small>
            </div>
            <div style={{ marginTop: 8 }}>
              <span className="badge">
                模式：
                {currentMode === "group_interaction"
                  ? "小組互動"
                  : currentMode === "personal_interaction"
                    ? "個人互動"
                    : currentMode === "non_interactive"
                      ? "無互動"
                      : "個人反思"}
              </span>
            </div>
            <p>
              <small>步驟切換由教師端控制，你的頁面會自動同步。</small>
            </p>
          </div>

          <div className="card">
            <h2>寫作主題</h2>
            <p>{session.activityTitle ?? "未命名任務"}</p>
          </div>

          <div className="card">
            <h2>互動區</h2>
            {currentMode === "non_interactive" ? (
              <small>本步驟為無互動模式，請閱讀系統/AI 產出內容。</small>
            ) : null}
            {currentMode === "group_interaction" ? (
              <small>小組互動模式：需所有組員至少回覆一次後，AI 才會回覆。</small>
            ) : null}
            {currentMode === "personal_reflection" ? (
              <small>個人反思模式：系統發問，AI 不回覆。</small>
            ) : null}

            {isInputEnabled ? (
              <form onSubmit={sendMessage}>
                <label>訊息</label>
                <textarea value={text} onChange={(e) => setText(e.target.value)} />
                <button type="submit" style={{ marginTop: 10 }}>
                  發送訊息
                </button>
              </form>
            ) : null}

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
                  [S{message.step}] {message.role}
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
