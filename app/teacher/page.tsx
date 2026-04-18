"use client";

import { FormEvent, useState } from "react";

export default function TeacherPage() {
  const [sessionId, setSessionId] = useState("");
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState("");

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
      <h1>教師端（Vercel-native）</h1>

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

        {error ? <p><small>{error}</small></p> : null}
      </div>

      <div className="card">
        <h2>Latest Response</h2>
        <pre>{result || "尚未操作"}</pre>
      </div>
    </main>
  );
}
