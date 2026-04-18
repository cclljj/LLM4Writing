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
  stepState: { step1Substep: number; step2Substep: number };
  outlines: Record<string, string>;
  draftStep6: Record<string, string>;
  draftStep8: Record<string, string>;
  reports: { step5?: string; step7: Record<string, string>; step10: Record<string, string> };
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

  const [outlineText, setOutlineText] = useState("");
  const [draftText, setDraftText] = useState("");
  const [refUser, setRefUser] = useState("");
  const [showTopic, setShowTopic] = useState(false);
  const [showOutlineEditor, setShowOutlineEditor] = useState(false);
  const [showDraftEditor, setShowDraftEditor] = useState(false);
  const [showStep6OutlineRef, setShowStep6OutlineRef] = useState(false);

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

  useEffect(() => {
    if (!session || !loginUser) return;
    setOutlineText(session.outlines[loginUser] ?? "");
    if (session.currentStep === 6) {
      setDraftText(session.draftStep6[loginUser] ?? "");
      setShowDraftEditor(false);
      setShowStep6OutlineRef(false);
    }
    if (session.currentStep === 8) {
      setDraftText(session.draftStep8[loginUser] ?? session.draftStep6[loginUser] ?? "");
      setShowDraftEditor(false);
    }
    if (session.currentStep === 3 || session.currentStep === 4) {
      setShowOutlineEditor(false);
    }
    setShowTopic(false);
    if (!refUser && session.participants.length > 0) {
      setRefUser((session.participants.find((user) => user !== loginUser) ?? session.participants[0])!);
    }
  }, [session?.id, session?.currentStep, loginUser]);

  const sortedMessages = useMemo(
    () => [...(session?.messages ?? [])].sort((a, b) => a.at.localeCompare(b.at)),
    [session]
  );
  const currentActivity = useMemo(
    () => activities.find((item) => item.id === session?.activityId),
    [activities, session?.activityId]
  );
  const teammateUsers = useMemo(() => {
    if (!session) return [];
    return session.participants.filter((user) => user !== loginUser);
  }, [session, loginUser]);

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

  async function saveArtifact(type: "outline" | "draft6" | "draft8", content: string) {
    if (!session) return;
    const response = await fetch("/api/session/artifact/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, type, content })
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "save_failed");
      return;
    }

    setSession(data);
  }

  const stepSubstepText =
    currentStep === 1
      ? `目前子步驟：1-${session?.stepState.step1Substep ?? 1}`
      : currentStep === 2
        ? `目前子步驟：2-${session?.stepState.step2Substep ?? 1}`
        : null;

  const ownStep7Report = session && loginUser ? session.reports.step7[loginUser] : undefined;
  const ownStep10Report = session && loginUser ? session.reports.step10[loginUser] : undefined;

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
            {stepSubstepText ? <p><small>{stepSubstepText}</small></p> : null}
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
            <div style={{ width: 180 }}>
              <button type="button" className="secondary" onClick={() => setShowTopic((prev) => !prev)}>
                寫作主題
              </button>
            </div>
          </div>

          {showTopic ? (
            <div className="card" style={{ borderColor: "#93c5fd", background: "#eff6ff" }}>
              <h2>寫作主題</h2>
              <p>
                <strong>{session.activityTitle ?? "未命名任務"}</strong>
              </p>
              <p>
                班級：{currentActivity?.className ?? "—"} / 文體：{currentActivity?.genre ?? "—"} / 討論時長：
                {currentActivity?.durationMinutes ?? "—"} 分鐘
              </p>
              <p>寫作引導說明：{currentActivity?.supplemental ?? "—"}</p>
            </div>
          ) : null}

          {(currentStep === 3 || currentStep === 4) && loginUser ? (
            <div className="card">
              <h2>文章結構樹</h2>
              <div className="row">
                <div style={{ width: 180 }}>
                  <button type="button" className="secondary" onClick={() => setShowOutlineEditor((prev) => !prev)}>
                    文章結構樹
                  </button>
                </div>
              </div>
              {showOutlineEditor ? (
                <>
                  <label style={{ marginTop: 10 }}>我的結構樹內容</label>
                  <textarea
                    value={outlineText}
                    onChange={(e) => setOutlineText(e.target.value)}
                    placeholder={
                      currentActivity?.genre === "議論文"
                        ? "建議格式：立場主張、論點一、論點二、反方回應、結論。"
                        : currentActivity?.genre === "說明文"
                          ? "建議格式：主題說明、背景、重點一、重點二、總結。"
                          : currentActivity?.genre === "抒情文"
                            ? "建議格式：情境鋪陳、情感轉折、意象描述、收束。"
                            : "請規劃主題、段落重點與結論。"
                    }
                  />
                  <div style={{ width: 160, marginTop: 10 }}>
                    <button type="button" onClick={() => saveArtifact("outline", outlineText)}>
                      儲存結構樹
                    </button>
                  </div>
                </>
              ) : null}

              {currentStep === 4 ? (
                <>
                  <label style={{ marginTop: 14 }}>瀏覽組員結構樹（唯讀）</label>
                  <select value={refUser} onChange={(e) => setRefUser(e.target.value)}>
                    {(teammateUsers.length > 0 ? teammateUsers : session.participants).map((user) => (
                      <option key={user} value={user}>
                        {user}
                      </option>
                    ))}
                  </select>
                  <pre style={{ marginTop: 8 }}>{session.outlines[refUser] ?? "尚未提供"}</pre>
                </>
              ) : null}
            </div>
          ) : null}

          {(currentStep === 6 || currentStep === 8) && loginUser ? (
            <div className="card">
              <h2>{currentStep === 6 ? "撰寫初稿" : "修改潤飾"}</h2>
              {currentStep === 6 ? (
                <>
                  <div className="row">
                    <div style={{ width: 220 }}>
                      <button type="button" className="secondary" onClick={() => setShowStep6OutlineRef((prev) => !prev)}>
                        文章結構樹（唯讀參考）
                      </button>
                    </div>
                  </div>
                  {showStep6OutlineRef ? (
                    <>
                      <label style={{ marginTop: 10 }}>選擇要參考的結構樹</label>
                      <select value={refUser} onChange={(e) => setRefUser(e.target.value)}>
                        {session.participants.map((user) => (
                          <option key={user} value={user}>
                            {user}
                          </option>
                        ))}
                      </select>
                      <pre style={{ marginTop: 8 }}>{session.outlines[refUser] ?? "步驟 4 尚無儲存結構樹。"}</pre>
                    </>
                  ) : null}
                </>
              ) : null}

              <div className="row" style={{ marginTop: 10 }}>
                <div style={{ width: 180 }}>
                  <button type="button" className="secondary" onClick={() => setShowDraftEditor((prev) => !prev)}>
                    撰寫作文
                  </button>
                </div>
              </div>
              {showDraftEditor ? (
                <>
                  {currentStep === 8 ? <small>已預載步驟 6 初稿內容，可直接修改後儲存。</small> : null}
                  <textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} />
                  <div style={{ width: 180, marginTop: 10 }}>
                    <button type="button" onClick={() => saveArtifact(currentStep === 6 ? "draft6" : "draft8", draftText)}>
                      儲存作文
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {currentStep === 5 ? (
            <div className="card">
              <h2>摘要報告</h2>
              <pre>{session.reports.step5 ?? "系統尚未產生摘要。"}</pre>
            </div>
          ) : null}

          {currentStep === 7 ? (
            <div className="card">
              <h2>分析回饋</h2>
              <h3>步驟 6 作文內容</h3>
              <pre>{loginUser ? session.draftStep6[loginUser] ?? "尚未提交初稿。" : "尚未提交初稿。"}</pre>
              <h3 style={{ marginTop: 12 }}>AI 分析回饋</h3>
              <pre>{ownStep7Report ?? "系統尚未產生分析。"}</pre>
            </div>
          ) : null}

          {currentStep === 10 ? (
            <div className="card">
              <h2>總結報告</h2>
              <h3>步驟 8 最終作文</h3>
              <pre>
                {loginUser
                  ? session.draftStep8[loginUser] ?? session.draftStep6[loginUser] ?? "尚未提交最終稿。"
                  : "尚未提交最終稿。"}
              </pre>
              <h3 style={{ marginTop: 12 }}>AI 總結分析</h3>
              <pre>{ownStep10Report ?? "系統尚未產生總結。"}</pre>
            </div>
          ) : null}

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
