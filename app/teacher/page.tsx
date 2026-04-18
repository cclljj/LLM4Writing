"use client";

import { FormEvent, useEffect, useState } from "react";

export default function TeacherPage() {
  const [sessionId, setSessionId] = useState("");
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState("");
  const [loginUser, setLoginUser] = useState("");

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

    setResult(JSON.stringify(data, null, 2));
  }

  return (
    <main>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ marginBottom: 0 }}>教師端（Vercel-native）</h1>
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

      <div className="card">
        <h2>切換全班步驟</h2>
        <form onSubmit={handleSwitch} className="row">
          <div className="col">
            <label>Session ID</label>
            <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
          </div>
          <div className="col">
            <label>Step (1-10)</label>
            <select value={step} onChange={(e) => setStep(Number(e.target.value))}>
              {Array.from({ length: 10 }, (_, idx) => idx + 1).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="col" style={{ alignSelf: "end" }}>
            <button type="submit">Switch Step</button>
          </div>
        </form>

        {error ? (
          <p>
            <small>{error}</small>
          </p>
        ) : null}
      </div>

      <div className="card">
        <h2>Latest Response</h2>
        <pre>{result || "尚未操作"}</pre>
      </div>
    </main>
  );
}
