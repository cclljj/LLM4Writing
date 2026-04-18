"use client";

import { FormEvent, useEffect, useState } from "react";

type UserRow = { username: string; name: string; school: string; role: string };
type EssayRow = { id: string; title: string; genre: string; description: string; enabled: boolean };
type OpenClassRow = { id: string; className: string; essayTitle: string; durationMinutes: number; supplemental: string };

type MonitorSession = {
  sessionId: string;
  activityId?: string;
  activityTitle?: string;
  participants: string[];
  currentStep: number;
  messages: Array<{ id: string; role: string; userId?: string; text: string; at: string; step: number }>;
};

export default function TeacherPage() {
  const [loginUser, setLoginUser] = useState("");
  const [tab, setTab] = useState<"system" | "learning" | "course">("system");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [essays, setEssays] = useState<EssayRow[]>([]);
  const [openClasses, setOpenClasses] = useState<OpenClassRow[]>([]);
  const [monitorSessions, setMonitorSessions] = useState<MonitorSession[]>([]);
  const [monitorSelected, setMonitorSelected] = useState<MonitorSession | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  const [essayForm, setEssayForm] = useState({ title: "", genre: "", description: "", enabled: true });
  const [openClassForm, setOpenClassForm] = useState({ className: "", essayTitle: "", durationMinutes: 40, supplemental: "" });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated) {
          setLoginUser(data.user.username);
        }
      })
      .catch(() => undefined);

    refreshAll();
  }, []);

  async function refreshAll() {
    const [u, e, o, m] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/essays"),
      fetch("/api/admin/openclasses"),
      fetch("/api/teacher/monitor")
    ]);

    if (u.ok) setUsers((await u.json()).users ?? []);
    if (e.ok) setEssays((await e.json()).essays ?? []);
    if (o.ok) setOpenClasses((await o.json()).openClasses ?? []);
    if (m.ok) setMonitorSessions((await m.json()).sessions ?? []);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function handleSwitch(e: FormEvent) {
    e.preventDefault();
    setError("");

    const response = await fetch("/api/teacher/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, step })
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "switch_failed");
      return;
    }

    setMonitorSelected({
      sessionId: data.id,
      activityId: data.activityId,
      activityTitle: data.activityTitle,
      participants: data.participants,
      currentStep: data.currentStep,
      messages: data.messages.slice(-20)
    });

    await refreshAll();
  }



  async function resetPassword(username: string) {
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, newPassword: "newpass123" })
    });
    alert(`已重設 ${username} 密碼為 newpass123`);
  }

  async function saveEssay(e: FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/essays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(essayForm)
    });
    setEssayForm({ title: "", genre: "", description: "", enabled: true });
    await refreshAll();
  }

  async function saveOpenClass(e: FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/openclasses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(openClassForm)
    });
    setOpenClassForm({ className: "", essayTitle: "", durationMinutes: 40, supplemental: "" });
    await refreshAll();
  }

  return (
    <main>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ marginBottom: 0 }}>教師端管理台（現況版回補）</h1>
          <div>
            <span className="badge" style={{ marginRight: 8 }}>
              {loginUser ? `登入者: ${loginUser}` : "教師"}
            </span>
            <button type="button" className="secondary" style={{ width: "auto" }} onClick={logout}>
              登出
            </button>
          </div>
        </div>
      </div>

      <div className="card row">
        <div style={{ width: 180 }}>
          <button type="button" onClick={() => setTab("system")}>系統管理</button>
        </div>
        <div style={{ width: 180 }}>
          <button type="button" onClick={() => setTab("learning")}>學習管理</button>
        </div>
        <div style={{ width: 180 }}>
          <button type="button" onClick={() => setTab("course")}>課程管理</button>
        </div>
      </div>

      {tab === "system" ? (
        <div className="card">
          <h2>帳號管理</h2>
          {users.map((user, idx) => (
            <div key={user.username} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
              #{idx + 1} / {user.username} / {user.name} / {user.school} / {user.role}
              <div style={{ marginTop: 6, width: 180 }}>
                <button type="button" className="secondary" onClick={() => resetPassword(user.username)}>
                  修改密碼
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "learning" ? (
        <>
          <div className="card">
            <h2>課堂觀察（MonitorPage）</h2>
            {monitorSessions.map((session) => (
              <div key={session.sessionId} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                <strong>{session.activityTitle ?? session.activityId}</strong>
                <div>
                  <small>
                    Session: {session.sessionId} / 小組：{session.participants.join(", ")} / 進度：Phase {session.currentStep}
                  </small>
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <div style={{ width: 180 }}>
                    <button type="button" className="secondary" onClick={() => setMonitorSelected(session)}>
                      查看小組對話
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>檢視學習進度 / 切換步驟</h2>
            <form onSubmit={handleSwitch} className="row">
              <div className="col">
                <label>Session ID</label>
                <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
              </div>
              <div className="col">
                <label>Step</label>
                <select value={step} onChange={(e) => setStep(Number(e.target.value))}>
                  {Array.from({ length: 5 }, (_, i) => i + 1).map((v) => (
                    <option key={v} value={v}>
                      Phase {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col" style={{ alignSelf: "end" }}>
                <button type="submit">切換步驟</button>
              </div>
            </form>
            {error ? <small>{error}</small> : null}
          </div>

          {monitorSelected ? (
            <div className="card">
              <h2>小組對話紀錄</h2>
              {monitorSelected.messages.map((message) => (
                <div key={message.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                  <strong>
                    [P{message.step}] {message.role}
                    {message.userId ? `(${message.userId})` : ""}
                  </strong>
                  <div>{message.text}</div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {tab === "course" ? (
        <>
          <div className="card">
            <h2>寫作主題管理（Essay CRUD）</h2>
            <form onSubmit={saveEssay} className="row">
              <div className="col">
                <label>標題</label>
                <input value={essayForm.title} onChange={(e) => setEssayForm({ ...essayForm, title: e.target.value })} />
              </div>
              <div className="col">
                <label>文體</label>
                <input value={essayForm.genre} onChange={(e) => setEssayForm({ ...essayForm, genre: e.target.value })} />
              </div>
              <div className="col">
                <label>說明</label>
                <input
                  value={essayForm.description}
                  onChange={(e) => setEssayForm({ ...essayForm, description: e.target.value })}
                />
              </div>
              <div className="col" style={{ alignSelf: "end" }}>
                <button type="submit">新增主題</button>
              </div>
            </form>
            {essays.map((essay) => (
              <div key={essay.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                {essay.id} / {essay.title} / {essay.genre} / {essay.description}
              </div>
            ))}
          </div>

          <div className="card">
            <h2>開課管理（Openclass CRUD）</h2>
            <form onSubmit={saveOpenClass} className="row">
              <div className="col">
                <label>班級</label>
                <input
                  value={openClassForm.className}
                  onChange={(e) => setOpenClassForm({ ...openClassForm, className: e.target.value })}
                />
              </div>
              <div className="col">
                <label>主題</label>
                <input
                  value={openClassForm.essayTitle}
                  onChange={(e) => setOpenClassForm({ ...openClassForm, essayTitle: e.target.value })}
                />
              </div>
              <div className="col">
                <label>時長</label>
                <input
                  type="number"
                  value={openClassForm.durationMinutes}
                  onChange={(e) =>
                    setOpenClassForm({ ...openClassForm, durationMinutes: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="col">
                <label>補充資料</label>
                <input
                  value={openClassForm.supplemental}
                  onChange={(e) => setOpenClassForm({ ...openClassForm, supplemental: e.target.value })}
                />
              </div>
              <div className="col" style={{ alignSelf: "end" }}>
                <button type="submit">新增班級任務</button>
              </div>
            </form>
            {openClasses.map((openClass) => (
              <div key={openClass.id} style={{ borderTop: "1px solid #e5e7eb", padding: "8px 0" }}>
                {openClass.id} / {openClass.className} / {openClass.essayTitle} / {openClass.durationMinutes} 分鐘 / {openClass.supplemental}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
